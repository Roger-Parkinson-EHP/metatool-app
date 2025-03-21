/**
 * repo-structure.js
 * 
 * Repository structure analysis module that maps directories, files, and relationships
 */

const fs = require('fs');
const path = require('path');
const utils = require('../analyzer-utils');

/**
 * Build a complete map of the repository directory structure
 */
function mapRepositoryStructure(config = {}) {
  const { rootDir, excludeDirs, includeExtensions, verbose } = utils.parseConfig(config);
  
  console.log(`Mapping repository structure for ${rootDir}...`);
  
  const result = {
    stats: {
      directories: 0,
      files: 0,
      filesByExtension: {},
      totalSize: 0,
      languages: {},
      lastModified: null
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
          if (excludeDirs.includes(entry.name)) {
            if (verbose) {
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
          if (!includeExtensions.includes(ext) && includeExtensions.length > 0) {
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
          
          // Track language stats
          const language = utils.detectLanguage(entryPath);
          if (!result.stats.languages[language]) {
            result.stats.languages[language] = 0;
          }
          result.stats.languages[language]++;
          
          // Track last modified date
          if (!result.stats.lastModified || stats.mtime > result.stats.lastModified) {
            result.stats.lastModified = stats.mtime;
          }
          
          // Add file to structure
          currentNode[entry.name] = {
            type: 'file',
            path: entryRelativePath,
            extension: ext,
            language: language,
            size: stats.size,
            sizeFormatted: utils.formatFileSize(stats.size),
            modified: stats.mtime
          };
        }
      }
    } catch (error) {
      console.error(`Error processing directory ${dirPath}:`, error.message);
    }
  }
  
  // Start mapping from root
  processDirectory(rootDir, '', result.structure);
  
  // Add summary information
  result.stats.totalSizeFormatted = utils.formatFileSize(result.stats.totalSize);
  result.stats.filesByExtensionSorted = Object.entries(result.stats.filesByExtension)
    .sort(([, countA], [, countB]) => countB - countA)
    .reduce((obj, [ext, count]) => {
      obj[ext || 'No extension'] = count;
      return obj;
    }, {});
  
  console.log(`Repository mapping complete: ${result.stats.directories} directories, ${result.stats.files} files, ${result.stats.totalSizeFormatted} total`);
  return result;
}

/**
 * Find files matching a pattern in the repository
 */
function findFilesByPattern(repoStructure, pattern) {
  const matches = [];
  
  function matchPattern(nodeName, node, currentPath) {
    if (node.type === 'file') {
      const fullPath = path.join(currentPath, nodeName);
      if (fullPath.match(pattern) || nodeName.match(pattern)) {
        matches.push({
          name: nodeName,
          path: fullPath,
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
  
  // Start matching from root
  for (const [nodeName, node] of Object.entries(repoStructure.structure)) {
    matchPattern(nodeName, node, '');
  }
  
  return matches;
}

/**
 * Find all test files in the repository
 */
function findTestFiles(repoStructure) {
  console.log('Identifying test files...');
  
  // Patterns for finding test files
  const testPatterns = [
    /test/i,
    /spec/i,
    /__tests__/i
  ];
  
  let testFiles = [];
  
  // Find all potential test files
  for (const pattern of testPatterns) {
    const matches = findFilesByPattern(repoStructure, pattern);
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
 * Analyze the repository structure and identify key files
 */
async function analyzeRepositoryStructure(config = {}) {
  const startTime = Date.now();
  const fullConfig = utils.parseConfig(config);
  
  console.log('Starting repository structure analysis...');
  
  // Step 1: Map the repository structure
  const repoStructure = mapRepositoryStructure(fullConfig);
  
  // Step 2: Find test files
  const testFiles = findTestFiles(repoStructure);
  
  // Step 3: Find core server files
  const serverPattern = /(server|mcp).+\.js$/;
  const serverFiles = findFilesByPattern(repoStructure, serverPattern)
    .filter(file => file.path.startsWith('scripts/'));
  
  // Step 4: Find configuration files
  const configPattern = /\.json$|\.config\.|config\./;
  const configFiles = findFilesByPattern(repoStructure, configPattern);
  
  // Create result object
  const result = {
    repoStructure,
    testFiles,
    serverFiles,
    configFiles,
    analysisTime: utils.formatElapsedTime(startTime)
  };
  
  // Save results if requested
  if (fullConfig.reportFormats.includes('json')) {
    utils.writeJsonOutput(fullConfig.outputDir, 'repo-structure-analysis.json', result);
  }
  
  console.log(`Repository structure analysis complete in ${result.analysisTime}`);
  return result;
}

module.exports = {
  mapRepositoryStructure,
  findFilesByPattern,
  findTestFiles,
  analyzeRepositoryStructure
};
