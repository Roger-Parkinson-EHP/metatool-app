/**
 * test-coverage-analyzer.js
 * 
 * A utility to analyze test coverage in the codebase
 * This helps identify which code is tested and which isn't
 */

const fs = require('fs');
const path = require('path');

// Import the repository mapper and import analyzer
const repoMapper = require('./repo-mapper');
const importAnalyzer = require('./import-analyzer');

// Configuration - inherit from repo-mapper
const CONFIG = {
  ...repoMapper.CONFIG,
  testPatterns: [
    // File name patterns
    /\.test\./i,
    /\.spec\./i,
    /test\./i,
    /spec\./i,
    // Directory patterns
    /__tests__/i,
    /tests?\//i
  ]
};

/**
 * Determine if a file is a test file based on patterns
 */
function isTestFile(filePath) {
  for (const pattern of CONFIG.testPatterns) {
    if (pattern.test(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract information about what modules are being tested
 */
function analyzeTestFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {
      filePath,
      testedModules: [],
      testFramework: null,
      testCasesCount: 0
    };
    
    // Identify test framework
    if (content.includes('describe(') || content.includes('it(') || content.includes('test(')) {
      result.testFramework = 'jest/mocha';
    } else if (content.includes('assert(') || content.includes('assert.')) {
      result.testFramework = 'node-assert';
    } else if (content.includes('chai')) {
      result.testFramework = 'chai';
    }
    
    // Count test cases
    const testCases = content.match(/(?:it|test)\s*\(['"].*?['"]\s*,/g) || [];
    result.testCasesCount = testCases.length;
    
    // Extract imports to determine what's being tested
    const imports = importAnalyzer.extractImports(filePath);
    if (imports) {
      // For each internal import, check if it's being tested
      for (const importModule of imports.internalModules) {
        // Try to resolve the import path relative to the test file
        const testDir = path.dirname(filePath);
        let resolvedPath;
        let moduleName;
        
        if (importModule.startsWith('.')) {
          // Relative import
          resolvedPath = path.resolve(testDir, importModule);
          moduleName = path.basename(resolvedPath);
        } else {
          // Non-relative import (likely a project module)
          resolvedPath = importModule;
          moduleName = path.basename(importModule);
        }
        
        // Remove file extension if present
        moduleName = moduleName.replace(/\.(js|jsx|ts|tsx)$/, '');
        
        // Check if the module is referenced in test cases
        const modulePattern = new RegExp(
          `(?:describe|it|test)\\s*\\(['"].*?${moduleName}.*?['"]}|` + // Test description mentions module
          `(?:${moduleName})\\s*\\(|` + // Function calls to module
          `new\\s+${moduleName}|` + // Class instantiation
          `(?:const|let|var)\\s+\\w+\\s*=\\s*${moduleName}` // Variable assigned from module
        );
        
        const isDirectlyTested = modulePattern.test(content);
        
        result.testedModules.push({
          modulePath: importModule,
          resolvedPath,
          moduleName,
          isDirectlyTested,
          confidence: isDirectlyTested ? 'high' : 'low'
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error analyzing test file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Map test coverage for the entire codebase
 */
function mapTestCoverage(repoData, dependencyGraph) {
  console.log('Mapping test coverage...');
  
  const testFiles = [];
  const implementationFiles = [];
  const testCoverage = {
    testFiles: [],
    implementationFiles: [],
    coverageMap: [],
    stats: {
      totalTestFiles: 0,
      totalImplementationFiles: 0,
      filesTested: 0,
      filesUntested: 0,
      testCasesCount: 0,
      coveragePercentage: 0
    }
  };
  
  // Categorize files as test or implementation
  for (const node of dependencyGraph.nodes) {
    if (isTestFile(node.id)) {
      testFiles.push({
        id: node.id,
        name: node.label
      });
    } else {
      implementationFiles.push({
        id: node.id,
        name: node.label
      });
    }
  }
  
  testCoverage.testFiles = testFiles;
  testCoverage.implementationFiles = implementationFiles;
  testCoverage.stats.totalTestFiles = testFiles.length;
  testCoverage.stats.totalImplementationFiles = implementationFiles.length;
  
  console.log(`Found ${testFiles.length} test files and ${implementationFiles.length} implementation files`);
  
  // Analyze each test file
  for (const testFile of testFiles) {
    const fullPath = path.join(CONFIG.rootDir, testFile.id);
    const testAnalysis = analyzeTestFile(fullPath);
    
    if (testAnalysis) {
      testCoverage.stats.testCasesCount += testAnalysis.testCasesCount;
      
      // Map each tested module to its implementation file
      for (const testedModule of testAnalysis.testedModules) {
        // Find matching implementation file
        let matchingFile = null;
        
        // Try exact path match
        matchingFile = implementationFiles.find(f => f.id === testedModule.resolvedPath);
        
        // Try with extensions
        if (!matchingFile) {
          for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
            matchingFile = implementationFiles.find(f => f.id === testedModule.resolvedPath + ext);
            if (matchingFile) break;
          }
        }
        
        // Try with index files
        if (!matchingFile) {
          for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
            matchingFile = implementationFiles.find(f => 
              f.id === path.join(testedModule.resolvedPath, `index${ext}`)
            );
            if (matchingFile) break;
          }
        }
        
        // Try module name-based heuristic
        if (!matchingFile) {
          const moduleName = testedModule.moduleName;
          matchingFile = implementationFiles.find(f => 
            f.name === `${moduleName}.js` ||
            f.name === `${moduleName}.jsx` ||
            f.name === `${moduleName}.ts` ||
            f.name === `${moduleName}.tsx`
          );
        }
        
        if (matchingFile) {
          testCoverage.coverageMap.push({
            testFile: testFile.id,
            implementationFile: matchingFile.id,
            isDirectlyTested: testedModule.isDirectlyTested,
            confidence: testedModule.confidence
          });
        }
      }
    }
  }
  
  // Calculate test coverage statistics
  const testedFiles = new Set(testCoverage.coverageMap.map(m => m.implementationFile));
  testCoverage.stats.filesTested = testedFiles.size;
  testCoverage.stats.filesUntested = implementationFiles.length - testedFiles.size;
  testCoverage.stats.coveragePercentage = Math.round(
    (testCoverage.stats.filesTested / testCoverage.stats.totalImplementationFiles) * 100
  );
  
  console.log(`Test coverage complete: ${testCoverage.stats.coveragePercentage}% of files have tests`);
  console.log(`- ${testCoverage.stats.filesTested} files tested`);
  console.log(`- ${testCoverage.stats.filesUntested} files not tested`);
  console.log(`- ${testCoverage.stats.testCasesCount} total test cases`);
  
  return testCoverage;
}

/**
 * Main function to execute the test coverage analysis
 */
function analyzeTestCoverage() {
  console.log('Starting test coverage analysis...');
  
  // First get the repository structure
  const repoData = repoMapper.mapRepositoryStructure();
  
  // Build the dependency graph
  const dependencyGraph = importAnalyzer.buildDependencyGraph(repoData);
  
  // Map test coverage
  const testCoverage = mapTestCoverage(repoData, dependencyGraph);
  repoMapper.writeJsonOutput('test-coverage.json', testCoverage);
  
  console.log('Test coverage analysis complete!');
  return {
    repoData,
    dependencyGraph,
    testCoverage
  };
}

// Run the analysis if this module is executed directly
if (require.main === module) {
  analyzeTestCoverage();
}

module.exports = {
  analyzeTestCoverage,
  mapTestCoverage,
  analyzeTestFile,
  isTestFile,
  CONFIG
};
