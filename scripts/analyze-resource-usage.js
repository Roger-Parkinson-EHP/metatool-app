  </div>
  
  <h2>Comparisons</h2>
`;

  // Generate comparison sections for each parameter
  comparisons.forEach(comparison => {
    html += `
  <h3>Comparison by ${comparison.parameter}</h3>
  <table>
    <tr>
      <th>${comparison.parameter}</th>
`;        

    // Add metric headers
    comparison.metrics.forEach(metric => {
      html += `      <th>${formatMetricName(metric)}</th>
`;
    });
    html += `    </tr>
`;

    // Add rows for each parameter value
    for (const [paramValue, data] of Object.entries(comparison.values)) {
      html += `    <tr>
      <td>${paramValue}</td>
`;
      
      comparison.metrics.forEach(metric => {
        const metricData = data.metrics[metric];
        html += `      <td>${metricData.mean.toFixed(4)} <br><small>(min: ${metricData.min.toFixed(4)}, max: ${metricData.max.toFixed(4)})</small></td>
`;
      });
      
      html += `    </tr>
`;
    }
    
    html += `  </table>

  <div class="chart">
    <canvas id="${comparison.parameter}Chart"></canvas>
  </div>
  
  <script>
    new Chart(document.getElementById('${comparison.parameter}Chart'), {
      type: 'bar',
      data: {
        labels: [${Object.keys(comparison.values).map(v => `'${v}'`).join(', ')}],
        datasets: [
`;

      // Add dataset for each metric
      comparison.metrics.forEach((metric, index) => {
        const colors = ['rgba(75, 192, 192, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)', 'rgba(255, 99, 132, 0.6)'];
        html += `          {
            label: '${formatMetricName(metric)}',
            data: [${Object.values(comparison.values).map(v => v.metrics[metric].mean.toFixed(4)).join(', ')}],
            backgroundColor: '${colors[index % colors.length]}'
          },
`;
      });

      html += `        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  </script>
`;
  });
  
  // Add resource type distribution chart
  html += `
  <h2>Resource Type Distribution</h2>
  <div class="chart">
    <canvas id="resourceTypeChart"></canvas>
  </div>
  
  <script>
    new Chart(document.getElementById('resourceTypeChart'), {
      type: 'pie',
      data: {
        labels: ['CODE', 'DOCUMENTATION', 'DATA', 'RESEARCH', 'GENERATED'],
        datasets: [{
          data: [
            ${calculateResourceTypeDistribution(results).CODE || 0},
            ${calculateResourceTypeDistribution(results).DOCUMENTATION || 0},
            ${calculateResourceTypeDistribution(results).DATA || 0},
            ${calculateResourceTypeDistribution(results).RESEARCH || 0},
            ${calculateResourceTypeDistribution(results).GENERATED || 0}
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ]
        }]
      },
      options: {
        responsive: true
      }
    });
  </script>
`;
  
  // Finish HTML document
  html += `
  <h2>Test Details</h2>
  <table>
    <tr>
      <th>Project Type</th>
      <th>Token Budget</th>
      <th>Resource Count</th>
      <th>Priority Algorithm</th>
      <th>Compression Level</th>
      <th>Inclusion Rate</th>
      <th>Token Utilization</th>
    </tr>
`;

  // Add rows for each test result
  results.forEach(result => {
    html += `    <tr>
      <td>${result.parameters.projectType}</td>
      <td>${result.parameters.tokenBudget}</td>
      <td>${result.parameters.resourceCount}</td>
      <td>${result.parameters.priorityAlgo}</td>
      <td>${result.parameters.compressionLevel}</td>
      <td>${(result.metrics.inclusionRate * 100).toFixed(2)}%</td>
      <td>${(result.metrics.tokenUtilization * 100).toFixed(2)}%</td>
    </tr>
`;
  });

  html += `  </table>
</body>
</html>
`;

  return html;
}

// Generate Markdown report
function generateMarkdownReport(results, comparisons) {
  let markdown = `# Resource-Aware Token Management Analysis

## Test Summary

- Total test runs: ${results.length}
- Average Inclusion Rate: ${(calculateMean(results.map(r => r.metrics.inclusionRate)) * 100).toFixed(2)}%
- Average Token Utilization: ${(calculateMean(results.map(r => r.metrics.tokenUtilization)) * 100).toFixed(2)}%
- Average Compression Ratio: ${calculateMean(results.map(r => r.metrics.averageCompressionRatio)).toFixed(2)}
- Average Execution Time: ${(calculateMean(results.map(r => r.metrics.executionTime)) / 1000).toFixed(2)}s

`;

  // Add comparison sections
  comparisons.forEach(comparison => {
    markdown += `## Comparison by ${comparison.parameter}

| ${comparison.parameter} | ${comparison.metrics.map(formatMetricName).join(' | ')} |
| --- | ${comparison.metrics.map(() => '---').join(' | ')} |
`;
    
    for (const [paramValue, data] of Object.entries(comparison.values)) {
      markdown += `| ${paramValue} | ${comparison.metrics.map(metric => 
        `${data.metrics[metric].mean.toFixed(4)} (min: ${data.metrics[metric].min.toFixed(4)}, max: ${data.metrics[metric].max.toFixed(4)})`
      ).join(' | ')} |
`;
    }
    
    markdown += `
`;
  });
  
  // Add resource type distribution
  const typeDistribution = calculateResourceTypeDistribution(results);
  markdown += `## Resource Type Distribution

- CODE: ${typeDistribution.CODE || 0}
- DOCUMENTATION: ${typeDistribution.DOCUMENTATION || 0}
- DATA: ${typeDistribution.DATA || 0}
- RESEARCH: ${typeDistribution.RESEARCH || 0}
- GENERATED: ${typeDistribution.GENERATED || 0}

`;
  
  // Add test details table
  markdown += `## Test Details

| Project Type | Token Budget | Resource Count | Priority Algorithm | Compression Level | Inclusion Rate | Token Utilization |
| --- | --- | --- | --- | --- | --- | --- |
`;
  
  results.forEach(result => {
    markdown += `| ${result.parameters.projectType} | ${result.parameters.tokenBudget} | ${result.parameters.resourceCount} | ${result.parameters.priorityAlgo} | ${result.parameters.compressionLevel} | ${(result.metrics.inclusionRate * 100).toFixed(2)}% | ${(result.metrics.tokenUtilization * 100).toFixed(2)}% |
`;
  });
  
  return markdown;
}

// Generate JSON report
function generateJsonReport(results, comparisons) {
  return JSON.stringify({
    summary: {
      totalRuns: results.length,
      averageInclusionRate: calculateMean(results.map(r => r.metrics.inclusionRate)),
      averageTokenUtilization: calculateMean(results.map(r => r.metrics.tokenUtilization)),
      averageCompressionRatio: calculateMean(results.map(r => r.metrics.averageCompressionRatio)),
      averageExecutionTime: calculateMean(results.map(r => r.metrics.executionTime))
    },
    comparisons,
    resourceTypeDistribution: calculateResourceTypeDistribution(results),
    testDetails: results.map(result => ({
      parameters: result.parameters,
      metrics: result.metrics
    }))
  }, null, 2);
}

// Calculate resource type distribution across all results
function calculateResourceTypeDistribution(results) {
  const distribution = {};
  let total = 0;
  
  results.forEach(result => {
    const resourceCounts = result.resourceCounts?.byType || {};
    
    for (const [type, count] of Object.entries(resourceCounts)) {
      distribution[type] = (distribution[type] || 0) + count;
      total += count;
    }
  });
  
  return distribution;
}

// Format metric name for display
function formatMetricName(metric) {
  // Convert camelCase to Title Case with Spaces
  const formatted = metric
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
  
  // Special case handling
  switch (metric) {
    case 'inclusionRate':
      return 'Inclusion Rate';
    case 'tokenUtilization':
      return 'Token Utilization';
    case 'averageCompressionRatio':
      return 'Compression Ratio';
    case 'executionTime':
      return 'Execution Time (ms)';
    default:
      return formatted;
  }
}

// Main function to run the analysis
async function runAnalysis() {
  log('Starting resource usage analysis');
  
  // Get all result directories
  const resultDirs = getResultDirectories();
  log(`Found ${resultDirs.length} result directories`);
  
  if (resultDirs.length === 0) {
    log('No results to analyze. Exiting.');
    return;
  }
  
  // Parse parameters and load results
  const resultData = [];
  for (const dir of resultDirs) {
    const params = parseDirectoryName(dir);
    if (!params) continue;
    
    const results = loadResults(dir);
    if (!results) continue;
    
    resultData.push({
      parameters: params,
      metrics: results.metrics,
      resourceCounts: results.resourceCounts,
      finalContext: results.finalContext
    });
  }
  
  log(`Successfully loaded ${resultData.length} result datasets`);
  
  // Determine parameters to compare
  const compareParams = options.compareParams.split(',');
  log(`Comparing results across parameters: ${compareParams.join(', ')}`);
  
  // Generate comparisons
  const comparisons = [];
  for (const param of compareParams) {
    comparisons.push(compareResults(resultData, param));
  }
  
  // Generate report
  log(`Generating ${options.format} report`);
  let report;
  switch (options.format) {
    case 'html':
      report = generateHtmlReport(resultData, comparisons);
      break;
    case 'markdown':
      report = generateMarkdownReport(resultData, comparisons);
      break;
    case 'json':
      report = generateJsonReport(resultData, comparisons);
      break;
    default:
      log(`Unknown format: ${options.format}. Defaulting to HTML.`);
      report = generateHtmlReport(resultData, comparisons);
  }
  
  // Write report to file
  const reportFileName = `resource-analysis.${options.format === 'json' ? 'json' : options.format === 'markdown' ? 'md' : 'html'}`;
  fs.writeFileSync(path.join(options.outputDir, reportFileName), report);
  
  log(`Analysis complete. Report saved to ${path.join(options.outputDir, reportFileName)}`);
}

// Run the analysis
runAnalysis().catch(error => {
  console.error('Analysis failed:', error);
  process.exit(1);
});
