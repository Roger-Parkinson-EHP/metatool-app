/**
 * RogerThat Feedback-Driven Testing Script
 * 
 * This script runs automated tests on the resource tracking system and collects
 * feedback data that can be used to improve prioritization algorithms and token usage.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Configuration
const CONFIG = {
  TEST_SESSIONS: 3,                  // Number of test sessions to run
  TOKEN_BUDGETS: [4000, 8000, 16000], // Token budgets to test
  SESSION_DURATION_MS: 20000,        // 20 seconds per session
  RESULT_DIR: path.join(__dirname, '../test-results/feedback'),
  PROJECTS_DIR: path.join(__dirname, '..'),
  FEEDBACK_FILE: 'feedback-data.json',
  PRIORITY_ALGORITHMS: [
    'recency',    // Prioritize recently accessed resources
    'frequency',  // Prioritize frequently accessed resources
    'hybrid',     // Combine recency and frequency
    'modified',   // Prioritize modified resources first
    'type-aware', // Consider resource type in prioritization
  ]
};

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(CONFIG.RESULT_DIR, { recursive: true });
  console.log(`Created results directory: ${CONFIG.RESULT_DIR}`);
}

// Get a list of all files in the project
async function getAllFiles(dir, excludeDirs = ['node_modules', '.git', '.next', 'out']) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name)) {
        files.push(...(await getAllFiles(fullPath, excludeDirs)));
      }
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Mock user behavior by simulating access patterns
async function simulateUserBehavior(runner, files, durationMs, algorithm) {
  console.log(`Simulating user behavior with '${algorithm}' algorithm...`);
  
  const startTime = Date.now();
  const recentlyAccessed = [];
  let accessCount = 0;
  const stats = {
    viewCount: 0,
    editCount: 0,
    referenceCount: 0,
    uniqueFiles: new Set(),
    tokenSavings: 0,
    coverage: 0,
  };
  
  // Import the necessary types
  const { AccessType, ResourceType } = require('../lib/resource-tracking/ResourceTracker');
  
  // Determine file type based on extension
  function getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Code files
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rb', '.php'].includes(ext)) {
      return ResourceType.CODE;
    }
    
    // Documentation files
    if (['.md', '.txt', '.pdf', '.rst', '.adoc', '.docx'].includes(ext)) {
      return ResourceType.DOCUMENTATION;
    }
    
    // Data files
    if (['.json', '.csv', '.xml', '.yaml', '.yml', '.toml', '.ini', '.xls', '.xlsx'].includes(ext)) {
      return ResourceType.DATA;
    }
    
    // Default to documentation
    return ResourceType.DOCUMENTATION;
  }
  
  // Different access probabilities based on algorithm
  const algoProbabilities = {
    recency: {
      recent: 0.7,  // 70% chance to access recently accessed files
      edit: 0.2,    // 20% chance to edit a file
      reference: 0.1 // 10% chance to reference a file
    },
    frequency: {
      recent: 0.4,   // 40% chance to access recently accessed files
      edit: 0.2,     // 20% chance to edit a file
      reference: 0.1  // 10% chance to reference a file
    },
    hybrid: {
      recent: 0.5,    // 50% chance to access recently accessed files
      edit: 0.3,      // 30% chance to edit a file
      reference: 0.15  // 15% chance to reference a file
    },
    modified: {
      recent: 0.4,     // 40% chance to access recently accessed files
      edit: 0.5,       // 50% chance to edit a file
      reference: 0.1    // 10% chance to reference a file
    },
    'type-aware': {
      recent: 0.5,      // 50% chance to access recently accessed files
      edit: 0.3,        // 30% chance to edit a file
      reference: 0.2,    // 20% chance to reference a file
      // This will prioritize certain file types based on a "focus" pattern
      typeFocus: {
        CODE: 0.6,           // 60% focus on code files
        DOCUMENTATION: 0.3,  // 30% focus on documentation
        DATA: 0.1            // 10% focus on data files
      }
    }
  };
  
  // Use the selected algorithm's probabilities, or hybrid as default
  const probs = algoProbabilities[algorithm] || algoProbabilities.hybrid;
  
  // Group files by type to support type-aware algorithm
  const filesByType = {};
  for (const file of files) {
    const type = getFileType(file);
    if (!filesByType[type]) {
      filesByType[type] = [];
    }
    filesByType[type].push(file);
  }
  
  // Periodically prioritize resources
  let lastPrioritization = 0;
  
  while (Date.now() - startTime < durationMs) {
    // Choose a file to access
    let file;
    
    // Decide whether to access a recent file or a new one
    if (recentlyAccessed.length > 0 && Math.random() < probs.recent) {
      // Choose a recently accessed file, weighted by recency
      const index = Math.floor(Math.random() * Math.min(5, recentlyAccessed.length));
      file = recentlyAccessed[index];
    } else {
      // Choose a file based on type priorities if using type-aware algorithm
      if (algorithm === 'type-aware') {
        const typeRand = Math.random();
        let typeSum = 0;
        let selectedType;
        
        for (const [type, prob] of Object.entries(probs.typeFocus)) {
          typeSum += prob;
          if (typeRand <= typeSum) {
            selectedType = type;
            break;
          }
        }
        
        const typeFiles = filesByType[selectedType] || files;
        file = typeFiles[Math.floor(Math.random() * typeFiles.length)];
      } else {
        // Choose a random file
        file = files[Math.floor(Math.random() * files.length)];
      }
    }
    
    // Decide on access type
    let accessType;
    const accessRand = Math.random();
    
    if (accessRand < probs.edit) {
      accessType = AccessType.EDIT;
      stats.editCount++;
    } else if (accessRand < probs.edit + probs.reference) {
      accessType = AccessType.REFERENCE;
      stats.referenceCount++;
    } else {
      accessType = AccessType.VIEW;
      stats.viewCount++;
    }
    
    // Get file size
    let fileSize;
    try {
      const stats = await fs.stat(file);
      fileSize = stats.size;
    } catch (err) {
      fileSize = 1024; // Default if can't get size
    }
    
    // Track the access
    runner.trackResourceAccess(
      file,
      getFileType(file),
      accessType,
      { 
        size: fileSize,
        modified: accessType === AccessType.EDIT
      }
    );
    
    // Add to recently accessed (at the start)
    if (recentlyAccessed.includes(file)) {
      recentlyAccessed.splice(recentlyAccessed.indexOf(file), 1);
    }
    recentlyAccessed.unshift(file);
    
    // Keep recentlyAccessed to a reasonable size
    if (recentlyAccessed.length > 10) {
      recentlyAccessed.pop();
    }
    
    stats.uniqueFiles.add(file);
    accessCount++;
    
    // Prioritize resources every 20 accesses or if it's been a while
    if (accessCount % 20 === 0 || (Date.now() - lastPrioritization > 2000)) {
      lastPrioritization = Date.now();
      
      // Get the token budget for the current run
      const tokenBudget = CONFIG.TOKEN_BUDGETS[
        Math.floor(Math.random() * CONFIG.TOKEN_BUDGETS.length)
      ];
      
      // Run prioritization
      await runner.prioritizeResourcesForContext(tokenBudget);
    }
    
    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Calculate final stats
  const allResources = await runner.generateMetricsReport();
  const includedResources = allResources.match(/Included in Context: (\d+)/)?.[1] || 0;
  const totalResources = allResources.match(/Total Resources: (\d+)/)?.[1] || 1;
  
  stats.uniqueFilesCount = stats.uniqueFiles.size;
  stats.totalAccesses = accessCount;
  stats.coverage = (includedResources / Math.min(totalResources, stats.uniqueFiles.size)) * 100;
  
  return stats;
}

// Run a complete test session
async function runTestSession(sessionId, tokenBudget, algorithm) {
  console.log(`\n*** Starting test session ${sessionId} with ${tokenBudget} token budget and '${algorithm}' algorithm ***\n`);
  
  // Load ResourcePrioritizationRunner
  const { ResourcePrioritizationRunner } = require('../lib/resource-tracking/ResourcePrioritizationRunner');
  
  // Initialize the runner
  console.log('Creating session...');
  const runner = new ResourcePrioritizationRunner(sessionId);
  
  // Get all files in the project
  console.log('Scanning project files...');
  const files = await getAllFiles(CONFIG.PROJECTS_DIR);
  console.log(`Found ${files.length} files for testing.`);
  
  // Run simulated user behavior
  const stats = await simulateUserBehavior(runner, files, CONFIG.SESSION_DURATION_MS, algorithm);
  
  // Generate metrics report
  console.log('Generating metrics report...');
  const report = await runner.generateMetricsReport();
  
  // Save the report
  const reportPath = path.join(
    CONFIG.RESULT_DIR, 
    `report_${sessionId}_${tokenBudget}_${algorithm}.md`
  );
  await fs.writeFile(reportPath, report);
  console.log(`Metrics report saved to: ${reportPath}`);
  
  // Clean up resources
  await runner.dispose();
  
  return {
    sessionId,
    tokenBudget,
    algorithm,
    uniqueFiles: stats.uniqueFilesCount,
    totalAccesses: stats.totalAccesses,
    viewCount: stats.viewCount,
    editCount: stats.editCount,
    referenceCount: stats.referenceCount,
    coverage: stats.coverage,
    timestamp: new Date().toISOString()
  };
}

// Run tests with different algorithms and token budgets
async function runAllTests() {
  const results = [];
  
  let testNumber = 1;
  for (const tokenBudget of CONFIG.TOKEN_BUDGETS) {
    for (const algorithm of CONFIG.PRIORITY_ALGORITHMS) {
      const sessionId = `test-${testNumber}-${algorithm}-${tokenBudget}`;
      const result = await runTestSession(sessionId, tokenBudget, algorithm);
      results.push(result);
      testNumber++;
    }
  }
  
  return results;
}

// Generate feedback report based on test results
async function generateFeedbackReport(results) {
  // Find best algorithm for each token budget
  const bestAlgoByBudget = {};
  
  for (const budget of CONFIG.TOKEN_BUDGETS) {
    const budgetResults = results.filter(r => r.tokenBudget === budget);
    
    // Sort by coverage (descending)
    budgetResults.sort((a, b) => b.coverage - a.coverage);
    
    bestAlgoByBudget[budget] = budgetResults[0]?.algorithm || 'unknown';
  }
  
  // Generate recommendations
  const recommendations = [
    '## Recommendations',
    '',
    'Based on the test results, the following optimizations are recommended:',
    ''
  ];
  
  for (const [budget, algo] of Object.entries(bestAlgoByBudget)) {
    recommendations.push(`- For ${budget} token budget: Use the '${algo}' prioritization algorithm`);
  }
  
  // Calculate algorithm performance across all budgets
  const algoPerformance = {};
  
  for (const algo of CONFIG.PRIORITY_ALGORITHMS) {
    const algoResults = results.filter(r => r.algorithm === algo);
    const avgCoverage = algoResults.reduce((sum, r) => sum + r.coverage, 0) / algoResults.length;
    
    algoPerformance[algo] = avgCoverage;
  }
  
  // Sort algorithms by average coverage
  const sortedAlgos = Object.entries(algoPerformance)
    .sort(([, a], [, b]) => b - a)
    .map(([algo, coverage]) => ({ algo, coverage }));
  
  recommendations.push('');
  recommendations.push('## Overall Algorithm Performance');
  recommendations.push('');
  
  for (const { algo, coverage } of sortedAlgos) {
    recommendations.push(`- ${algo}: ${coverage.toFixed(2)}% average coverage`);
  }
  
  // Generate the full report
  const report = [
    '# RogerThat Feedback-Driven Test Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Test Configuration',
    '',
    `- Test Sessions: ${results.length}`,
    `- Token Budgets Tested: ${CONFIG.TOKEN_BUDGETS.join(', ')}`,
    `- Algorithms Tested: ${CONFIG.PRIORITY_ALGORITHMS.join(', ')}`,
    `- Session Duration: ${CONFIG.SESSION_DURATION_MS / 1000} seconds`,
    '',
    ...recommendations,
    '',
    '## Detailed Results',
    '',
    'Session ID | Token Budget | Algorithm | Coverage | Unique Files | Total Accesses',
    '--- | --- | --- | --- | --- | ---'
  ];
  
  for (const result of results) {
    report.push(
      `${result.sessionId} | ${result.tokenBudget} | ${result.algorithm} | ` +
      `${result.coverage.toFixed(2)}% | ${result.uniqueFiles} | ${result.totalAccesses}`
    );
  }
  
  return report.join('\n');
}

// Main function
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('ROGERTHAT FEEDBACK-DRIVEN TESTING');
    console.log('='.repeat(80));
    
    await ensureDirectories();
    
    console.log('\nRunning automated feedback tests...');
    const results = await runAllTests();
    
    // Save raw results
    const resultsPath = path.join(CONFIG.RESULT_DIR, CONFIG.FEEDBACK_FILE);
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nRaw test results saved to: ${resultsPath}`);
    
    // Generate and save feedback report
    const report = await generateFeedbackReport(results);
    const reportPath = path.join(CONFIG.RESULT_DIR, 'feedback-report.md');
    await fs.writeFile(reportPath, report);
    console.log(`Feedback report saved to: ${reportPath}`);
    
    console.log('\nAll tests completed successfully!');
  } catch (err) {
    console.error('Error running tests:', err);
  }
}

// Run the script
main().catch(console.error);
