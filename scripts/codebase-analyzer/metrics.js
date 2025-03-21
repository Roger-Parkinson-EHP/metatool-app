/**
 * code-metrics.js
 * 
 * Module for analyzing code quality metrics
 */

const fs = require('fs');
const path = require('path');
const utils = require('../analyzer-utils');

/**
 * Calculate complexity metrics for a file
 */
function calculateComplexity(filePath) {
  try {
    const content = utils.readFileContent(filePath);
    if (!content) return null;
    
    const metrics = {
      filePath,
      lines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      functions: 0,
      classes: 0,
      complexity: {
        cyclomaticComplexity: 0,
        maxDepth: 0,
        maxMethodLength: 0,
        maxParameterCount: 0
      }
    };
    
    // Count lines
    const lines = content.split('\n');
    metrics.lines = lines.length;
    
    // Count code, comment, and blank lines
    let inBlockComment = false;
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        metrics.blankLines++;
      } else if (trimmedLine.startsWith('//')) {
        metrics.commentLines++;
      } else if (trimmedLine.startsWith('/*')) {
        metrics.commentLines++;
        inBlockComment = !trimmedLine.endsWith('*/');
      } else if (trimmedLine.endsWith('*/')) {
        metrics.commentLines++;
        inBlockComment = false;
      } else if (inBlockComment) {
        metrics.commentLines++;
      } else {
        metrics.codeLines++;
      }
    }
    
    // Count functions
    const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)|\w+\s*:\s*function\s*\([^)]*\)|\w+\s*=\s*function\s*\([^)]*\)|\([^)]*\)\s*=>|async\s+function\s+\w+\s*\([^)]*\)/g) || [];
    metrics.functions = functionMatches.length;
    
    // Count classes
    const classMatches = content.match(/class\s+\w+/g) || [];
    metrics.classes = classMatches.length;
    
    // Calculate cyclomatic complexity (approximate)
    const conditionalMatches = content.match(/if|else|for|while|switch|case|catch|\?|&&|\|\||\?.\:/g) || [];
    metrics.complexity.cyclomaticComplexity = 1 + conditionalMatches.length;
    
    // Calculate max nesting depth
    let currentDepth = 0;
    let maxDepth = 0;
    
    for (const line of lines) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      currentDepth += openBraces - closeBraces;
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    
    metrics.complexity.maxDepth = maxDepth;
    
    // Find max method length
    const functionMatches2 = content.match(/function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?}|\w+\s*:\s*function\s*\([^)]*\)\s*{[\s\S]*?}|\w+\s*=\s*function\s*\([^)]*\)\s*{[\s\S]*?}|\([^)]*\)\s*=>\s*{[\s\S]*?}|async\s+function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?}/g) || [];
    
    let maxMethodLength = 0;
    for (const func of functionMatches2) {
      const funcLines = func.split('\n').length;
      maxMethodLength = Math.max(maxMethodLength, funcLines);
    }
    
    metrics.complexity.maxMethodLength = maxMethodLength;
    
    // Find max parameter count
    const paramMatches = content.match(/function\s+\w+\s*\(([^)]*)\)|\w+\s*:\s*function\s*\(([^)]*)\)|\w+\s*=\s*function\s*\(([^)]*)\)|\(([^)]*)\)\s*=>|async\s+function\s+\w+\s*\(([^)]*)\)/g) || [];
    
    let maxParams = 0;
    for (const match of paramMatches) {
      const paramsMatch = match.match(/\(([^)]*)\)/);
      if (paramsMatch && paramsMatch[1]) {
        const params = paramsMatch[1].split(',').filter(p => p.trim() !== '');
        maxParams = Math.max(maxParams, params.length);
      }
    }
    
    metrics.complexity.maxParameterCount = maxParams;
    
    return metrics;
  } catch (error) {
    console.error(`Error calculating complexity for ${filePath}:`, error.message);
    return null;
  }
}


/**
 * Analyze code metrics for a list of files
 */
function analyzeCodeMetrics(files, config = {}) {
  const results = {
    fileMetrics: [],
    summary: {
      totalFiles: files.length,
      totalLines: 0,
      totalCodeLines: 0,
      totalCommentLines: 0,
      totalBlankLines: 0,
      totalFunctions: 0,
      totalClasses: 0,
      averageComplexity: 0,
      averageDepth: 0,
      averageMethodLength: 0,
      averageParameterCount: 0
    }
  };
  
  // Analyze each file
  for (const file of files) {
    const metrics = calculateComplexity(file);
    if (metrics) {
      results.fileMetrics.push(metrics);
      
      // Update summary
      results.summary.totalLines += metrics.lines;
      results.summary.totalCodeLines += metrics.codeLines;
      results.summary.totalCommentLines += metrics.commentLines;
      results.summary.totalBlankLines += metrics.blankLines;
      results.summary.totalFunctions += metrics.functions;
      results.summary.totalClasses += metrics.classes;
    }
  }
  
  // Calculate averages
  if (results.fileMetrics.length > 0) {
    const count = results.fileMetrics.length;
    
    results.summary.averageComplexity = results.fileMetrics.reduce((sum, metrics) => 
      sum + metrics.complexity.cyclomaticComplexity, 0) / count;
    
    results.summary.averageDepth = results.fileMetrics.reduce((sum, metrics) => 
      sum + metrics.complexity.maxDepth, 0) / count;
    
    results.summary.averageMethodLength = results.fileMetrics.reduce((sum, metrics) => 
      sum + metrics.complexity.maxMethodLength, 0) / count;
    
    results.summary.averageParameterCount = results.fileMetrics.reduce((sum, metrics) => 
      sum + metrics.complexity.maxParameterCount, 0) / count;
  }
  
  // Sort files by complexity (highest first)
  results.fileMetrics.sort((a, b) => b.complexity.cyclomaticComplexity - a.complexity.cyclomaticComplexity);
  
  return results;
}


