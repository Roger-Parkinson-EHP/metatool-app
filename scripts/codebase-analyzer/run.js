/**
 * run-analyzer.js
 * 
 * Full test script for the enhanced codebase analyzer
 */

const path = require('path');
const { runAnalysis } = require('./enhanced-analyzer');

async function runTest() {
  console.log('Running enhanced analyzer with code metrics...');
  
  try {
    const results = await runAnalysis({
      // Specify which analysis modules to run
      analysisModules: ['structure', 'quality'],
      
      // Set output directory
      outputDir: path.resolve(__dirname, '..', 'analysis-output'),
      
      // Use repository root directory
      rootDir: path.resolve(__dirname, '..'),
      
      // Generate both JSON and HTML reports
      reportFormats: ['json', 'html'],
      
      // Enable verbose output
      verbose: true
    });
    
    // Print summary of results
    console.log('\nAnalysis Summary:');
    console.log(`- Directories: ${results.repoStructure.repoStructure.stats.directories}`);
    console.log(`- Files: ${results.repoStructure.repoStructure.stats.files}`);
    console.log(`- Total size: ${results.repoStructure.repoStructure.stats.totalSizeFormatted}`);
    
    if (results.codeQualityAnalysis) {
      console.log('\nCode Quality Metrics:');
      console.log(`- Files analyzed: ${results.codeQualityAnalysis.metrics.fileMetrics.length}`);
      console.log(`- Total lines of code: ${results.codeQualityAnalysis.metrics.summary.totalCodeLines}`);
      console.log(`- Average complexity: ${results.codeQualityAnalysis.metrics.summary.averageComplexity.toFixed(2)}`);
      console.log(`- Average nesting depth: ${results.codeQualityAnalysis.metrics.summary.averageDepth.toFixed(2)}`);
      
      // Print top 5 complex files
      const complexFiles = results.codeQualityAnalysis.refactoringCandidates.highComplexity;
      if (complexFiles.length > 0) {
        console.log('\nTop complex files:');
        complexFiles.slice(0, 5).forEach((file, index) => {
          console.log(`${index + 1}. ${file.filePath.replace(path.resolve(__dirname, '..'), '')} (complexity: ${file.complexity})`);
        });
      }
      
      // Print files with deep nesting
      const deepNesting = results.codeQualityAnalysis.refactoringCandidates.deepNesting;
      if (deepNesting.length > 0) {
        console.log('\nFiles with deep nesting:');
        deepNesting.slice(0, 5).forEach((file, index) => {
          console.log(`${index + 1}. ${file.filePath.replace(path.resolve(__dirname, '..'), '')} (depth: ${file.depth})`);
        });
      }
      
      // Print poorly commented files
      const poorlyCommented = results.codeQualityAnalysis.refactoringCandidates.poorlyCommented;
      if (poorlyCommented.length > 0) {
        console.log('\nPoorly commented files:');
        poorlyCommented.slice(0, 5).forEach((file, index) => {
          console.log(`${index + 1}. ${file.filePath.replace(path.resolve(__dirname, '..'), '')} (comment ratio: ${file.commentRatio})`);
        });
      }
    }
    
    console.log('\nAnalysis complete in', results.analysisTime);
    console.log('Check the analysis-output directory for detailed results.');
  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

runTest();
