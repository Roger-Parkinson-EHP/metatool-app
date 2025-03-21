/**
 * repo-mapper.js
 * 
 * A utility to create a complete map of a repository structure, including:
 * - Full directory and file hierarchy
 * - Relationships between files (imports, requires)
 * - Test coverage mapping
 * - Main execution paths
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  outputDir: path.resolve(__dirname, '..', 'analysis-output'),
  excludeDirs: ['node_modules', '.git', '.next', 'dist', '.venv', '.venv-python-repl'],
  includeExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.md', '.json', '.bat'],
  verbose: true
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
 * Build a complete map of the repository directory structure
 * This is the first step in understanding the codebase
 */
function mapRepositoryStructure() {
  console.log(`Mapping repository structure for ${CONFIG.rootDir}...`);
  
  const result = {
    stats: {
      directories: 0,
      files: 0,
      filesByExtension: {},
      totalSize: 0
    },
    structure: {}
  };
  
  function processDirectory(dirPath, relativePath, currentNode) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      result.stats.directories++;
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (CONFIG.excludeDirs.includes(entry.name)) {
            if (CONFIG.verbose) {
              console.log(`  Skipping excluded directory: ${entryRelativePath}`);
            }
            continue;
          }
          
          currentNode[entry.name] = { 
            type: 'directory',
            path: entryRelativePath,
            children: {}
          };
          
          processDirectory(entryPath, entryRelativePath, currentNode[entry.name].children);
        } else if (entry.isFile()) {
          // Check file extension
          const ext = path.extname(entry.name).toLowerCase();
          if (!CONFIG.includeExtensions.includes(ext) && CONFIG.includeExtensions.length > 0) {
            continue;
          }
          
          // Get file stats
          const stats = fs.statSync(entryPath);
          result.stats.files++;
          result.stats.totalSize += stats.size;
          
          // Update extension stats
          if (!result.stats.filesByExtension[ext]) {
            result.stats.filesByExtension[ext] = 0;
          }
          result.stats.filesByExtension[ext]++;
          
          // Add file to structure
          currentNode[entry.name] = {
            type: 'file',
            path: entryRelativePath,
            extension: ext,
            size: stats.size,
            modified: stats.mtime
          };
        }
      }
    } catch (error) {
      console.error(`Error processing directory ${dirPath}:`, error.message);
    }
  }
  
  // Start mapping from root
  processDirectory(CONFIG.rootDir, '', result.structure);
  
  console.log(`Repository mapping complete: ${result.stats.directories} directories, ${result.stats.files} files, ${Math.round(result.stats.totalSize / 1024 / 1024)}MB total`);
  return result;
}

/**
 * List all files with a specific pattern
 * Useful for finding specific types of files (tests, servers, etc.)
 */
function findFilesByPattern(structure, pattern) {
  const matches = [];
  
  function matchPattern(nodeName, node, currentPath) {
    if (node.type === 'file') {
      if (path.join(currentPath, nodeName).match(pattern)) {
        matches.push({
          name: nodeName,
          ...node
        });
      }
    } else if (node.type === 'directory') {
      const dirPath = path.join(currentPath, nodeName);
      for (const [childName, child] of Object.entries(node.children)) {
        matchPattern(childName, child, dirPath);
      }
    }
  }
  
  for (const [nodeName, node] of Object.entries(structure)) {
    matchPattern(nodeName, node, '');
  }
  
  return matches;
}

/**
 * Identify test files and the code they test
 */
function mapTestFiles(repoData) {
  console.log('Identifying test files...');
  
  // Patterns for finding test files
  const testPatterns = [
    /test/i,
    /spec/i,
    /__tests__/i
  ];
  
  const testFiles = [];
  
  // Find all potential test files
  for (const pattern of testPatterns) {
    const matches = findFilesByPattern(repoData.structure, pattern);
    for (const match of matches) {
      if (['.js', '.jsx', '.ts', '.tsx'].includes(match.extension)) {
        // Avoid duplicates
        if (!testFiles.find(f => f.path === match.path)) {
          testFiles.push(match);
        }
      }
    }
  }
  
  console.log(`Found ${testFiles.length} potential test files`);
  return testFiles;
}

/**
 * Main function to execute the repository mapping
 */
function analyzeRepository() {
  console.log('Starting repository analysis...');
  
  // Step 1: Map the repository structure
  const repoData = mapRepositoryStructure();
  writeJsonOutput('repo-structure.json', repoData);
  
  // Step 2: Identify test files
  const testFiles = mapTestFiles(repoData);
  writeJsonOutput('test-files.json', testFiles);
  
  console.log('Repository analysis complete!');
  return {
    repoData,
    testFiles
  };
}

// Run the analysis if this module is executed directly
if (require.main === module) {
  analyzeRepository();
}

module.exports = {
  analyzeRepository,
  mapRepositoryStructure,
  findFilesByPattern,
  mapTestFiles,
  CONFIG
};