/**
 * Identify files that might need refactoring
 */
function identifyRefactoringCandidates(metricsResults, thresholds = {}) {
  // Default thresholds for code quality
  const defaultThresholds = {
    cyclomaticComplexity: 15,  // Maximum acceptable cyclomatic complexity
    maxDepth: 5,               // Maximum acceptable nesting depth
    maxMethodLength: 50,       // Maximum acceptable method length in lines
    maxParameterCount: 5,      // Maximum acceptable parameter count
    commentRatio: 0.1          // Minimum acceptable comment ratio (comments/code)
  };
  
  const actualThresholds = { ...defaultThresholds, ...thresholds };
  
  const candidates = {
    highComplexity: [],
    deepNesting: [],
    longMethods: [],
    manyParameters: [],
    poorlyCommented: []
  };
  
  for (const file of metricsResults.fileMetrics) {
    // Check cyclomatic complexity
    if (file.complexity.cyclomaticComplexity > actualThresholds.cyclomaticComplexity) {
      candidates.highComplexity.push({
        filePath: file.filePath,
        complexity: file.complexity.cyclomaticComplexity,
        threshold: actualThresholds.cyclomaticComplexity
      });
    }
    
    // Check nesting depth
    if (file.complexity.maxDepth > actualThresholds.maxDepth) {
      candidates.deepNesting.push({
        filePath: file.filePath,
        depth: file.complexity.maxDepth,
        threshold: actualThresholds.maxDepth
      });
    }
    
    // Check method length
    if (file.complexity.maxMethodLength > actualThresholds.maxMethodLength) {
      candidates.longMethods.push({
        filePath: file.filePath,
        methodLength: file.complexity.maxMethodLength,
        threshold: actualThresholds.maxMethodLength
      });
    }
    
    // Check parameter count
    if (file.complexity.maxParameterCount > actualThresholds.maxParameterCount) {
      candidates.manyParameters.push({
        filePath: file.filePath,
        parameterCount: file.complexity.maxParameterCount,
        threshold: actualThresholds.maxParameterCount
      });
    }
    
    // Check comment ratio
    const commentRatio = file.codeLines > 0 ? file.commentLines / file.codeLines : 0;
    if (commentRatio < actualThresholds.commentRatio && file.codeLines > 50) {
      candidates.poorlyCommented.push({
        filePath: file.filePath,
        commentRatio: commentRatio.toFixed(2),
        comments: file.commentLines,
        code: file.codeLines,
        threshold: actualThresholds.commentRatio
      });
    }
  }
  
  return candidates;
}


/**
 * Run a complete code quality analysis
 */
async function analyzeCodeQuality(repoStructure, config = {}) {
  const startTime = Date.now();
  const fullConfig = utils.parseConfig(config);
  
  console.log('Starting code quality analysis...');
  
  // Get JavaScript/TypeScript files
  const codeExtensions = ['.js', '.jsx', '.ts', '.tsx'];
  const codeFiles = [];
  
  // Find all code files
  function findCodeFiles(structure, basePath = '') {
    for (const [name, node] of Object.entries(structure)) {
      if (node.type === 'file') {
        if (codeExtensions.includes(node.extension)) {
          codeFiles.push(path.join(fullConfig.rootDir, node.path));
        }
      } else if (node.type === 'directory') {
        if (node.children) {
          findCodeFiles(node.children, path.join(basePath, name));
        }
      }
    }
  }
  
  findCodeFiles(repoStructure.structure);
  console.log(`Found ${codeFiles.length} code files to analyze`);
  
  // Analyze code metrics
  const metricsResults = analyzeCodeMetrics(codeFiles, fullConfig);
  
  // Identify refactoring candidates
  const refactoringCandidates = identifyRefactoringCandidates(metricsResults);
  
  // Create result object
  const result = {
    metrics: metricsResults,
    refactoringCandidates,
    analysisTime: utils.formatElapsedTime(startTime)
  };
  
  // Save results if requested
  if (fullConfig.reportFormats.includes('json')) {
    utils.writeJsonOutput(fullConfig.outputDir, 'code-quality-analysis.json', result);
  }
  
  console.log(`Code quality analysis complete in ${result.analysisTime}`);
  console.log(`Identified ${Object.values(refactoringCandidates).flat().length} potential refactoring candidates`);
  
  return result;
}

module.exports = {
  calculateComplexity,
  analyzeCodeMetrics,
  identifyRefactoringCandidates,
  analyzeCodeQuality
};
