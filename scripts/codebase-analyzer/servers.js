/**
 * server-analyzer.js
 * 
 * Module for analyzing MCP server implementations
 */

const fs = require('fs');
const path = require('path');
const utils = require('../analyzer-utils');

/**
 * Extract server schema details including configuration, tools, and environment variables
 */
function extractServerSchema(filePath, config = {}) {
  try {
    const content = utils.readFileContent(filePath);
    if (!content) return null;
    
    const result = {
      filePath,
      serverInfo: {},
      tools: [],
      envVars: [],
      requestHandlers: [],
      databaseOperations: [],
      usesDirectSdkImport: false
    };
    
    // Check SDK import pattern
    const sdkImportMatch = content.match(/const\s+sdk\s*=\s*require\(['"]@modelcontextprotocol\/sdk['"]\)/) ||
                          content.match(/import\s+\*\s+as\s+sdk\s+from\s+['"]@modelcontextprotocol\/sdk['"]/);
    if (sdkImportMatch) {
      result.usesDirectSdkImport = true;
    }
    
    // Extract server info
    const serverInfoMatch = content.match(/name:\s*['"](.*?)['"],\s*\n\s*description:\s*['"](.*?)['"],\s*\n\s*version:\s*['"](.*?)['"],/s) ||
                            content.match(/id:\s*['"](.*?)['"],\s*\n\s*name:\s*['"](.*?)['"],\s*\n\s*description:\s*['"](.*?)['"],\s*\n\s*version:\s*['"](.*?)['"],/s);
    
    if (serverInfoMatch) {
      result.serverInfo = {
        id: serverInfoMatch[1] || '',
        name: serverInfoMatch[2] || serverInfoMatch[1] || '',
        description: serverInfoMatch[3] || serverInfoMatch[2] || '',
        version: serverInfoMatch[4] || serverInfoMatch[3] || ''
      };
    }
    
    // Extract environment variables with their default values and usage
    const envMatches = content.match(/process\.env\.(\w+)\s*(?:\|\|\s*['"](.+?)['"])?/g) || [];
    for (const match of envMatches) {
      const varMatch = match.match(/process\.env\.(\w+)\s*(?:\|\|\s*['"](.+?)['"])?/);
      if (varMatch) {
        result.envVars.push({
          name: varMatch[1],
          defaultValue: varMatch[2] || null
        });
      }
    }
    
    // Extract tool definitions with parameters and descriptions
    const toolPatterns = [
      // Pattern for tools defined in tools/list handler
      {
        regex: /name:\s*['"](\w+)['"](.*?)description:\s*['"](.*?)['"]([\s\S]*?)(?:inputSchema|parameters):\s*({[\s\S]*?})(?:,\s*\n\s*(?:handler|async))?/g,
        nameIndex: 1,
        descIndex: 3,
        schemaIndex: 5
      },
      // Pattern for tools defined using createServer
      {
        regex: /name:\s*['"](\w+)['"](.*?)description:\s*['"](.*?)['"]([\s\S]*?)parameters:\s*({[\s\S]*?}),(\s*\n\s*async\s+handler|\s*\n\s*handler)/g,
        nameIndex: 1,
        descIndex: 3,
        schemaIndex: 5
      }
    ];
    
    for (const pattern of toolPatterns) {
      const regex = new RegExp(pattern.regex);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const toolName = match[pattern.nameIndex];
        const description = match[pattern.descIndex];
        const schemaStr = match[pattern.schemaIndex];
        
        // Check if we already have this tool
        if (!result.tools.some(tool => tool.name === toolName)) {
          result.tools.push({
            name: toolName,
            description,
            schema: schemaStr.trim()
          });
        }
      }
    }
    
    // Also check tools from switch statements in tools/call
    const switchCasesMatch = content.match(/switch\s*\(.*?\)\s*{([\s\S]*?)}/s);
    if (switchCasesMatch) {
      const switchBody = switchCasesMatch[1];
      const caseMatches = switchBody.match(/case\s*['"](\w+)['"]\s*:\s*([\s\S]*?)(?:break|return|case\s|\}\s*$)/g) || [];
      
      for (const caseMatch of caseMatches) {
        const toolMatch = caseMatch.match(/case\s*['"](\w+)['"]\s*:/); 
        if (toolMatch) {
          const toolName = toolMatch[1];
          // Only add if not already found
          if (!result.tools.some(tool => tool.name === toolName)) {
            const caseBody = caseMatch.replace(/case\s*['"](\w+)['"]\s*:/, '');
            // Try to extract parameter destructuring
            const paramMatch = caseBody.match(/const\s*\{([^}]+)\}\s*=\s*\w+/s);
            const params = paramMatch ? 
              paramMatch[1].split(',').map(p => p.trim()) : 
              [];
            
            result.tools.push({
              name: toolName,
              description: `Tool handler for ${toolName}`,
              parameters: params,
              implementation: 'switch-case'
            });
          }
        }
      }
    }
    
    // Extract request handlers
    const handlerMatches = content.match(/setRequestHandler\s*\(\s*['"](\w+\/\w+)['"]/g) || 
                           content.match(/setRequestHandler\s*\(\s*(\w+)\s*,/g) || [];
    for (const match of handlerMatches) {
      const nameMatch = match.match(/['"]([^'"]+)['"]/) || match.match(/setRequestHandler\s*\(\s*(\w+)\s*,/);
      if (nameMatch) {
        const handlerName = nameMatch[1];
        result.requestHandlers.push(handlerName);
      }
    }
    
    // Extract database operations
    const dbOperationPatterns = [
      {
        type: 'query',
        regex: /db\.(?:all|get|run)\s*\(\s*['"](.+?)['"]|\w+\.query\s*\(\s*['"](.+?)['"]|(?:find|findOne|findMany|create|update|delete)\s*\(/g
      },
      {
        type: 'table',
        regex: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\s*['"](\w+)['"]?/gi
      },
      {
        type: 'driver',
        regex: /new\s+(?:(SQLite|sqlite3|pg|postgres|mysql|mongodb)\.\w+)|require\s*\(['"](?:sqlite3|pg|mysql|mongodb)['"]\)/g
      }
    ];
    
    for (const pattern of dbOperationPatterns) {
      const regex = new RegExp(pattern.regex);
      let match;
      while ((match = regex.exec(content)) !== null) {
        result.databaseOperations.push({
          type: pattern.type,
          operation: match[0].trim()
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Analyze Claude desktop configuration
 */
function analyzeClaudeConfig(filePath, config = {}) {
  try {
    const content = utils.readFileContent(filePath);
    if (!content) return null;
    
    let configObj;
    try {
      configObj = JSON.parse(content);
    } catch (jsonError) {
      console.error(`Error parsing Claude config JSON:`, jsonError.message);
      return null;
    }
    
    const result = {
      servers: [],
      missingFiles: [],
      validFiles: []
    };
    
    if (configObj.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(configObj.mcpServers)) {
        result.servers.push({
          name: serverName,
          command: serverConfig.command,
          args: serverConfig.args || [],
          description: serverConfig.description || '',
          type: serverConfig.type || '',
          env: serverConfig.env || {}
        });
        
        // Check if args point to files
        if (serverConfig.args && Array.isArray(serverConfig.args)) {
          for (const arg of serverConfig.args) {
            if (typeof arg === 'string' && arg.includes('\\') && !arg.startsWith('-')) {
              const filePath = arg.replace(/\\\\/g, '\\');
              if (fs.existsSync(filePath)) {
                result.validFiles.push({ serverName, filePath });
              } else {
                result.missingFiles.push({ serverName, filePath });
              }
            }
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error analyzing Claude config ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Generate suggestions for missing files in the Claude configuration
 */
function generateReplacementPaths(missingFiles, serverFiles) {
  const result = [];
  
  for (const missingFile of missingFiles) {
    // Generate potential replacements
    const replacements = serverFiles
      .filter(file => fs.existsSync(file.fullPath))
      .map(file => file.fullPath);
    
    result.push({
      serverName: missingFile.serverName,
      missingPath: missingFile.filePath,
      replacements
    });
  }
  
  return result;
}

/**
 * Compare different server implementations
 */
function compareServerImplementations(servers) {
  console.log('Comparing server implementations...');
  
  const comparison = {
    summary: {}
  };
  
  // Add summary for each server
  for (const [serverName, server] of Object.entries(servers)) {
    if (!server) continue;
    
    comparison.summary[serverName] = {
      toolsCount: server.tools?.length || 0,
      handlerCount: server.requestHandlers?.length || 0,
      envVarCount: server.envVars?.length || 0,
      usesDatabase: server.databaseOperations?.length > 0,
      usesDirectSdkImport: server.usesDirectSdkImport || false
    };
  }
  
  return comparison;
}

/**
 * Run a comprehensive analysis of MCP server implementations
 */
async function analyzeServers(repoStructure, config = {}) {
  const startTime = Date.now();
  const fullConfig = utils.parseConfig(config);
  
  console.log('Starting MCP server analysis...');
  
  // Find server files
  const serverFilePattern = /server\.js$|-server\.js$/i;
  const serverFiles = repoStructure.serverFiles.filter(
    file => file.path.match(serverFilePattern) && file.path.startsWith('scripts/')
  );
  
  console.log(`Found ${serverFiles.length} server files to analyze`);
  
  // Analyze each server file
  const servers = {};
  for (const file of serverFiles) {
    const fullPath = path.join(fullConfig.rootDir, file.path);
    console.log(`Analyzing server: ${file.path}`);
    
    const serverData = extractServerSchema(fullPath, fullConfig);
    if (serverData) {
      const serverName = path.basename(file.path, '.js');
      servers[serverName] = serverData;
    }
  }
  
  // Analyze Claude configuration if available
  const claudeConfigPath = "C:/Users/roger/AppData/Roaming/Claude/claude_desktop_config.json";
  let claudeConfig = null;
  if (fs.existsSync(claudeConfigPath)) {
    console.log('Analyzing Claude Desktop configuration...');
    claudeConfig = analyzeClaudeConfig(claudeConfigPath, fullConfig);
    
    // Generate recommendations for any missing files
    if (claudeConfig && claudeConfig.missingFiles.length > 0) {
      claudeConfig.recommendations = generateReplacementPaths(claudeConfig.missingFiles, serverFiles);
    }
  }
  
  // Compare server implementations
  const comparison = compareServerImplementations(servers);
  
  // Create result object
  const result = {
    servers,
    claudeConfig,
    comparison,
    analysisTime: utils.formatElapsedTime(startTime)
  };
  
  // Save results if requested
  if (fullConfig.reportFormats.includes('json')) {
    utils.writeJsonOutput(fullConfig.outputDir, 'server-analysis.json', result);
  }
  
  console.log(`Server analysis complete in ${result.analysisTime}`);
  return result;
}

module.exports = {
  extractServerSchema,
  analyzeClaudeConfig,
  generateReplacementPaths,
  compareServerImplementations,
  analyzeServers
};
