/**
 * import-analyzer.js
 * 
 * A utility to analyze imports and dependencies between files in the codebase
 * This helps identify which files depend on which, creating a dependency graph
 */

const fs = require('fs');
const path = require('path');

// Import the repository mapper
const repoMapper = require('./repo-mapper');

// Configuration - inherit from repo-mapper
const CONFIG = {
  ...repoMapper.CONFIG,
  // Only analyze JavaScript/TypeScript files for imports
  codeExtensions: ['.js', '.jsx', '.ts', '.tsx']
};

/**
 * Extract imports and requires from a JavaScript or TypeScript file
 */
function extractImports(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {
      filePath,
      requires: [],
      imports: [],
      dynamicImports: [],
      externalModules: new Set(),
      internalModules: new Set()
    };
    
    // Extract require statements
    const requireMatches = content.match(/require\s*\(['"]([^'"]+)['"]\)/g) || [];
    for (const match of requireMatches) {
      const moduleMatch = match.match(/require\s*\(['"]([^'"]+)['"]\)/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        const isExternal = !moduleName.startsWith('.');
        
        result.requires.push({
          module: moduleName,
          isExternal
        });
        
        if (isExternal) {
          result.externalModules.add(moduleName);
        } else {
          result.internalModules.add(moduleName);
        }
      }
    }
    
    // Extract import statements
    const importMatches = content.match(/import\s+(?:.+?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g) || [];
    for (const match of importMatches) {
      let moduleName;
      let isExternal;
      
      if (match.includes('import(')) {
        // Dynamic import
        const moduleMatch = match.match(/import\(['"]([^'"]+)['"]\)/);
        if (moduleMatch) {
          moduleName = moduleMatch[1];
          isExternal = !moduleName.startsWith('.');
          
          result.dynamicImports.push({
            module: moduleName,
            isExternal
          });
        }
      } else {
        // Regular import
        const moduleMatch = match.match(/from\s+['"]([^'"]+)['"]/) || match.match(/import\s+['"]([^'"]+)['"]/);
        if (moduleMatch) {
          moduleName = moduleMatch[1];
          isExternal = !moduleName.startsWith('.');
          
          result.imports.push({
            module: moduleName,
            isExternal
          });
        }
      }
      
      if (moduleName) {
        if (isExternal) {
          result.externalModules.add(moduleName);
        } else {
          result.internalModules.add(moduleName);
        }
      }
    }
    
    // Convert Sets to arrays for easier JSON serialization
    result.externalModules = Array.from(result.externalModules);
    result.internalModules = Array.from(result.internalModules);
    
    return result;
  } catch (error) {
    console.error(`Error extracting imports from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Build a dependency graph for all code files in the repository
 */
function buildDependencyGraph(repoData) {
  console.log('Building dependency graph...');
  
  const graph = {
    nodes: [],
    edges: [],
    stats: {
      totalFiles: 0,
      filesWithDependencies: 0,
      totalDependencies: 0,
      externalDependencies: new Set(),
      internalDependencies: 0
    }
  };
  
  // Convert the nested structure to a flat list of code files
  const codeFiles = [];
  
  function findCodeFiles(nodeName, node, currentPath) {
    if (node.type === 'file' && CONFIG.codeExtensions.includes(node.extension)) {
      const fullPath = path.join(CONFIG.rootDir, node.path);
      codeFiles.push({
        name: nodeName,
        path: node.path,
        fullPath,
        extension: node.extension
      });
    } else if (node.type === 'directory') {
      const dirPath = path.join(currentPath, nodeName);
      for (const [childName, child] of Object.entries(node.children)) {
        findCodeFiles(childName, child, dirPath);
      }
    }
  }
  
  for (const [nodeName, node] of Object.entries(repoData.structure)) {
    findCodeFiles(nodeName, node, '');
  }
  
  graph.stats.totalFiles = codeFiles.length;
  console.log(`Found ${codeFiles.length} code files to analyze`);
  
  // Create a node for each file
  for (const file of codeFiles) {
    graph.nodes.push({
      id: file.path,
      label: file.name,
      type: 'file',
      extension: file.extension
    });
    
    // Extract dependencies
    const imports = extractImports(file.fullPath);
    if (imports && (imports.internalModules.length > 0 || imports.externalModules.length > 0)) {
      graph.stats.filesWithDependencies++;
      graph.stats.totalDependencies += imports.internalModules.length + imports.externalModules.length;
      
      // Add all external dependencies to the global set
      for (const ext of imports.externalModules) {
        graph.stats.externalDependencies.add(ext);
      }
      
      // Create edges for internal dependencies
      for (const importPath of imports.internalModules) {
        // Resolve the relative import path
        let targetPath;
        
        try {
          if (importPath.startsWith('.')) {
            const sourceDirPath = path.dirname(file.path);
            targetPath = path.normalize(path.join(sourceDirPath, importPath));
          } else {
            targetPath = importPath;
          }
          
          // Handle extension-less imports
          if (!path.extname(targetPath)) {
            // Try to find a matching file with a supported extension
            const potentialMatches = codeFiles.filter(f => 
              f.path === targetPath + '.js' || 
              f.path === targetPath + '.jsx' || 
              f.path === targetPath + '.ts' || 
              f.path === targetPath + '.tsx' ||
              // Also check for index files
              f.path === path.join(targetPath, 'index.js') ||
              f.path === path.join(targetPath, 'index.jsx') ||
              f.path === path.join(targetPath, 'index.ts') ||
              f.path === path.join(targetPath, 'index.tsx')
            );
            
            if (potentialMatches.length > 0) {
              targetPath = potentialMatches[0].path;
            }
          }
          
          // Check if the target exists in our graph
          const targetExists = graph.nodes.some(node => node.id === targetPath);
          
          if (targetExists) {
            graph.edges.push({
              source: file.path,
              target: targetPath,
              type: 'imports'
            });
            
            graph.stats.internalDependencies++;
          }
        } catch (error) {
          // Skip problematic import paths
          console.warn(`Could not resolve import path ${importPath} in ${file.path}:`, error.message);
        }
      }
    }
  }
  
  // Convert external dependencies Set to array
  graph.stats.externalDependencies = Array.from(graph.stats.externalDependencies);
  
  console.log(`Dependency analysis complete: ${graph.stats.filesWithDependencies} files with dependencies, ${graph.stats.internalDependencies} internal dependencies, ${graph.stats.externalDependencies.length} external dependencies`);
  
  return graph;
}

/**
 * Find entry points in the codebase
 */
function findEntryPoints(repoData) {
  console.log('Finding entry points...');
  
  const entryPoints = [];
  
  // Common patterns for entry point files
  const patterns = [
    // Server files
    /server\.js$/i,
    /-server\.js$/i,
    // Main files
    /index\.js$/i,
    /main\.js$/i,
    // Script files in the scripts directory
    /^scripts\/.+\.js$/i,
    // Batch files
    /\.bat$/i
  ];
  
  // Check each pattern
  for (const pattern of patterns) {
    const matches = repoMapper.findFilesByPattern(repoData.structure, pattern);
    for (const match of matches) {
      // Avoid duplicates
      if (!entryPoints.find(e => e.path === match.path)) {
        entryPoints.push(match);
      }
    }
  }
  
  // Sort entry points by type
  const categorizedEntryPoints = {
    servers: entryPoints.filter(e => e.name.includes('server') || e.name.includes('Server')),
    scripts: entryPoints.filter(e => e.path.startsWith('scripts/')),
    batchFiles: entryPoints.filter(e => e.extension === '.bat'),
    other: entryPoints.filter(e => 
      !e.name.includes('server') && 
      !e.name.includes('Server') && 
      !e.path.startsWith('scripts/') && 
      e.extension !== '.bat'
    )
  };
  
  console.log(`Found ${entryPoints.length} potential entry points:`);
  console.log(`- ${categorizedEntryPoints.servers.length} servers`);
  console.log(`- ${categorizedEntryPoints.scripts.length} scripts`);
  console.log(`- ${categorizedEntryPoints.batchFiles.length} batch files`);
  console.log(`- ${categorizedEntryPoints.other.length} other entry points`);
  
  return categorizedEntryPoints;
}

/**
 * Main function to execute the import analysis
 */
function analyzeImports() {
  console.log('Starting import analysis...');
  
  // First get the repository structure
  const repoData = repoMapper.mapRepositoryStructure();
  
  // Build the dependency graph
  const dependencyGraph = buildDependencyGraph(repoData);
  repoMapper.writeJsonOutput('dependency-graph.json', dependencyGraph);
  
  // Find entry points
  const entryPoints = findEntryPoints(repoData);
  repoMapper.writeJsonOutput('entry-points.json', entryPoints);
  
  console.log('Import analysis complete!');
  return {
    repoData,
    dependencyGraph,
    entryPoints
  };
}

// Run the analysis if this module is executed directly
if (require.main === module) {
  analyzeImports();
}

module.exports = {
  analyzeImports,
  extractImports,
  buildDependencyGraph,
  findEntryPoints,
  CONFIG
};
