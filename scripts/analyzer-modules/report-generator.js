/**
 * report-generator.js
 * 
 * Module for generating reports from analysis data
 */

const fs = require('fs');
const path = require('path');
const utils = require('../analyzer-utils');

/**
 * Generate an HTML report for repository structure
 */
function generateRepoStructureReport(repoStructure, config = {}) {
  const { outputDir } = utils.parseConfig(config);
  
  console.log('Generating repository structure report...');
  
  const reportPath = path.join(outputDir, 'structure-report.html');
  const timestamp = new Date().toLocaleString();
  
  // Create HTML report
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Repository Structure Report</title>
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
    <h1>Repository Structure Report</h1>
    <p>Generated on ${timestamp}</p>
    
    <div class="card">
      <h2>Repository Overview</h2>
      <div class="stats">
        <div class="stat-card">
          <div>Directories</div>
          <div class="number">${repoStructure.stats.directories}</div>
        </div>
        <div class="stat-card">
          <div>Files</div>
          <div class="number">${repoStructure.stats.files}</div>
        </div>
        <div class="stat-card">
          <div>Total Size</div>
          <div class="number">${repoStructure.stats.totalSizeFormatted || utils.formatFileSize(repoStructure.stats.totalSize)}</div>
        </div>
      </div>
      
      <h3>Files by Extension</h3>
      <table>
        <tr>
          <th>Extension</th>
          <th>Count</th>
        </tr>
        ${Object.entries(repoStructure.stats.filesByExtension)
          .sort(([, countA], [, countB]) => countB - countA)
          .map(([ext, count]) => `<tr><td>${ext || 'No extension'}</td><td>${count}</td></tr>`)
          .join('')
        }
      </table>
    </div>
    
    <div class="card">
      <h2>Test Files</h2>
      <p>Found ${repoStructure.testFiles ? repoStructure.testFiles.length : 0} test files.</p>
      
      <table>
        <tr>
          <th>File Path</th>
          <th>Size</th>
          <th>Last Modified</th>
        </tr>
        ${repoStructure.testFiles ? repoStructure.testFiles.slice(0, 20).map(file => `
          <tr>
            <td>${file.path}</td>
            <td>${utils.formatFileSize(file.size)}</td>
            <td>${new Date(file.modified).toLocaleString()}</td>
          </tr>
        `).join('') : ''}
      </table>
      ${repoStructure.testFiles && repoStructure.testFiles.length > 20 ? `<p>Showing 20 of ${repoStructure.testFiles.length} test files.</p>` : ''}
    </div>
  </div>
</body>
</html>`;
  
  fs.writeFileSync(reportPath, html, 'utf8');
  console.log(`HTML report generated: ${reportPath}`);
  
  return reportPath;
}

/**
 * Generate an HTML report for dependency analysis
 */
function generateDependencyReport(dependencyAnalysis, config = {}) {
  const { outputDir } = utils.parseConfig(config);
  
  console.log('Generating dependency analysis report...');
  
  const reportPath = path.join(outputDir, 'dependency-report.html');
  const timestamp = new Date().toLocaleString();
  
  // Create HTML report
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Dependency Analysis Report</title>
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
    .warning { color: orange; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dependency Analysis Report</h1>
    <p>Generated on ${timestamp}</p>
    
    <div class="card">
      <h2>Dependency Summary</h2>
      <div class="stats">
        <div class="stat-card">
          <div>Files with Dependencies</div>
          <div class="number">${dependencyAnalysis.dependencyGraph.stats.filesWithDependencies}</div>
        </div>
        <div class="stat-card">
          <div>Internal Dependencies</div>
          <div class="number">${dependencyAnalysis.dependencyGraph.stats.internalDependencies}</div>
        </div>
        <div class="stat-card">
          <div>External Dependencies</div>
          <div class="number">${dependencyAnalysis.dependencyGraph.stats.externalDependencies.length}</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>External Dependencies</h2>
      <table>
        <tr>
          <th>Package</th>
          <th>Usage Count</th>
        </tr>
        ${dependencyAnalysis.externalDependencies.dependencies
          .slice(0, 30)
          .map(dep => `<tr><td>${dep.name}</td><td>${dep.usageCount}</td></tr>`)
          .join('')
        }
      </table>
    </div>
    
    <div class="card">
      <h2>Entry Points</h2>
      <h3>Server Files (${dependencyAnalysis.entryPoints.servers.length})</h3>
      <ul>
        ${dependencyAnalysis.entryPoints.servers
          .map(server => `<li>${server.path}</li>`)
          .join('')
        }
      </ul>
      
      <h3>Batch Files (${dependencyAnalysis.entryPoints.batchFiles.length})</h3>
      <ul>
        ${dependencyAnalysis.entryPoints.batchFiles
          .map(batch => `<li>${batch.path}</li>`)
          .join('')
        }
      </ul>
    </div>
    
    ${dependencyAnalysis.circularDependencies.length > 0 ? `
    <div class="card">
      <h2 class="warning">Circular Dependencies (${dependencyAnalysis.circularDependencies.length})</h2>
      <p>The following circular dependencies were detected:</p>
      <ul>
        ${dependencyAnalysis.circularDependencies
          .map(cycle => `<li>${cycle.join(' → ')}</li>`)
          .join('')
        }
      </ul>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
  
  fs.writeFileSync(reportPath, html, 'utf8');
  console.log(`HTML report generated: ${reportPath}`);
  
  return reportPath;
}

