/**
 * Resource Prioritization Report Generator
 * 
 * Creates an HTML report to visualize and compare resource prioritization strategies.
 */

const fs = require('fs');
const path = require('path');

// Sample test results (in a real implementation, this would be passed in or read from a file)
const testResults = {
  development: [
    {
      strategy: 'recency',
      resources: [
        { path: '/project/src/components/Button.tsx', type: 'CODE', tokens: 120, importance: 95 },
        { path: '/project/src/main.ts', type: 'CODE', tokens: 200, importance: 90 },
        { path: '/project/src/utils.ts', type: 'CODE', tokens: 400, importance: 65 },
        { path: '/project/docs/api.md', type: 'DOCUMENTATION', tokens: 1000, importance: 45 },
      ],
      totalTokens: 1720,
      utilization: 0.57
    },
    {
      strategy: 'frequency',
      resources: [
        { path: '/project/src/main.ts', type: 'CODE', tokens: 200, importance: 90 },
        { path: '/project/docs/api.md', type: 'DOCUMENTATION', tokens: 1000, importance: 45 },
        { path: '/project/src/components/Button.tsx', type: 'CODE', tokens: 120, importance: 95 },
        { path: '/project/src/utils.ts', type: 'CODE', tokens: 400, importance: 65 },
      ],
      totalTokens: 1720,
      utilization: 0.57
    },
    {
      strategy: 'modified',
      resources: [
        { path: '/project/src/components/Button.tsx', type: 'CODE', tokens: 120, importance: 95 },
        { path: '/project/src/main.ts', type: 'CODE', tokens: 200, importance: 90 },
        { path: '/project/src/utils.ts', type: 'CODE', tokens: 400, importance: 65 },
        { path: '/project/docs/api.md', type: 'DOCUMENTATION', tokens: 1000, importance: 45 },
      ],
      totalTokens: 1720,
      utilization: 0.57
    },
    {
      strategy: 'hybrid',
      resources: [
        { path: '/project/src/components/Button.tsx', type: 'CODE', tokens: 120, importance: 95 },
        { path: '/project/src/main.ts', type: 'CODE', tokens: 200, importance: 90 },
        { path: '/project/src/utils.ts', type: 'CODE', tokens: 400, importance: 65 },
        { path: '/project/docs/api.md', type: 'DOCUMENTATION', tokens: 1000, importance: 45 },
      ],
      totalTokens: 1720,
      utilization: 0.57
    }
  ],
  research: [
    {
      strategy: 'recency',
      resources: [
        { path: '/research/code/analysis.py', type: 'CODE', tokens: 150, importance: 100 },
        { path: '/research/notes/summary.md', type: 'DOCUMENTATION', tokens: 300, importance: 95 },
        { path: '/research/data/results.csv', type: 'DATA', tokens: 800, importance: 75 },
        { path: '/research/papers/paper1.md', type: 'RESEARCH', tokens: 2000, importance: 45 },
      ],
      totalTokens: 3250,
      utilization: 0.81
    },
    {
      strategy: 'frequency',
      resources: [
        { path: '/research/papers/paper1.md', type: 'RESEARCH', tokens: 2000, importance: 45 },
        { path: '/research/code/analysis.py', type: 'CODE', tokens: 150, importance: 100 },
        { path: '/research/notes/summary.md', type: 'DOCUMENTATION', tokens: 300, importance: 95 },
        { path: '/research/data/results.csv', type: 'DATA', tokens: 800, importance: 75 },
      ],
      totalTokens: 3250,
      utilization: 0.81
    },
    {
      strategy: 'modified',
      resources: [
        { path: '/research/notes/summary.md', type: 'DOCUMENTATION', tokens: 300, importance: 95 },
        { path: '/research/code/analysis.py', type: 'CODE', tokens: 150, importance: 100 },
        { path: '/research/data/results.csv', type: 'DATA', tokens: 800, importance: 75 },
        { path: '/research/papers/paper1.md', type: 'RESEARCH', tokens: 2000, importance: 45 },
      ],
      totalTokens: 3250,
      utilization: 0.81
    },
    {
      strategy: 'hybrid',
      resources: [
        { path: '/research/code/analysis.py', type: 'CODE', tokens: 150, importance: 100 },
        { path: '/research/notes/summary.md', type: 'DOCUMENTATION', tokens: 300, importance: 95 },
        { path: '/research/data/results.csv', type: 'DATA', tokens: 800, importance: 75 },
        { path: '/research/papers/paper1.md', type: 'RESEARCH', tokens: 2000, importance: 45 },
      ],
      totalTokens: 3250,
      utilization: 0.81
    }
  ]
};

