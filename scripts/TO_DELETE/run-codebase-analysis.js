/**
 * run-codebase-analysis.js
 * 
 * Master script that runs all analysis modules and generates a comprehensive report
 * of the codebase, including repository structure, dependencies, test coverage, and
 * MCP server analysis.
 */

const fs = require('fs');
const path = require('path');

// Import all analysis modules
const repoMapper = require('./repo-mapper');
const importAnalyzer = require('./import-analyzer');
const testCoverageAnalyzer = require('./test-coverage-analyzer');
const mcpServerAnalyzer = require('./mcp-server-analyzer');

// Configuration
const CONFIG = {
  ...repoMapper.CONFIG,
  generateHtml: true,
  openReportInBrowser: true
};

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
    .chart-container { height: 300px; margin-bottom: 20px; }
    .directory-tree ul { list-style-type: none; }
    .directory-tree details { margin-left: 20px; }
    .directory-tree summary { cursor: pointer; }
    .test-coverage { display: flex; gap: 20px; }
    .test-coverage-column { flex: 1; }
    .positive { color: green; }
    .negative { color: red; }
    .warning { color: orange; }
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
    
    <div class="card">
      <h2>Dependency Analysis</h2>
      <div class="stats">
        <div class="stat-card">
          <div>Files with Dependencies</div>
          <div class="number">${results.dependencyGraph.stats.filesWithDependencies}</div>
        </div>
        <div class="stat-card">
          <div>Internal Dependencies</div>
          <div class="number">${results.dependencyGraph.stats.internalDependencies}</div>
        </div>
        <div class="stat-card">
          <div>External Dependencies</div>
          <div class="number">${results.dependencyGraph.stats.externalDependencies.length}</div>
        </div>
      </div>
      
      <h3>Top External Dependencies</h3>
      <table>
        <tr>
          <th>Package</th>
        </tr>
        ${results.dependencyGraph.stats.externalDependencies
          .slice(0, 10)
          .map(dep => `<tr><td>${dep}</td></tr>`)
          .join('')
        }
      </table>
    </div>
    
    <div class="card">
      <h2>Entry Points</h2>
      <h3>Server Files (${results.entryPoints.servers.length})</h3>
      <ul>
        ${results.entryPoints.servers
          .map(server => `<li>${server.path}</li>`)
          .join('')
        }
      </ul>
      
      <h3>Scripts (${results.entryPoints.scripts.length})</h3>
      <ul>
        ${results.entryPoints.scripts
          .map(script => `<li>${script.path}</li>`)
          .join('')
        }
      </ul>
      
      <h3>Batch Files (${results.entryPoints.batchFiles.length})</h3>
      <ul>
        ${results.entryPoints.batchFiles
          .map(batch => `<li>${batch.path}</li>`)
          .join('')
        }
      </ul>
    </div>
    
    <div class="card">
      <h2>Test Coverage</h2>
      <div class="stats">
        <div class="stat-card">
          <div>Test Files</div>
          <div class="number">${results.testCoverage.stats.totalTestFiles}</div>
        </div>
        <div class="stat-card">
          <div>Implementation Files</div>
          <div class="number">${results.testCoverage.stats.totalImplementationFiles}</div>
        </div>
        <div class="stat-card">
          <div>Coverage</div>
          <div class="number">${results.testCoverage.stats.coveragePercentage}%</div>
        </div>
        <div class="stat-card">
          <div>Test Cases</div>
          <div class="number">${results.testCoverage.stats.testCasesCount}</div>
        </div>
      </div>
      
      <div class="test-coverage">
        <div class="test-coverage-column">
          <h3>Tested Files (${results.testCoverage.stats.filesTested})</h3>
          <table>
            <tr>
              <th>File</th>
              <th>Test Count</th>
            </tr>
            ${Array.from(new Set(results.testCoverage.coverageMap.map(m => m.implementationFile)))
              .slice(0, 10)
              .map(file => {
                const testCount = results.testCoverage.coverageMap.filter(m => m.implementationFile === file).length;
                return `<tr><td>${file}</td><td>${testCount}</td></tr>`;
              })
              .join('')
            }
          </table>
        </div>
        
        <div class="test-coverage-column">
          <h3>Untested Files (${results.testCoverage.stats.filesUntested})</h3>
          <table>
            <tr>
              <th>File</th>
            </tr>
            ${results.testCoverage.implementationFiles
              .filter(file => !results.testCoverage.coverageMap.some(m => m.implementationFile === file.id))
              .slice(0, 10)
              .map(file => `<tr><td>${file.id}</td></tr>`)
              .join('')
            }
          </table>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>MCP Server Analysis</h2>
      
      <h3>Server Comparison</h3>
      <table>
        <tr>
          <th>Server</th>
          <th>Import Pattern</th>
          <th>Capabilities</th>
          <th>Request Handlers</th>
          <th>Database</th>
        </tr>
        ${Object.entries(results.serverComparison.summary)
          .map(([server, data]) => `
            <tr>
              <td>${server}</td>
              <td class="${data.usesDirectSdkImport ? 'positive' : 'negative'}">
                ${data.usesDirectSdkImport ? 'Direct (Good)' : 'Path-specific (Bad)'}
              </td>
              <td>${data.capabilitiesCount}</td>
              <td>${data.requestHandlersCount}</td>
              <td>${data.usesDatabase ? 'Yes' : 'No'}</td>
            </tr>
          `)
          .join('')
        }
      </table>
      
      <h3>Claude Desktop Configuration</h3>
      <table>
        <tr>
          <th>Server Name</th>
          <th>Type</th>
          <th>Uses MetaMCP</th>
        </tr>
        ${results.claudeConfig && results.claudeConfig.claudeConfig && results.claudeConfig.claudeConfig.mcpServers
          ? results.claudeConfig.claudeConfig.mcpServers
            .map(server => `
              <tr>
                <td>${server.name}</td>
                <td>${server.type}</td>
                <td class="${server.usesMetaMcp ? 'positive' : ''}">
                  ${server.usesMetaMcp ? 'Yes' : 'No'}
                </td>
              </tr>
            `)
            .join('')
          : '<tr><td colspan="3">No MCP servers configured</td></tr>'
        }
      </table>
    </div>
    
    <div class="card">
      <h2>Recommendations</h2>
      <ul>
        <li class="${results.serverComparison.summary.unified.usesDirectSdkImport ? 'positive' : 'warning'}">
          ${results.serverComparison.summary.unified.usesDirectSdkImport
            ? 'Unified server is using the recommended direct SDK import pattern.'  
            : 'Consider updating unified-server.js to use direct SDK import pattern.'  
          }
        </li>
        <li class="${results.testCoverage.stats.coveragePercentage > 50 ? 'positive' : 'warning'}">
          Test coverage is ${results.testCoverage.stats.coveragePercentage}%, ${results.testCoverage.stats.coveragePercentage > 50 ? 'which is good' : 'consider adding more tests'}.
        </li>
        <li>
          The codebase has ${results.entryPoints.servers.length} server implementations. 
          ${results.entryPoints.servers.length > 3 ? 'Consider consolidating server implementations to reduce duplication.' : 'This is a good number of implementations.'}
        </li>
      </ul>
    </div>
    
    <footer>
      <p>Analysis performed using enhanced Tree Sitter-based code analysis tools.</p>
    </footer>
  </div>