/**
 * Generate an HTML report for server analysis
 */
function generateServerReport(serverAnalysis, config = {}) {
  const { outputDir } = utils.parseConfig(config);
  
  console.log('Generating server analysis report...');
  
  const reportPath = path.join(outputDir, 'server-report.html');
  const timestamp = new Date().toLocaleString();
  
  // Create HTML report
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>MCP Server Analysis Report</title>
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
    <h1>MCP Server Analysis Report</h1>
    <p>Generated on ${timestamp}</p>
    
    <div class="card">
      <h2>Server Comparison</h2>
      <table>
        <tr>
          <th>Server</th>
          <th>SDK Import</th>
          <th>Tools</th>
          <th>Handlers</th>
          <th>Environment Variables</th>
          <th>Database</th>
        </tr>
        ${Object.entries(serverAnalysis.comparison.summary)
          .map(([server, data]) => `
            <tr>
              <td>${server}</td>
              <td class="${data.usesDirectSdkImport ? 'success' : 'warning'}">
                ${data.usesDirectSdkImport ? 'Direct (Good)' : 'Factory (Alternative)'}
              </td>
              <td>${data.toolsCount}</td>
              <td>${data.handlerCount}</td>
              <td>${data.envVarCount}</td>
              <td>${data.usesDatabase ? 'Yes' : 'No'}</td>
            </tr>
          `)
          .join('')
        }
      </table>
    </div>
    
    ${serverAnalysis.claudeConfig ? `
    <div class="card">
      <h2>Claude Desktop Configuration</h2>
      <table>
        <tr>
          <th>Server Name</th>
          <th>Command</th>
          <th>Arguments</th>
          <th>Status</th>
        </tr>
        ${serverAnalysis.claudeConfig.servers
          .map(server => `
            <tr>
              <td>${server.name}</td>
              <td>${server.command}</td>
              <td>${server.args.join(' ')}</td>
              <td class="${serverAnalysis.claudeConfig.missingFiles.some(m => m.serverName === server.name) ? 'warning' : 'success'}">
                ${serverAnalysis.claudeConfig.missingFiles.some(m => m.serverName === server.name) ? 'Missing file' : 'Valid'}
              </td>
            </tr>
          `)
          .join('')
        }
      </table>
      
      ${serverAnalysis.claudeConfig.missingFiles.length > 0 ? `
      <h3 class="warning">Missing Files</h3>
      <table>
        <tr>
          <th>Server</th>
          <th>Missing File</th>
          <th>Suggested Replacement</th>
        </tr>
        ${serverAnalysis.claudeConfig.recommendations
          .map(rec => `
            <tr>
              <td>${rec.serverName}</td>
              <td>${rec.missingPath}</td>
              <td>${rec.replacements[0] || 'No suggestion available'}</td>
            </tr>
          `)
          .join('')
        }
      </table>
      ` : ''}
    </div>
    ` : ''}
    
    <div class="card">
      <h2>Tools by Server</h2>
      ${Object.entries(serverAnalysis.servers)
        .map(([serverName, server]) => `
          <h3>${serverName} (${server.tools.length} tools)</h3>
          <table>
            <tr>
              <th>Tool</th>
              <th>Description</th>
            </tr>
            ${server.tools
              .map(tool => `<tr><td>${tool.name}</td><td>${tool.description}</td></tr>`)
              .join('')
            }
          </table>
        `)
        .join('')
      }
    </div>
  </div>
</body>
</html>`;
  
  fs.writeFileSync(reportPath, html, 'utf8');
  console.log(`HTML report generated: ${reportPath}`);
  
  return reportPath;
}

/**
 * Generate comprehensive HTML report from all analysis results
 */
async function generateCompleteReport(results, config = {}) {
  const { outputDir } = utils.parseConfig(config);
  
  console.log('Generating comprehensive analysis report...');
  
  const reportPath = path.join(outputDir, 'complete-analysis-report.html');
  const timestamp = new Date().toLocaleString();
  
  // Generate individual reports first
  let reports = {};
  
  if (results.repoStructure) {
    reports.structure = await generateRepoStructureReport(results.repoStructure.repoStructure, config);
  }
  
  if (results.dependencyAnalysis) {
    reports.dependency = await generateDependencyReport(results.dependencyAnalysis, config);
  }
  
  if (results.serverAnalysis) {
    reports.server = await generateServerReport(results.serverAnalysis, config);
  }
  
  // Create the combined report
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Complete MetaMCP Analysis Report</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
    h1, h2, h3 { color: #0066cc; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: #f9f9f9; border-radius: 5px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .nav { display: flex; gap: 10px; margin-bottom: 20px; }
    .nav-item { padding: 10px; background: #0066cc; color: white; border-radius: 5px; text-decoration: none; }
    .summary { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; }
    .summary-card { background: #fff; border-radius: 5px; padding: 15px; flex: 1; min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .number { font-size: 24px; font-weight: bold; color: #0066cc; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Complete MetaMCP Analysis Report</h1>
    <p>Generated on ${timestamp}</p>
    
    <div class="nav">
      ${reports.structure ? `<a href="${path.basename(reports.structure)}" class="nav-item">Repository Structure</a>` : ''}
      ${reports.dependency ? `<a href="${path.basename(reports.dependency)}" class="nav-item">Dependencies</a>` : ''}
      ${reports.server ? `<a href="${path.basename(reports.server)}" class="nav-item">Server Analysis</a>` : ''}
    </div>
    
    <div class="card">
      <h2>Analysis Summary</h2>
      <div class="summary">
        <div class="summary-card">
          <div>Total Files</div>
          <div class="number">${results.repoStructure?.repoStructure?.stats?.files || 0}</div>
        </div>
        <div class="summary-card">
          <div>MCP Servers</div>
          <div class="number">${Object.keys(results.serverAnalysis?.servers || {}).length}</div>
        </div>
        <div class="summary-card">
          <div>External Dependencies</div>
          <div class="number">${results.dependencyAnalysis?.dependencyGraph?.stats?.externalDependencies?.length || 0}</div>
        </div>
        <div class="summary-card">
          <div>Analysis Time</div>
          <div class="number">${results.analysisTime}</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>Key Findings</h2>
      <ul>
        ${results.serverAnalysis ? `
        <li>
          ${Object.values(results.serverAnalysis.comparison.summary).every(s => s.usesDirectSdkImport) 
            ? 'All servers use the recommended direct SDK import pattern.' 
            : 'Some servers could be improved by using direct SDK import pattern.'}
        </li>
        ` : ''}
        ${results.dependencyAnalysis?.circularDependencies?.length > 0 ? `
        <li>
          Found ${results.dependencyAnalysis.circularDependencies.length} circular dependencies that should be resolved.
        </li>
        ` : ''}
        ${results.serverAnalysis?.claudeConfig?.missingFiles?.length > 0 ? `
        <li>
          Found ${results.serverAnalysis.claudeConfig.missingFiles.length} missing file(s) in the Claude configuration.
        </li>
        ` : ''}
      </ul>
    </div>
  </div>
</body>
</html>`;
  
  fs.writeFileSync(reportPath, html, 'utf8');
  console.log(`Comprehensive report generated: ${reportPath}`);
  
  return reportPath;
}

module.exports = {
  generateRepoStructureReport,
  generateDependencyReport,
  generateServerReport,
  generateCompleteReport
};
