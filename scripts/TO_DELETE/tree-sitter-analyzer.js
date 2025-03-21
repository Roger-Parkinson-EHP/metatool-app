/**
 * tree-sitter-analyzer.js
 * 
 * Advanced code analysis using Tree Sitter queries to extract detailed information
 * about the codebase structure, dependencies, and patterns.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  scriptDir: __dirname,
  outputDir: path.resolve(__dirname, '..', 'analysis-output'),
  targetFiles: {
    unified: 'scripts/unified-server.js',
    simplifiedRogerthat: 'scripts/simplified-rogerthat-server.js',
    simplifiedSemantic: 'scripts/simplified-semantic-server.js',
    config: 'config/claude_desktop_config.json'
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
 * Extract server schema details
 * This includes:  
 * - Server configuration
 * - Tool definitions
 * - Environment variable usage
 * - Database interactions
 */
function extractServerSchema(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {
      serverInfo: {},
      tools: [],
      envVars: [],
      requestHandlers: [],
      databaseOperations: [],
    };

    // Extract server info
    const serverInfoMatch = content.match(/name:\s*['"](.*?)['"],\s*\n\s*description:\s*['"](.*?)['"],\s*\n\s*version:\s*['"](.*?)['"],/s);
    if (serverInfoMatch) {
      result.serverInfo = {
        name: serverInfoMatch[1],
        description: serverInfoMatch[2],
        version: serverInfoMatch[3]
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
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const toolName = match[pattern.nameIndex];
        const description = match[pattern.descIndex];
        const schemaStr = match[pattern.schemaIndex];
        
        // Check if we already have this tool
        if (!result.tools.some(tool => tool.name === toolName)) {
          result.tools.push({
            name: toolName,
            description,
            schema: schemaStr
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
    const handlerMatches = content.match(/setRequestHandler\s*\(\s*['"]([^'"]+)['"]|setRequestHandler\s*\(\s*(\w+)\s*,/g) || [];
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
        regex: /db\.(?:all|get|run)\s*\(\s*['"](.*?)['"]|\w+\.query\s*\(\s*['"](.*?)['"]|(?:find|findOne|findMany|create|update|delete)\s*\(/g
      },
      {
        type: 'table',
        regex: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\s*['"]?([\w_]+)['"]?/gi
      },
      {
        type: 'driver',
        regex: /new\s+(?:(SQLite|sqlite3|pg|postgres|mysql|mongodb)\.\w+)|require\s*\(['"](?:sqlite3|pg|mysql|mongodb)['"]\)/g
      }
    ];

    for (const pattern of dbOperationPatterns) {
      const matches = content.match(pattern.regex) || [];
      for (const match of matches) {
        result.databaseOperations.push({
          type: pattern.type,
          operation: match.trim()
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
 * Extract imports, requires and module dependencies
 */
function extractDependencies(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {
      imports: [],
      requires: [],
      externalModules: [],
      internalModules: []
    };

    // Extract require statements
    const requireMatches = content.match(/(?:const|let|var)\s+(?:\{[^}]*\}\s+|\w+\s+)?=\s*require\(['"]([^'"]+)['"]\)/g) || [];
    for (const match of requireMatches) {
      const moduleMatch = match.match(/require\(['"]([^'"]+)['"]\)/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        result.requires.push({
          module: moduleName,
          isExternal: !moduleName.startsWith('.')
        });
        
        if (moduleName.startsWith('.')) {
          result.internalModules.push(moduleName);
        } else {
          result.externalModules.push(moduleName);
        }
      }
    }

    // Extract import statements
    const importMatches = content.match(/import\s+(?:\{[^}]*\}\s+|\w+\s+)?from\s+['"]([^'"]+)['"]\s*/g) || [];
    for (const match of importMatches) {
      const moduleMatch = match.match(/from\s+['"]([^'"]+)['"]/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        result.imports.push({
          module: moduleName,
          isExternal: !moduleName.startsWith('.')
        });
        
        if (moduleName.startsWith('.')) {
          result.internalModules.push(moduleName);
        } else {
          result.externalModules.push(moduleName);
        }
      }
    }

    // Remove duplicates
    result.externalModules = [...new Set(result.externalModules)];
    result.internalModules = [...new Set(result.internalModules)];

    return result;
  } catch (error) {
    console.error(`Error extracting dependencies from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract class and function definitions
 */
function extractFunctionsAndClasses(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {
      classes: [],
      functions: [],
      exports: []
    };

    // Extract class declarations
    const classMatches = content.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g) || [];
    for (const match of classMatches) {
      const classMatch = match.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?/);
      if (classMatch) {
        result.classes.push({
          name: classMatch[1],
          extends: classMatch[2] || null
        });
      }
    }

    // Extract methods within classes
    for (const classObj of result.classes) {
      const classRegex = new RegExp(`class\s+${classObj.name}[^{]*\{([\s\S]*?)\n\}\s*$`, 'm');
      const classMatch = content.match(classRegex);
      if (classMatch) {
        const classBody = classMatch[1];
        const methodMatches = classBody.match(/(?:async\s+)?(?:\w+\s*\([^)]*\)|constructor\s*\([^)]*\))\s*\{/g) || [];
        
        classObj.methods = [];
        for (const method of methodMatches) {
          const methodMatch = method.match(/(async\s+)?(\w+)\s*\([^)]*\)/);
          if (methodMatch) {
            classObj.methods.push({
              name: methodMatch[2],
              isAsync: !!methodMatch[1]
            });
          }
        }
      }
    }

    // Extract function declarations
    const functionPatterns = [
      // Regular function declarations
      { 
        regex: /function\s+(\w+)\s*\([^)]*\)\s*\{/g,
        nameIndex: 1
      },
      // Arrow functions assigned to constants
      {
        regex: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,
        nameIndex: 1
      },
      // Regular functions assigned to constants
      {
        regex: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?function\s*\([^)]*\)\s*\{/g,
        nameIndex: 1
      }
    ];

    for (const pattern of functionPatterns) {
      const matches = content.match(pattern.regex) || [];
      for (const match of matches) {
        const nameMatch = match.match(pattern.regex);
        if (nameMatch) {
          const name = nameMatch[pattern.nameIndex];
          const isAsync = match.includes('async');
          result.functions.push({ name, isAsync });
        }
      }
    }

    // Extract module.exports
    const exportsMatch = content.match(/module\.exports\s*=\s*\{([^}]*)\}/s);
    if (exportsMatch) {
      const exportsList = exportsMatch[1].split(',').map(e => e.trim()).filter(e => e !== '');
      result.exports = exportsList;
    }

    return result;
  } catch (error) {
    console.error(`Error extracting functions and classes from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Analyze the claude_desktop_config.json to find server configuration issues
 */
function analyzeClaudeConfig(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    const result = {
      servers: [],
      missingFiles: [],
      validFiles: []
    };

    if (config.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
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
 * Generate the replacement file path for missing files
 */
function generateReplacementPaths(config, missingFiles) {
  const result = [];
  
  for (const missingFile of missingFiles) {
    // Generate potential replacements
    const replacements = [
      path.resolve(CONFIG.rootDir, 'scripts/unified-server.js'),
      path.resolve(CONFIG.rootDir, 'scripts/simplified-rogerthat-server.js'),
      path.resolve(CONFIG.rootDir, 'scripts/simplified-semantic-server.js')
    ].filter(filePath => fs.existsSync(filePath));
    
    result.push({
      serverName: missingFile.serverName,
      missingPath: missingFile.filePath,
      replacements
    });
  }
  
  return result;
}

/**
 * Main analysis function
 */
function analyzeWithTreeSitter() {
  console.log('Starting advanced Tree Sitter analysis...');
  
  const results = {};
  
  // Analyze each target file
  for (const [fileKey, filePath] of Object.entries(CONFIG.targetFiles)) {
    const fullPath = path.resolve(CONFIG.rootDir, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      results[fileKey] = { exists: false };
      continue;
    }
    
    console.log(`Analyzing ${fileKey}: ${filePath}`);
    
    // Special handling for config file
    if (fileKey === 'config') {
      results[fileKey] = {
        exists: true,
        config: analyzeClaudeConfig(fullPath)
      };
      continue;
    }
    
    // Analyze JavaScript server files
    results[fileKey] = {
      exists: true,
      schema: extractServerSchema(fullPath),
      dependencies: extractDependencies(fullPath),
      structure: extractFunctionsAndClasses(fullPath),
      filePath: filePath
    };
  }
  
  // Generate recommendations for missing files
  if (results.config?.config?.missingFiles?.length > 0) {
    results.recommendations = {
      replacements: generateReplacementPaths(CONFIG, results.config.config.missingFiles)
    };
  }
  
  // Write the detailed analysis
  writeJsonOutput('tree-sitter-analysis.json', results);
  
  // Generate recommended config updates
  const recommendedUpdates = {};
  
  if (results.recommendations?.replacements) {
    for (const replacement of results.recommendations.replacements) {
      if (replacement.replacements.length > 0) {
        recommendedUpdates[replacement.serverName] = {
          missingFile: replacement.missingPath,
          recommendedReplacement: replacement.replacements[0],
          otherOptions: replacement.replacements.slice(1)
        };
      }
    }
  }
  
  writeJsonOutput('recommended-updates.json', recommendedUpdates);
  
  // Generate a simplified server comparison summary
  const comparison = {
    unifiedServer: results.unified?.schema,
    simplifiedRogerthat: results.simplifiedRogerthat?.schema,
    simplifiedSemantic: results.simplifiedSemantic?.schema,
    summary: {
      tools: {
        unified: results.unified?.schema?.tools?.length || 0,
        simplifiedRogerthat: results.simplifiedRogerthat?.schema?.tools?.length || 0,
        simplifiedSemantic: results.simplifiedSemantic?.schema?.tools?.length || 0
      },
      requestHandlers: {
        unified: results.unified?.schema?.requestHandlers?.length || 0,
        simplifiedRogerthat: results.simplifiedRogerthat?.schema?.requestHandlers?.length || 0,
        simplifiedSemantic: results.simplifiedSemantic?.schema?.requestHandlers?.length || 0
      },
      classes: {
        unified: results.unified?.structure?.classes?.length || 0,
        simplifiedRogerthat: results.simplifiedRogerthat?.structure?.classes?.length || 0,
        simplifiedSemantic: results.simplifiedSemantic?.structure?.classes?.length || 0
      },
      functions: {
        unified: results.unified?.structure?.functions?.length || 0,
        simplifiedRogerthat: results.simplifiedRogerthat?.structure?.functions?.length || 0,
        simplifiedSemantic: results.simplifiedSemantic?.structure?.functions?.length || 0
      },
      usesDatabases: {
        unified: results.unified?.schema?.databaseOperations?.length > 0,
        simplifiedRogerthat: results.simplifiedRogerthat?.schema?.databaseOperations?.length > 0,
        simplifiedSemantic: results.simplifiedSemantic?.schema?.databaseOperations?.length > 0
      }
    }
  };
  
  writeJsonOutput('server-comparison-summary.json', comparison);
  
  // Print summary
  console.log('\nAnalysis complete! Results saved to:', CONFIG.outputDir);
  
  console.log('\nKey findings:');
  if (results.recommendations?.replacements) {
    console.log(`- Found ${results.recommendations.replacements.length} missing files in config`);
    console.log('- Recommended replacements:');
    for (const replacement of results.recommendations.replacements) {
      console.log(`  * ${replacement.serverName}: Use ${replacement.replacements[0]}`);
    }
  }
  
  console.log('\nServer complexity comparison:');
  console.log(`- Unified server: ${comparison.summary.functions.unified} functions, ${comparison.summary.classes.unified} classes, ${comparison.summary.tools.unified} tools`);
  console.log(`- Simplified RogerThat: ${comparison.summary.functions.simplifiedRogerthat} functions, ${comparison.summary.classes.simplifiedRogerthat} classes, ${comparison.summary.tools.simplifiedRogerthat} tools`);
  console.log(`- Simplified Semantic: ${comparison.summary.functions.simplifiedSemantic} functions, ${comparison.summary.classes.simplifiedSemantic} classes, ${comparison.summary.tools.simplifiedSemantic} tools`);
  
  console.log('\nDatabase usage:');
  console.log(`- Unified server: ${comparison.summary.usesDatabases.unified ? 'Yes' : 'No'}`);
  console.log(`- Simplified RogerThat: ${comparison.summary.usesDatabases.simplifiedRogerthat ? 'Yes' : 'No'}`);
  console.log(`- Simplified Semantic: ${comparison.summary.usesDatabases.simplifiedSemantic ? 'Yes' : 'No'}`);
  
  return results;
}

// Run the analysis if this module is executed directly
if (require.main === module) {
  analyzeWithTreeSitter();
}

module.exports = {
  analyzeWithTreeSitter,
  CONFIG
};
