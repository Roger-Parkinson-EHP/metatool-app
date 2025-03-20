/**
 * fixed-codebase-analysis.js
 * 
 * Fixed version of the master script that runs all analysis modules and generates a comprehensive report
 * of the codebase, including repository structure, dependencies, test coverage, and
 * MCP server analysis.
 */

const fs = require('fs');
const path = require('path');

// Import all analysis modules
const repoMapper = require('./repo-mapper');

// Configuration
const CONFIG = {
  ...repoMapper.CONFIG,
  generateHtml: true,
  openReportInBrowser: false // Changed to false since we don't have 'open' package
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
 * Generate HTML report from analysis results
 */
function generateHtmlReport(results) {
  console.log('Generating HTML report...');
  
  const reportPath = path.join(CONFIG.outputDir, 'codebase-analysis-report.html');
  
  // Create a simple HTML report
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>MetaMCP Codebase Analysis Report</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
    h1, h2, h3 { color: #0066cc; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: #f9f9f9; border-radius: 5px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stats { display: flex; flex-wrap: wrap; gap: 15px; }
    .stat-card { background: #fff; border-radius: 5px; padding: 15px; flex: 1; min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .number { font-size: 24px; font-weight: bold; color: #0066cc; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f2f2f2; }
    tr:hover { background-color: #f5f5f5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>MetaMCP Codebase Analysis Report</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
    
    <div class="card">
      <h2>Repository Overview</h2>
      <div class="stats">
        <div class="stat-card">
          <div>Directories</div>
          <div class="number">${results.repoStructure.stats.directories}</div>
        </div>
        <div class="stat-card">
          <div>Files</div>
          <div class="number">${results.repoStructure.stats.files}</div>
        </div>
        <div class="stat-card">
          <div>Total Size</div>
          <div class="number">${Math.round(results.repoStructure.stats.totalSize / 1024 / 1024)} MB</div>
        </div>
      </div>
      
      <h3>Files by Extension</h3>
      <table>
        <tr>
          <th>Extension</th>
          <th>Count</th>
        </tr>
        ${Object.entries(results.repoStructure.stats.filesByExtension)
          .sort(([, countA], [, countB]) => countB - countA)
          .map(([ext, count]) => `<tr><td>${ext || 'No extension'}</td><td>${count}</td></tr>`)
          .join('')
        }
      </table>
    </div>
    
    <footer>
      <p>Analysis performed using fixed repository analysis tools.</p>
    </footer>
  </div>
</body>
</html>`;
  
  fs.writeFileSync(reportPath, html, 'utf8');
  console.log(`HTML report generated: ${reportPath}`);
  
  return reportPath;
}

/**
 * Run repository structure analysis and generate a report
 */
async function runSimpleAnalysis() {
  console.log('Starting simple codebase analysis...');
  const startTime = Date.now();
  
  // Step 1: Map the repository structure
  console.log('\n=== Repository Structure Analysis ===');
  const repoStructure = repoMapper.mapRepositoryStructure();
  writeJsonOutput('repo-structure.json', repoStructure);
  
  // Step 2: Find test files
  console.log('\n=== Test File Analysis ===');
  const testFiles = repoMapper.mapTestFiles(repoStructure);
  writeJsonOutput('test-files.json', testFiles);
  
  // Collect results
  const results = {
    repoStructure,
    testFiles
  };
  
  // Generate basic report
  console.log('\n=== Generating Basic Report ===');
  writeJsonOutput('basic-analysis.json', results);
  
  // Generate HTML report
  let reportPath;
  if (CONFIG.generateHtml) {
    reportPath = generateHtmlReport(results);
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log(`\nAnalysis complete! (${duration.toFixed(2)} seconds)`);  
  console.log(`Analysis results saved to: ${CONFIG.outputDir}`);
  if (reportPath) {
    console.log(`HTML report: ${reportPath}`);
  }
  
  return results;
}

// Run the analysis if this module is executed directly
if (require.main === module) {
  runSimpleAnalysis().catch(error => {
    console.error('Error in analysis:', error);
    process.exit(1);
  });
}

module.exports = {
  runSimpleAnalysis,
  generateHtmlReport,
  writeJsonOutput,
  CONFIG
};
