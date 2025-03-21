/**
 * enhanced-analyzer.js
 * 
 * A consolidated analyzer script that provides a comprehensive view of the codebase
 * by combining the best features of multiple analysis tools.
 */

const fs = require('fs');
const path = require('path');
const utils = require('./analyzer-utils');

// Import specialized analysis modules
const repoStructure = require('./analyzer-modules/repo-structure');
const dependencyAnalyzer = require('./analyzer-modules/dependency-analyzer');

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value || true;
    }
  }
  
  return options;
}

/**
 * Generate HTML report from analysis results
 */
async function generateHtmlReport(results, config) {
  console.log('Generating HTML report...');
  
  const reportPath = path.join(config.outputDir, 'enhanced-analysis-report.html');
  const timestamp = new Date().toLocaleString();
  
  // Create HTML report template
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Enhanced MetaMCP Codebase Analysis Report</title>
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
    .success { color: green; }
    .warning { color: orange; }
    .error { color: red; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Enhanced MetaMCP Codebase Analysis Report</h1>
    <p>Generated on ${timestamp}</p>
    
    <div class="card">
      <h2>Repository Overview</h2>
      <div class="stats">
        <div class="stat-card">
          <div>Directories</div>
          <div class="number">${results.repoStructure?.repoStructure?.stats?.directories || 0}</div>
        </div>
        <div class="stat-card">
          <div>Files</div>
          <div class="number">${results.repoStructure?.repoStructure?.stats?.files || 0}</div>
        </div>
        <div class="stat-card">
          <div>Total Size</div>
          <div class="number">${results.repoStructure?.repoStructure?.stats?.totalSizeFormatted || '0 B'}</div>
        </div>
      </div>
      
      <h3>Languages in Codebase</h3>
      <table>
        <tr>
          <th>Language</th>
          <th>Files</th>
        </tr>
        ${Object.entries(results.repoStructure?.repoStructure?.stats?.languages || {})
          .sort(([, countA], [, countB]) => countB - countA)
          .map(([lang, count]) => `<tr><td>${lang}</td><td>${count}</td></tr>`)
          .join('')
        }
      </table>
    </div>
    
    ${results.dependencyAnalysis ? `
    <div class="card">
      <h2>Dependency Analysis</h2>
      <div class="stats">
        <div class="stat-card">
          <div>Files with Dependencies</div>
          <div class="number">${results.dependencyAnalysis.dependencyGraph.stats.filesWithDependencies}</div>
        </div>
        <div class="stat-card">
          <div>Internal Dependencies</div>
          <div class="number">${results.dependencyAnalysis.dependencyGraph.stats.internalDependencies}</div>
        </div>
        <div class="stat-card">
          <div>External Dependencies</div>
          <div class="number">${results.dependencyAnalysis.dependencyGraph.stats.externalDependencies.length}</div>
        </div>
      </div>
      
      <h3>Top External Dependencies</h3>
      <table>
        <tr>
          <th>Package</th>
          <th>Usage Count</th>
        </tr>
        ${results.dependencyAnalysis.externalDependencies.dependencies
          .slice(0, 10)
          .map(dep => `<tr><td>${dep.name}</td><td>${dep.usageCount}</td></tr>`)
          .join('')
        }
      </table>
    </div>
    ` : ''}
    
    ${results.serverAnalysis ? `
    <div class="card">
      <h2>MCP Server Analysis</h2>
      
      <h3>Server Comparison</h3>
      <table>
        <tr>
          <th>Server</th>
          <th>Import Pattern</th>
          <th>Tools</th>
          <th>Handlers</th>
          <th>Database</th>
        </tr>
        ${Object.entries(results.serverAnalysis.comparison.summary)
          .map(([server, data]) => `
            <tr>
              <td>${server}</td>
              <td class="${data.usesDirectSdkImport ? 'success' : 'warning'}">
                ${data.usesDirectSdkImport ? 'Direct (Good)' : 'Factory (Alternative)'}
              </td>
              <td>${data.toolsCount}</td>
              <td>${data.handlerCount}</td>
              <td>${data.usesDatabase ? 'Yes' : 'No'}</td>
            </tr>
          `)
          .join('')
        }
      </table>
    </div>
    ` : ''}
  </div>
</body>
</html>
`;
  
  fs.writeFileSync(reportPath, html, 'utf8');
  console.log(`HTML report generated: ${reportPath}`);
  
  return reportPath;
}

/**
 * Run the enhanced analyzer with the given options
 */
async function runAnalysis(options = {}) {
  const startTime = Date.now();
  const config = utils.parseConfig(options);
  
  console.log('Starting enhanced codebase analysis...');
  
  // Create results object
  const results = {};
  
  // Run repository structure analysis
  if (config.analysisModules.includes('all') || config.analysisModules.includes('structure')) {
    console.log('\n=== Running Repository Structure Analysis ===');
    results.repoStructure = await repoStructure.analyzeRepositoryStructure(config);
  }
  
  // Run dependency analysis if requested
  if (config.analysisModules.includes('all') || config.analysisModules.includes('dependencies')) {
    console.log('\n=== Running Dependency Analysis ===');
    results.dependencyAnalysis = await dependencyAnalyzer.analyzeDependencies(results.repoStructure.repoStructure, config);
  }
  
  // Run server analysis if requested
  if (config.analysisModules.includes('all') || config.analysisModules.includes('servers')) {
    console.log('\n=== Running MCP Server Analysis ===');
    // Server analyzer module will be imported dynamically when it's implemented
    try {
      const serverAnalyzer = require('./analyzer-modules/server-analyzer');
      results.serverAnalysis = await serverAnalyzer.analyzeServers(results.repoStructure, config);
    } catch (error) {
      console.warn('Server analysis module not available:', error.message);
    }
  }
  
  // Calculate total analysis time
  const totalTime = utils.formatElapsedTime(startTime);
  results.analysisTime = totalTime;
  
  // Save combined results
  if (config.reportFormats.includes('json')) {
    utils.writeJsonOutput(config.outputDir, 'enhanced-analysis.json', results);
  }
  
  // Generate HTML report if requested
  if (config.reportFormats.includes('html')) {
    await generateHtmlReport(results, config);
  }
  
  console.log(`\nAnalysis complete in ${totalTime}!`);
  console.log(`Results saved to: ${config.outputDir}`);
  
  return results;
}

// Run the analysis if this module is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  runAnalysis(options).catch(error => {
    console.error('Error in analysis:', error);
    process.exit(1);
  });
}

module.exports = {
  runAnalysis,
  generateHtmlReport
};
