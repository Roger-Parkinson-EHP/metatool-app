/**
 * codebase-analyzer.js
 * 
 * A script to analyze the codebase and output a report of key components,
 * dependencies, and structure to help guide refactoring efforts.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  scriptDir: __dirname,
  outputDir: path.resolve(__dirname, '..', 'analysis-output'),
  targetFiles: [
    'scripts/unified-server.js',
    'scripts/simplified-rogerthat-server.js',
    'scripts/simplified-semantic-server.js',
    'scripts/rogerthat-server.js',
    'scripts/semantic-server.js',
    'config/claude_desktop_config.json'
  ]
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
 * Analyze file metadata and size information
 */
function analyzeFileMetadata(files) {
  const result = {};
  
  for (const file of files) {
    const filePath = path.resolve(CONFIG.rootDir, file);
    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lineCount = content.split('\n').length;
      
      result[file] = {
        size: stats.size,
        lastModified: stats.mtime,
        lineCount,
        exists: true
      };
    } catch (error) {
      result[file] = {
        exists: false,
        error: error.message
      };
    }
  }
  
  return result;
}

/**
 * Extract imports from JavaScript files
 */
function analyzeImports(files) {
  const result = {};
  
  for (const file of files) {
    const filePath = path.resolve(CONFIG.rootDir, file);
    if (!fs.existsSync(filePath)) {
      result[file] = { exists: false };
      continue;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
      const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]\)/g) || [];
      
      const requires = requireMatches.map(match => {
        const moduleName = match.match(/require\(['"]([^'"]+)['"]\)/)[1];
        return moduleName;
      });
      
      const imports = importMatches.map(match => {
        const moduleName = match.match(/from\s+['"]([^'"]+)['"]\)/)[1];
        return moduleName;
      });
      
      result[file] = {
        requires,
        imports,
        externalDependencies: [...new Set([...requires, ...imports])].filter(dep => !dep.startsWith('.')),
        internalDependencies: [...new Set([...requires, ...imports])].filter(dep => dep.startsWith('.'))
      };
    } catch (error) {
      result[file] = {
        exists: true,
        error: error.message
      };
    }
  }
  
  return result;
}

/**
 * Extract function and class definitions
 */
function analyzeStructure(files) {
  const result = {};
  
  for (const file of files) {
    const filePath = path.resolve(CONFIG.rootDir, file);
    if (!fs.existsSync(filePath)) {
      result[file] = { exists: false };
      continue;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Find function declarations
      const functionMatches = content.match(/function\s+([a-zA-Z0-9_]+)\s*\(/g) || [];
      const functionNames = functionMatches.map(match => {
        return match.match(/function\s+([a-zA-Z0-9_]+)\s*\(/)[1];
      });
      
      // Find class declarations
      const classMatches = content.match(/class\s+([a-zA-Z0-9_]+)/g) || [];
      const classNames = classMatches.map(match => {
        return match.match(/class\s+([a-zA-Z0-9_]+)/)[1];
      });
      
      // Find const/var/let assignments to functions
      const constFunctionMatches = content.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?function/g) || [];
      const constFunctionNames = constFunctionMatches.map(match => {
        return match.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=/)[1];
      });
      
      // Find arrow functions assigned to variables
      const arrowFunctionMatches = content.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g) || [];
      const arrowFunctionNames = arrowFunctionMatches.map(match => {
        return match.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=/)[1];
      });
      
      result[file] = {
        functions: [...functionNames, ...constFunctionNames, ...arrowFunctionNames],
        classes: classNames
      };
    } catch (error) {
      result[file] = {
        exists: true,
        error: error.message
      };
    }
  }
  
  return result;
}

/**
 * Find missing files and suggest locations
 */
function analyzeMissingFiles() {
  const configPath = path.resolve(CONFIG.rootDir, 'config/claude_desktop_config.json');
  if (!fs.existsSync(configPath)) {
    return { error: 'Config file not found' };
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const missingFiles = [];
    const resolvedFiles = [];
    
    // Check for missing files in MCP server configurations
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers || {})) {
      if (serverConfig.args && serverConfig.args.length > 0) {
        for (const arg of serverConfig.args) {
          if (typeof arg === 'string' && arg.includes('\\') && !arg.startsWith('-')) {
            // This might be a file path
            const filePath = arg.replace(/\\/g, '\\');
            const exists = fs.existsSync(filePath);
            
            if (!exists) {
              const possibleAlternatives = [
                'scripts/unified-server.js',
                'scripts/simplified-rogerthat-server.js',
                'scripts/simplified-semantic-server.js'
              ].filter(file => fs.existsSync(path.resolve(CONFIG.rootDir, file)));
              
              missingFiles.push({
                serverName,
                missingPath: filePath,
                possibleAlternatives: possibleAlternatives.map(alt => path.resolve(CONFIG.rootDir, alt))
              });
            } else {
              resolvedFiles.push({
                serverName,
                path: filePath
              });
            }
          }
        }
      }
    }
    
    return { missingFiles, resolvedFiles };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Main analysis function
 */
function analyzeCodebase() {
  console.log('Starting codebase analysis...');
  
  // Analyze file metadata
  const fileMetadata = analyzeFileMetadata(CONFIG.targetFiles);
  writeJsonOutput('file-metadata.json', fileMetadata);
  
  // Analyze imports/dependencies
  const importAnalysis = analyzeImports(CONFIG.targetFiles.filter(file => file.endsWith('.js')));
  writeJsonOutput('import-analysis.json', importAnalysis);
  
  // Analyze code structure
  const structureAnalysis = analyzeStructure(CONFIG.targetFiles.filter(file => file.endsWith('.js')));
  writeJsonOutput('structure-analysis.json', structureAnalysis);
  
  // Find missing files
  const missingFileAnalysis = analyzeMissingFiles();
  writeJsonOutput('missing-files.json', missingFileAnalysis);
  
  // Generate summary report
  const summary = {
    timestamp: new Date().toISOString(),
    targetFiles: CONFIG.targetFiles,
    existingFiles: CONFIG.targetFiles.filter(file => fileMetadata[file]?.exists),
    missingFiles: CONFIG.targetFiles.filter(file => !fileMetadata[file]?.exists),
    configIssues: missingFileAnalysis.missingFiles || [],
    dependencyStructure: Object.entries(importAnalysis).reduce((acc, [file, analysis]) => {
      if (analysis.externalDependencies) {
        acc[file] = analysis.externalDependencies;
      }
      return acc;
    }, {})
  };
  
  writeJsonOutput('summary.json', summary);
  
  // Console output
  console.log('\nAnalysis completed! Reports saved to:', CONFIG.outputDir);
  console.log('\nSummary:');
  console.log('- Analyzed files:', CONFIG.targetFiles.length);
  console.log('- Existing files:', summary.existingFiles.length);
  console.log('- Missing files:', summary.missingFiles.length);
  console.log('- Config issues:', summary.configIssues.length);
  
  return summary;
}

// Run the analysis if this module is executed directly
if (require.main === module) {
  analyzeCodebase();
}

module.exports = {
  analyzeCodebase,
  CONFIG
};
