/**
 * server-comparison-analyzer.js
 * 
 * A script to compare functionality between the unified server and simplified server implementations
 * to help guide refactoring and simplification efforts.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  scriptDir: __dirname,
  outputDir: path.resolve(__dirname, '..', 'analysis-output'),
  serverFiles: {
    unified: 'scripts/unified-server.js',
    simplifiedRogerthat: 'scripts/simplified-rogerthat-server.js',
    simplifiedSemantic: 'scripts/simplified-semantic-server.js'
  }
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

/**
 * Write a JSON file to the output directory
 */
function writeJsonOutput(filename, data) {
  const filePath = path.join(CONFIG.outputDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${filePath}`);
  return filePath;
}

/**
 * Extract tool definitions from a server file
 */
function extractTools(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const tools = [];
    
    // Find tool names defined in tools/list handler
    const toolListMatch = content.match(/tools\/list[^{]*{([^}]*)}\s*\)/s);
    if (toolListMatch) {
      const nameMatches = toolListMatch[1].match(/name: ['"](\w+)['"]\s*,/g) || [];
      for (const match of nameMatches) {
        const name = match.match(/['"](\w+)['"]\s*,/)[1];
        tools.push(name);
      }
    }
    
    // Find tools defined in createServer configuration
    const createServerMatch = content.match(/createServer\(\s*{([^}]*)}\s*\)/s);
    if (createServerMatch) {
      const toolsMatch = createServerMatch[1].match(/tools:\s*\[(.*?)\]\s*,/s);
      if (toolsMatch) {
        const nameMatches = toolsMatch[1].match(/name:\s*['"](\w+)['"]\s*,/g) || [];
        for (const match of nameMatches) {
          const name = match.match(/['"](\w+)['"]\s*,/)[1];
          if (!tools.includes(name)) {
            tools.push(name);
          }
        }
      }
    }
    
    // Find tools defined in tools/call handler switch cases
    const switchCaseMatches = content.match(/case\s+['"]([\w_]+)['"]\s*:/g) || [];
    for (const match of switchCaseMatches) {
      const name = match.match(/case\s+['"]([\w_]+)['"]\s*:/)[1];
      if (!tools.includes(name)) {
        tools.push(name);
      }
    }
    
    return tools;
  } catch (error) {
    console.error(`Error extracting tools from ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Extract environment variables used in the server
 */
function extractEnvironmentVariables(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const envVars = new Set();
    
    // Find process.env.XXX occurrences
    const envMatches = content.match(/process\.env\.(\w+)/g) || [];
    for (const match of envMatches) {
      const varName = match.replace('process.env.', '');
      envVars.add(varName);
    }
    
    return Array.from(envVars);
  } catch (error) {
    console.error(`Error extracting env vars from ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Extract request handlers from the server
 */
function extractRequestHandlers(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const handlers = new Set();
    
    // Find setRequestHandler calls
    const handlerMatches = content.match(/setRequestHandler\(['"]([^'"]+)['"]|setRequestHandler\(\w+\s*,\s*async/g) || [];
    for (const match of handlerMatches) {
      const nameMatch = match.match(/['"]([^'"]+)['"]/);
      if (nameMatch) {
        handlers.add(nameMatch[1]);
      }
    }
    
    return Array.from(handlers);
  } catch (error) {
    console.error(`Error extracting request handlers from ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Extract databases used in the server
 */
function extractDatabases(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const databases = {
      sqlite: content.includes('sqlite3'),
      postgres: content.includes('pg') || content.includes('postgres'),
      mysql: content.includes('mysql'),
      mongodb: content.includes('mongodb'),
      drizzle: content.includes('drizzle'),
      prisma: content.includes('prisma'),
      sequelize: content.includes('sequelize'),
      typeorm: content.includes('typeorm'),
      usesDatabases: false
    };
    
    databases.usesDatabases = Object.values(databases).some(val => val === true);
    
    return databases;
  } catch (error) {
    console.error(`Error extracting databases from ${filePath}:`, error.message);
    return { usesDatabases: false };
  }
}

/**
 * Main comparison function
 */
function compareServers() {
  console.log('Starting server comparison analysis...');
  
  const result = {};
  
  // Extract tools from each server
  for (const [serverName, filePath] of Object.entries(CONFIG.serverFiles)) {
    const fullPath = path.resolve(CONFIG.rootDir, filePath);
    
    if (!fs.existsSync(fullPath)) {
      result[serverName] = { exists: false };
      continue;
    }
    
    const tools = extractTools(fullPath);
    const envVars = extractEnvironmentVariables(fullPath);
    const requestHandlers = extractRequestHandlers(fullPath);
    const databases = extractDatabases(fullPath);
    
    result[serverName] = {
      exists: true,
      filePath,
      tools,
      envVars,
      requestHandlers,
      databases
    };
  }
  
  // Compare functionality
  const comparison = {
    timestamp: new Date().toISOString(),
    serverFiles: CONFIG.serverFiles,
    serverDetails: result,
    // Tools comparison
    toolsComparison: {
      unifiedOnly: result.unified?.tools.filter(tool => 
        !result.simplifiedRogerthat?.tools.includes(tool) && 
        !result.simplifiedSemantic?.tools.includes(tool)) || [],
      inSimplified: result.unified?.tools.filter(tool => 
        result.simplifiedRogerthat?.tools.includes(tool) || 
        result.simplifiedSemantic?.tools.includes(tool)) || [],
      total: {
        unified: result.unified?.tools.length || 0,
        simplifiedRogerthat: result.simplifiedRogerthat?.tools.length || 0,
        simplifiedSemantic: result.simplifiedSemantic?.tools.length || 0
      }
    },
    // Environment variables comparison
    envVarsComparison: {
      unifiedOnly: result.unified?.envVars.filter(env => 
        !result.simplifiedRogerthat?.envVars.includes(env) && 
        !result.simplifiedSemantic?.envVars.includes(env)) || [],
      inSimplified: result.unified?.envVars.filter(env => 
        result.simplifiedRogerthat?.envVars.includes(env) || 
        result.simplifiedSemantic?.envVars.includes(env)) || [],
      total: {
        unified: result.unified?.envVars.length || 0,
        simplifiedRogerthat: result.simplifiedRogerthat?.envVars.length || 0,
        simplifiedSemantic: result.simplifiedSemantic?.envVars.length || 0
      }
    },
    // Request handlers comparison
    handlersComparison: {
      unifiedOnly: result.unified?.requestHandlers.filter(handler => 
        !result.simplifiedRogerthat?.requestHandlers.includes(handler) && 
        !result.simplifiedSemantic?.requestHandlers.includes(handler)) || [],
      inSimplified: result.unified?.requestHandlers.filter(handler => 
        result.simplifiedRogerthat?.requestHandlers.includes(handler) || 
        result.simplifiedSemantic?.requestHandlers.includes(handler)) || [],
      total: {
        unified: result.unified?.requestHandlers.length || 0,
        simplifiedRogerthat: result.simplifiedRogerthat?.requestHandlers.length || 0,
        simplifiedSemantic: result.simplifiedSemantic?.requestHandlers.length || 0
      }
    },
    // Database usage comparison
    databasesComparison: {
      unified: result.unified?.databases || { usesDatabases: false },
      simplifiedRogerthat: result.simplifiedRogerthat?.databases || { usesDatabases: false },
      simplifiedSemantic: result.simplifiedSemantic?.databases || { usesDatabases: false }
    }
  };
  
  writeJsonOutput('server-comparison.json', comparison);
  
  // Generate summary
  console.log('\nServer Comparison Summary:');
  console.log('=========================\n');
  
  console.log('Tools:');
  console.log(`- Unified server: ${comparison.toolsComparison.total.unified} tools`);
  console.log(`- Tools only in unified server: ${comparison.toolsComparison.unifiedOnly.join(', ')}`);
  console.log(`- Tools shared with simplified servers: ${comparison.toolsComparison.inSimplified.join(', ')}`);
  
  console.log('\nEnvironment Variables:');
  console.log(`- Unified server: ${comparison.envVarsComparison.total.unified} env vars`);
  console.log(`- Env vars only in unified server: ${comparison.envVarsComparison.unifiedOnly.join(', ')}`);
  
  console.log('\nRequest Handlers:');
  console.log(`- Unified server: ${comparison.handlersComparison.total.unified} handlers`);
  console.log(`- Handlers only in unified server: ${comparison.handlersComparison.unifiedOnly.join(', ')}`);
  
  console.log('\nDatabase Usage:');
  console.log(`- Unified server uses databases: ${comparison.databasesComparison.unified.usesDatabases}`);
  console.log(`- Simplified RogerThat uses databases: ${comparison.databasesComparison.simplifiedRogerthat.usesDatabases}`);
  console.log(`- Simplified Semantic uses databases: ${comparison.databasesComparison.simplifiedSemantic.usesDatabases}`);
  
  return comparison;
}

// Run the comparison if this module is executed directly
if (require.main === module) {
  compareServers();
}

module.exports = {
  compareServers,
  CONFIG
};
