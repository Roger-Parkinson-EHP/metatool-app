/**
 * mcp-server-analyzer.js
 * 
 * A utility to analyze MCP servers in the codebase and their integration
 * Focuses on unified-server.js and the simplified server implementations
 */

const fs = require('fs');
const path = require('path');

// Import the repository and import analyzers
const repoMapper = require('./repo-mapper');
const importAnalyzer = require('./import-analyzer');

// Configuration - inherit from repo-mapper
const CONFIG = {
  ...repoMapper.CONFIG,
  targetFiles: {
    unifiedServer: 'scripts/unified-server.js',
    simplifiedRogerthat: 'scripts/simplified-rogerthat-server.js',
    simplifiedSemantic: 'scripts/simplified-semantic-server.js',
    claudeConfig: 'C:/Users/roger/AppData/Roaming/Claude/claude_desktop_config.json'
  }
};

/**
 * Extract details about MCP server implementation
 */
function analyzeMcpServer(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {
      filePath,
      serverInfo: {},
      sdkImports: [],
      capabilities: [],
      requestHandlers: [],
      tools: [],
      database: {
        used: false,
        operations: []
      }
    };
    
    // Extract server info
    const serverInfoMatch = content.match(/name:\s*['"](.*?)['"]\s*,\s*version:\s*['"](.*?)['"]/) ||
                          content.match(/id:\s*['"](.*?)['"]/);
    if (serverInfoMatch) {
      result.serverInfo = {
        name: serverInfoMatch[1],
        version: serverInfoMatch[2] || '1.0.0'
      };
    }
    
    // Extract SDK imports
    const sdkImportMatches = content.match(/require\s*\(['"]@modelcontextprotocol\/sdk.*?['"]\)/g) || [];
    for (const match of sdkImportMatches) {
      result.sdkImports.push(match);
    }
    
    // Check if using the direct SDK import pattern (our fixed version)
    result.usesDirectSdkImport = content.includes("require('@modelcontextprotocol/sdk')") ||
                              content.includes("require(\"@modelcontextprotocol/sdk\")");
    
    // Extract capabilities
    const capabilitiesMatch = content.match(/capabilities\s*:\s*\{([^}]*)\}/s);
    if (capabilitiesMatch) {
      const capabilitiesStr = capabilitiesMatch[1];
      const capabilityMatches = capabilitiesStr.match(/\b(\w+)\s*:/g) || [];
      for (const match of capabilityMatches) {
        const capability = match.match(/\b(\w+)\s*:/)[1];
        result.capabilities.push(capability);
      }
    }
    
    // Extract request handlers
    const handlerMatches = content.match(/setRequestHandler\s*\(['"]([^'"]+)['"]|createRequestHandler\s*\(['"]([^'"]+)['"]|addRequestHandler\s*\(['"]([^'"]+)['"]|handleRequest\s*\(['"]([^'"]+)['"]/);
    if (handlerMatches) {
      const handlerName = handlerMatches[1] || handlerMatches[2] || handlerMatches[3] || handlerMatches[4];
      if (!result.requestHandlers.includes(handlerName)) {
        result.requestHandlers.push(handlerName);
      }
    }
    
    // Extract tools
    const toolMatches = content.match(/name:\s*['"](.*?)['"]\s*,\s*description:\s*['"](.*?)['"]/) || [];
    if (toolMatches) {
      result.tools.push({
        name: toolMatches[1],
        description: toolMatches[2]
      });
    }
    
    // Check for database usage
    result.database.used = content.includes('sqlite3') || 
                        content.includes('db.run') || 
                        content.includes('db.all') || 
                        content.includes('db.get');
    
    if (result.database.used) {
      const dbOperationMatches = content.match(/db\.(run|all|get)\s*\(['"]([^'"]*)['"]/g) || [];
      for (const match of dbOperationMatches) {
        const opMatch = match.match(/db\.(run|all|get)\s*\(['"]([^'"]*)['"]/);  
        if (opMatch) {
          result.database.operations.push({
            operation: opMatch[1],
            query: opMatch[2]
          });
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error analyzing MCP server ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Analyze the claude_desktop_config.json file to find MCP server configurations
 */
function analyzeClaudeConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`Claude config file not found: ${filePath}`);
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    let config;
    try {
      config = JSON.parse(content);
    } catch (err) {
      console.error(`Error parsing Claude config: ${err.message}`);
      return null;
    }
    
    const result = {
      mcpServers: []
    };
    
    if (config.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        const server = {
          name: serverName,
          command: serverConfig.command,
          args: serverConfig.args || [],
          description: serverConfig.description || '',
          type: serverConfig.type || '',
          env: serverConfig.env || {}
        };
        
        // Check if it's using our server
        server.usesMetaMcp = serverConfig.args && 
                          serverConfig.args.some(arg => {
                            return typeof arg === 'string' && (
                              arg.includes('unified-server.js') ||
                              arg.includes('simplified-rogerthat-server.js') ||
                              arg.includes('simplified-semantic-server.js')
                            );
                          });
        
        result.mcpServers.push(server);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error analyzing Claude config ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Compare the different server implementations
 */
function compareServerImplementations(servers) {
  console.log('Comparing server implementations...');
  
  const comparison = {
    importPatterns: {},
    capabilities: {},
    requestHandlers: {},
    databaseUsage: {},
    serverInfo: {},
    summary: {
      unified: {
        usesDirectSdkImport: false,
        capabilitiesCount: 0,
        requestHandlersCount: 0,
        usesDatabase: false
      },
      simplifiedRogerthat: {
        usesDirectSdkImport: false,
        capabilitiesCount: 0,
        requestHandlersCount: 0,
        usesDatabase: false
      },
      simplifiedSemantic: {
        usesDirectSdkImport: false,
        capabilitiesCount: 0,
        requestHandlersCount: 0,
        usesDatabase: false
      }
    }
  };
  
  // Compare import patterns
  for (const [serverKey, server] of Object.entries(servers)) {
    if (!server) continue;
    
    const shortKey = serverKey.replace('Server', '');
    comparison.importPatterns[shortKey] = {
      sdkImports: server.sdkImports,
      usesDirectSdkImport: server.usesDirectSdkImport
    };
    
    comparison.capabilities[shortKey] = server.capabilities;
    comparison.requestHandlers[shortKey] = server.requestHandlers;
    comparison.databaseUsage[shortKey] = server.database.used;
    comparison.serverInfo[shortKey] = server.serverInfo;
    
    if (comparison.summary[shortKey]) {
      comparison.summary[shortKey].usesDirectSdkImport = server.usesDirectSdkImport;
      comparison.summary[shortKey].capabilitiesCount = server.capabilities.length;
      comparison.summary[shortKey].requestHandlersCount = server.requestHandlers.length;
      comparison.summary[shortKey].usesDatabase = server.database.used;
    }
  }
  
  return comparison;
}

/**
 * Main function to execute the MCP server analysis
 */
function analyzeMcpServers() {
  console.log('Starting MCP server analysis...');
  
  const servers = {};
  const configAnalysis = {};
  
  // Analyze each target file
  for (const [fileKey, filePath] of Object.entries(CONFIG.targetFiles)) {
    if (fileKey === 'claudeConfig') {
      configAnalysis[fileKey] = analyzeClaudeConfig(filePath);
    } else {
      const fullPath = path.resolve(CONFIG.rootDir, filePath);
      servers[fileKey] = analyzeMcpServer(fullPath);
    }
  }
  
  // Compare server implementations
  const comparison = compareServerImplementations(servers);
  
  // Write results to files
  repoMapper.writeJsonOutput('mcp-servers.json', servers);
  repoMapper.writeJsonOutput('claude-config.json', configAnalysis);
  repoMapper.writeJsonOutput('server-comparison.json', comparison);
  
  console.log('MCP server analysis complete!');
  
  // Print a summary
  console.log('\nMCP Server Implementation Comparison:');
  console.log('\nImport Patterns:');
  for (const [server, data] of Object.entries(comparison.importPatterns)) {
    console.log(`- ${server}: ${data.usesDirectSdkImport ? 'Direct SDK import' : 'Path-specific imports'}`);
  }
  
  console.log('\nCapabilities:');
  for (const [server, capabilities] of Object.entries(comparison.capabilities)) {
    console.log(`- ${server}: ${capabilities.length} capabilities (${capabilities.join(', ')})`);
  }
  
  console.log('\nDatabase Usage:');
  for (const [server, usesDb] of Object.entries(comparison.databaseUsage)) {
    console.log(`- ${server}: ${usesDb ? 'Uses database' : 'No database'}`);
  }
  
  return {
    servers,
    configAnalysis,
    comparison
  };
}

// Run the analysis if this module is executed directly
if (require.main === module) {
  analyzeMcpServers();
}

module.exports = {
  analyzeMcpServers,
  analyzeMcpServer,
  analyzeClaudeConfig,
  compareServerImplementations,
  CONFIG
};
