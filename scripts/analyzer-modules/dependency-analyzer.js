/**
 * dependency-analyzer.js
 * 
 * Module for analyzing dependencies and imports between files
 */

const fs = require('fs');
const path = require('path');
const utils = require('../analyzer-utils');

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
function buildDependencyGraph(repoStructure, config = {}) {
  const { rootDir, outputDir, verbose } = utils.parseConfig(config);
  console.log('Building dependency graph...');
  
  const codeExtensions = ['.js', '.jsx', '.ts', '.tsx'];
  
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
    if (node.type === 'file' && codeExtensions.includes(node.extension)) {
      const fullPath = path.join(rootDir, node.path);
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
  
  for (const [nodeName, node] of Object.entries(repoStructure.structure)) {
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
          if (verbose) {
            console.warn(`Could not resolve import path ${importPath} in ${file.path}:`, error.message);
          }
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
function findEntryPoints(repoStructure, config = {}) {
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
  
  function findFilesByPattern(structure, pattern) {
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
    for (const [nodeName, node] of Object.entries(structure)) {
      matchPattern(nodeName, node, '');
    }
    
    return matches;
  }
  
  // Check each pattern
  for (const pattern of patterns) {
    const matches = findFilesByPattern(repoStructure.structure, pattern);
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
 * Identify circular dependencies in the codebase
 */
function findCircularDependencies(dependencyGraph) {
  console.log('Checking for circular dependencies...');
  
  const circularDependencies = [];
  const visited = new Set();
  const recursionStack = new Set();
  
  // Build adjacency list for DFS
  const adjacencyList = {};
  for (const edge of dependencyGraph.edges) {
    if (!adjacencyList[edge.source]) {
      adjacencyList[edge.source] = [];
    }
    adjacencyList[edge.source].push(edge.target);
  }
  
  // DFS function to detect cycles
  function detectCycle(node, path = []) {
    if (!adjacencyList[node]) {
      return false;
    }
    
    if (recursionStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      circularDependencies.push(cycle);
      return true;
    }
    
    if (visited.has(node)) {
      return false;
    }
    
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    for (const neighbor of (adjacencyList[node] || [])) {
      if (detectCycle(neighbor, [...path])) {
        return true;
      }
    }
    
    recursionStack.delete(node);
    path.pop();
    return false;
  }
  
  // Check each node
  for (const node of dependencyGraph.nodes) {
    if (!visited.has(node.id)) {
      detectCycle(node.id);
    }
  }
  
  // Remove duplicates
  const uniqueCircular = [];
  for (const cycle of circularDependencies) {
    const sorted = [...cycle].sort();
    const key = sorted.join(',');
    if (!uniqueCircular.some(c => [...c].sort().join(',') === key)) {
      uniqueCircular.push(cycle);
    }
  }
  
  console.log(`Found ${uniqueCircular.length} circular dependencies`);
  return uniqueCircular;
}

/**
 * Analyze external dependencies used in the codebase
 */
function analyzeExternalDependencies(dependencyGraph) {
  console.log('Analyzing external dependencies...');
  
  const externalDeps = dependencyGraph.stats.externalDependencies;
  const filesByDependency = {};
  
  // Group files by external dependency
  for (const node of dependencyGraph.nodes) {
    const imports = extractImports(node.id);
    if (imports) {
      for (const ext of imports.externalModules) {
        if (!filesByDependency[ext]) {
          filesByDependency[ext] = [];
        }
        filesByDependency[ext].push(node.id);
      }
    }
  }
  
  // Sort dependencies by usage
  const sortedDependencies = Object.entries(filesByDependency)
    .sort(([, filesA], [, filesB]) => filesB.length - filesA.length)
    .map(([dep, files]) => ({
      name: dep,
      usageCount: files.length,
      files: files
    }));
  
  return {
    totalDependencies: externalDeps.length,
    dependencies: sortedDependencies
  };
}

/**
 * Run a complete dependency analysis
 */
async function analyzeDependencies(repoStructure, config = {}) {
  const startTime = Date.now();
  const fullConfig = utils.parseConfig(config);
  
  console.log('Starting dependency analysis...');
  
  // Build dependency graph
  const dependencyGraph = buildDependencyGraph(repoStructure, fullConfig);
  
  // Find entry points
  const entryPoints = findEntryPoints(repoStructure, fullConfig);
  
  // Find circular dependencies
  const circularDependencies = findCircularDependencies(dependencyGraph);
  
  // Analyze external dependencies
  const externalDependencies = analyzeExternalDependencies(dependencyGraph);
  
  // Create result object
  const result = {
    dependencyGraph,
    entryPoints,
    circularDependencies,
    externalDependencies,
    analysisTime: utils.formatElapsedTime(startTime)
  };
  
  // Save results if requested
  if (fullConfig.reportFormats.includes('json')) {
    utils.writeJsonOutput(fullConfig.outputDir, 'dependency-analysis.json', result);
  }
  
  console.log(`Dependency analysis complete in ${result.analysisTime}`);
  return result;
}

module.exports = {
  extractImports,
  buildDependencyGraph,
  findEntryPoints,
  findCircularDependencies,
  analyzeExternalDependencies,
  analyzeDependencies
};
