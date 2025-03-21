/**
 * test-analyzer.js
 * 
 * Test script for the enhanced codebase analyzer
 */

const { runAnalysis } = require('./enhanced-analyzer');

async function runTest() {
  console.log('Testing enhanced analyzer with code metrics...');
  
  try {
    const results = await runAnalysis({
      // Specify which analysis modules to run
      analysisModules: ['structure', 'quality'],
      
      // Set output directory
      outputDir: './analysis-output',
      
      // Limit scanning to scripts directory for faster testing
      rootDir: './scripts',
      
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
          console.log(`${index + 1}. ${file.filePath} (complexity: ${file.complexity})`);
        });
      }
    }
    
    console.log('\nTest complete. Check the analysis-output directory for detailed results.');
  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

runTest();
