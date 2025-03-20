/**
 * quick-analyzer.js
 * 
 * A streamlined script to quickly analyze MCP server implementations
 * and provide precise context for code refinement.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  outputFile: path.resolve(__dirname, '..', 'analysis-results.json'),
  serverFiles: {
    unified: 'scripts/unified-server.js',
    simplifiedRogerthat: 'scripts/simplified-rogerthat-server.js',
    simplifiedSemantic: 'scripts/simplified-semantic-server.js'
  },
  configFile: 'config/claude_desktop_config.json'
};

/**
 * Extract tools defined in a server implementation
 */
function extractTools(content) {
  const tools = new Set();
  
  // Pattern 1: Tools in server.setRequestHandler('tools/list'...)
  const toolListMatch = content.match(/tools\/list[^{]*{([\s\S]*?)tools:\s*\[([\s\S]*?)\]\s*}/s);
  if (toolListMatch && toolListMatch[2]) {
    const nameMatches = toolListMatch[2].match(/name:\s*['"](\w+)['"]\s*,/g) || [];
    for (const match of nameMatches) {
      const name = match.match(/['"](\w+)['"]\s*,/)[1];
      tools.add(name);
    }
  }
  
  // Pattern 2: Tools in createServer({...tools: [...
  const createServerMatch = content.match(/createServer\(\s*{[\s\S]*?tools:\s*\[([\s\S]*?)\]\s*,/s);
  if (createServerMatch) {
    const nameMatches = createServerMatch[1].match(/name:\s*['"](\w+)['"]\s*,/g) || [];
    for (const match of nameMatches) {
      const name = match.match(/['"](\w+)['"]\s*,/)[1];
      tools.add(name);
    }
  }
  
  // Pattern 3: Case statements in tools/call handler
  const caseMatches = content.match(/case\s*['"](\w+)['"]\s*:/g) || [];
  for (const match of caseMatches) {
    const name = match.match(/['"](\w+)['"]\s*/)[1];
    tools.add(name);
  }
  
  return Array.from(tools);
}

/**
 * Extract environment variables used in code
 */
function extractEnvVars(content) {
  const envVars = new Set();
  
  const envMatches = content.match(/process\.env\.(\w+)/g) || [];
  for (const match of envMatches) {
    const name = match.replace('process.env.', '');
    envVars.add(name);
  }
  
  return Array.from(envVars);
}

/**
 * Extract imports/requires from the file
 */
function extractImports(content) {
  const imports = [];
  
  // Look for require statements
  const requireMatches = content.match(/(?:const|let|var)\s+(?:{[^}]*}|\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g) || [];
  for (const match of requireMatches) {
    const moduleMatch = match.match(/require\(['"]([^'"]+)['"]\)/);
    if (moduleMatch) {
      imports.push({
        type: 'require',
        module: moduleMatch[1],
        isExternal: !moduleMatch[1].startsWith('.')
      });
    }
  }
  
  // Look for ES6 import statements
  const importMatches = content.match(/import\s+(?:{[^}]*}|\w+)\s+from\s+['"]([^'"]+)['"]\s*/g) || [];
  for (const match of importMatches) {
    const moduleMatch = match.match(/from\s+['"]([^'"]+)['"]/);
    if (moduleMatch) {
      imports.push({
        type: 'import',
        module: moduleMatch[1],
        isExternal: !moduleMatch[1].startsWith('.')
      });
    }
  }
  
  return imports;
}

/**
 * Find issues with Claude desktop config
 */
function analyzeClaudeConfig(configPath) {
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    const issues = [];
    const servers = [];
    
    // Check for references to non-existent files
    if (config.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        servers.push({
          name: serverName,
          command: serverConfig.command || '',
          args: serverConfig.args || [],
          description: serverConfig.description || ''
        });
        
        if (serverConfig.args && serverConfig.args.length > 0) {
          for (const arg of serverConfig.args) {
            if (typeof arg === 'string' && arg.includes('\\') && !arg.startsWith('-')) {
              // This looks like a file path
              const filePath = arg.replace(/\\\\/g, '\\'); // Fix double escaped backslashes
              
              if (!fs.existsSync(filePath)) {
                issues.push({
                  serverName,
                  missingFile: filePath,
                  suggestedFix: 'Replace with working server implementation'
                });
              }
            }
          }
        }
      }
    }
    
    return { servers, issues };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Quick analysis of a specific server implementation
 */
function analyzeServer(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    return {
      exists: true,
      path: filePath,
      lineCount: content.split('\n').length,
      tools: extractTools(content),
      envVars: extractEnvVars(content),
      imports: extractImports(content),
      usesDatabase: content.includes('sqlite3') || content.includes('new sqlite3.Database')
    };
  } catch (error) {
    return {
      exists: false,
      path: filePath,
      error: error.message
    };
  }
}

/**
 * Run the quick analysis
 */
function runQuickAnalysis() {
  console.log('Running quick analysis...');
  
  const results = {
    timestamp: new Date().toISOString(),
    servers: {},
    config: null
  };
  
  // Analyze each server implementation
  for (const [key, filePath] of Object.entries(CONFIG.serverFiles)) {
    const fullPath = path.resolve(CONFIG.rootDir, filePath);
    results.servers[key] = analyzeServer(fullPath);
  }
  
  // Analyze Claude desktop config
  const configPath = path.resolve(CONFIG.rootDir, CONFIG.configFile);
  results.config = analyzeClaudeConfig(configPath);
  
  // Write results to file
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(results, null, 2), 'utf8');
  
  // Print a summary to console
  console.log('Analysis complete! Results saved to:', CONFIG.outputFile);
  console.log('\nQuick summary:');
  
  // Server implementations
  console.log('\nServer Implementations:');
  for (const [key, server] of Object.entries(results.servers)) {
    if (server.exists) {
      console.log(`- ${key}: ${server.lineCount} lines, ${server.tools.length} tools, uses database: ${server.usesDatabase}`);
      console.log(`  Tools: ${server.tools.join(', ')}`);
    } else {
      console.log(`- ${key}: Not found!`);
    }
  }
  
  // Config issues
  if (results.config && results.config.issues) {
    console.log('\nConfig Issues:');
    for (const issue of results.config.issues) {
      console.log(`- ${issue.serverName}: Missing file ${issue.missingFile}`);
    }
  }
  
  // Tool overlaps
  const allTools = new Set();
  const toolOverlap = {};
  
  for (const [key, server] of Object.entries(results.servers)) {
    if (server.exists && server.tools) {
      server.tools.forEach(tool => {
        if (!toolOverlap[tool]) toolOverlap[tool] = [];
        toolOverlap[tool].push(key);
        allTools.add(tool);
      });
    }
  }
  
  console.log('\nTool Distribution:');
  for (const tool of Array.from(allTools).sort()) {
    console.log(`- ${tool}: ${toolOverlap[tool].join(', ')}`);
  }
  
  return results;
}

// Run the analysis if executed directly
if (require.main === module) {
  runQuickAnalysis();
}

module.exports = { runQuickAnalysis };