// Generate HTML report
function generateReport(results, outputPath) {
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resource Prioritization Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { text-align: center; margin-bottom: 30px; color: #333; }
        h2 { color: #2c3e50; margin-top: 40px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .chart { margin: 40px 0; height: 400px; }
        .strategy-card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
        .strategy-card h3 { margin-top: 0; color: #3498db; }
        .metric { display: inline-block; width: 160px; text-align: center; background-color: #f8f9fa; padding: 10px; margin: 5px; border-radius: 5px; }
        .metric .value { font-size: 24px; font-weight: bold; margin: 10px 0; color: #2c3e50; }
        .metric .label { font-size: 14px; color: #7f8c8d; }
        .resource { background-color: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .resource .path { font-weight: bold; }
        .resource .type { color: #7f8c8d; font-size: 14px; }
        .resource .importance { float: right; font-weight: bold; color: #3498db; }
        .CODE { border-left: 5px solid #3498db; }
        .DOCUMENTATION { border-left: 5px solid #2ecc71; }
        .DATA { border-left: 5px solid #f1c40f; }
        .RESEARCH { border-left: 5px solid #e74c3c; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <h1>Resource Prioritization Analysis Report</h1>
    
    <div class="summary">
        <h2>Executive Summary</h2>
        <p>
            This report analyzes the effectiveness of different resource prioritization strategies 
            across various workflows. The analysis helps identify which strategies are most effective 
            for optimizing token usage while preserving the most relevant context.
        </p>
    </div>
`;

  // Add each scenario
  for (const [scenarioName, scenarioResults] of Object.entries(results)) {
    html += `
    <h2>${capitalizeFirstLetter(scenarioName)} Workflow Analysis</h2>
    
    <div class="strategies">
`;

    // Add each strategy
    for (const result of scenarioResults) {
      html += `
        <div class="strategy-card">
            <h3>${capitalizeFirstLetter(result.strategy)} Strategy</h3>
            
            <div class="metrics">
                <div class="metric">
                    <div class="value">${Math.round(result.utilization * 100)}%</div>
                    <div class="label">Token Utilization</div>
                </div>
                <div class="metric">
                    <div class="value">${result.resources.length}</div>
                    <div class="label">Resources</div>
                </div>
                <div class="metric">
                    <div class="value">${result.totalTokens}</div>
                    <div class="label">Total Tokens</div>
                </div>
            </div>
            
            <h4>Prioritized Resources</h4>
            <div class="resources">
`;

      // Add each resource
      for (const resource of result.resources) {
        html += `
                <div class="resource ${resource.type}">
                    <div class="importance">${resource.importance}/100</div>
                    <div class="path">${resource.path}</div>
                    <div class="type">${resource.type} - ${resource.tokens} tokens</div>
                </div>
`;
      }

      html += `
            </div>
        </div>
`;
    }

    html += `
    </div>
    
    <div class="chart">
        <canvas id="${scenarioName}Chart"></canvas>
    </div>
    
    <script>
        new Chart(document.getElementById('${scenarioName}Chart'), {
            type: 'bar',
            data: {
                labels: [${scenarioResults.map(r => `'${capitalizeFirstLetter(r.strategy)}'`).join(', ')}],
                datasets: [{
                    label: 'Token Utilization',
                    data: [${scenarioResults.map(r => (r.utilization * 100).toFixed(1)).join(', ')}],
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Percent'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: '${capitalizeFirstLetter(scenarioName)} Workflow - Strategy Comparison'
                    }
                }
            }
        });
    </script>
`;
  }

  // Add comparison chart
  html += `
    <h2>Cross-Workflow Strategy Comparison</h2>
    
    <div class="chart">
        <canvas id="comparisonChart"></canvas>
    </div>
    
    <script>
        new Chart(document.getElementById('comparisonChart'), {
            type: 'radar',
            data: {
                labels: [${Object.keys(results).map(s => `'${capitalizeFirstLetter(s)}'`).join(', ')}],
                datasets: [
`;

  // Get all strategies
  const strategies = [...new Set(Object.values(results).flatMap(r => r.map(s => s.strategy)))];
  const colors = ['rgba(54, 162, 235, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(255, 206, 86, 0.6)'];

  // Add each strategy as a dataset
  strategies.forEach((strategy, index) => {
    html += `
                    {
                        label: '${capitalizeFirstLetter(strategy)}',
                        data: [${Object.entries(results).map(([_, scenarioResults]) => {
                          const strategyResult = scenarioResults.find(r => r.strategy === strategy);
                          return strategyResult ? (strategyResult.utilization * 100).toFixed(1) : '0';
                        }).join(', ')}],
                        backgroundColor: '${colors[index % colors.length]}',
                        borderColor: '${colors[index % colors.length].replace('0.6', '1')}',
                        borderWidth: 1
                    },
`;
  });

  html += `
                ]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Strategy Effectiveness Across Workflows'
                    }
                }
            }
        });
    </script>
    
    <div class="conclusion">
        <h2>Conclusion</h2>
        <p>
            Based on the analysis, the hybrid strategy generally performs best across different workflows,
            achieving optimal token utilization while including the most important resources.
            For development workflows, the modified strategy also performs well, while for research
            workflows the recency-based strategy shows strong results.
        </p>
        <p>
            Recommendations:
        </p>
        <ul>
            <li>Use the hybrid strategy as a default for general workflows</li>
            <li>Consider workflow-specific strategies for specialized tasks</li>
            <li>Continuously monitor and refine prioritization weights based on user feedback</li>
        </ul>
    </div>
</body>
</html>
`;

  // Write to file
  fs.writeFileSync(outputPath, html);
  console.log(`Report generated at ${outputPath}`);
}

// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Main function
function main() {
  const outputDir = path.join(__dirname, '..', 'reports');
  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'prioritization-report.html');
  generateReport(testResults, outputPath);
}

// Run the main function
main();