</body>
</html>`;
  
  fs.writeFileSync(reportPath, html, 'utf8');
  console.log(`HTML report generated: ${reportPath}`);
  
  return reportPath;
}

/**
 * Run all analyses and generate a comprehensive report
 */
async function runCompleteAnalysis() {
  console.log('Starting comprehensive codebase analysis...');
  const startTime = Date.now();
  
  // Step 1: Map the repository structure
  console.log('\n=== Repository Structure Analysis ===');
  const repoStructure = repoMapper.mapRepositoryStructure();
  repoMapper.writeJsonOutput('repo-structure.json', repoStructure);
  
  // Step 2: Analyze dependencies and imports
  console.log('\n=== Dependency Analysis ===');
  const dependencyGraph = importAnalyzer.buildDependencyGraph(repoStructure);
  repoMapper.writeJsonOutput('dependency-graph.json', dependencyGraph);
  
  // Step 3: Find entry points
  console.log('\n=== Entry Point Analysis ===');
  const entryPoints = importAnalyzer.findEntryPoints(repoStructure);
  repoMapper.writeJsonOutput('entry-points.json', entryPoints);
  
  // Step 4: Analyze test coverage
  console.log('\n=== Test Coverage Analysis ===');
  const testCoverage = testCoverageAnalyzer.mapTestCoverage(repoStructure, dependencyGraph);
  repoMapper.writeJsonOutput('test-coverage.json', testCoverage);
  
  // Step 5: Analyze MCP servers
  console.log('\n=== MCP Server Analysis ===');
  const mcpServers = {};
  const claudeConfig = {};
  
  for (const [fileKey, filePath] of Object.entries(mcpServerAnalyzer.CONFIG.targetFiles)) {
    if (fileKey === 'claudeConfig') {
      claudeConfig[fileKey] = mcpServerAnalyzer.analyzeClaudeConfig(filePath);
    } else {
      const fullPath = path.resolve(CONFIG.rootDir, filePath);
      mcpServers[fileKey] = mcpServerAnalyzer.analyzeMcpServer(fullPath);
    }
  }
  
  const serverComparison = mcpServerAnalyzer.compareServerImplementations(mcpServers);
  repoMapper.writeJsonOutput('mcp-servers.json', mcpServers);
  repoMapper.writeJsonOutput('claude-config.json', claudeConfig);
  repoMapper.writeJsonOutput('server-comparison.json', serverComparison);
  
  // Collect all results
  const results = {
    repoStructure,
    dependencyGraph,
    entryPoints,
    testCoverage,
    mcpServers,
    claudeConfig,
    serverComparison
  };
  
  // Step 6: Generate comprehensive report
  console.log('\n=== Generating Final Report ===');
  repoMapper.writeJsonOutput('complete-analysis.json', results);
  
  // Generate HTML report if enabled
  let reportPath;
  if (CONFIG.generateHtml) {
    reportPath = generateHtmlReport(results);
  }
  
  // Open report in browser if enabled
  if (CONFIG.openReportInBrowser && reportPath) {
    try {
      const open = require('open');
      await open(reportPath);
    } catch (error) {
      console.log(`Could not automatically open report: ${error.message}`);
      console.log(`Report is available at: ${reportPath}`);
    }
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
  runCompleteAnalysis().catch(error => {
    console.error('Error in analysis:', error);
    process.exit(1);
  });
}

module.exports = {
  runCompleteAnalysis,
  generateHtmlReport,
  CONFIG
};
