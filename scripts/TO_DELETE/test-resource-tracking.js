/**
 * Test Resource Tracking System
 * 
 * Automated script to run tests for the resource tracking system and generate reports.
 * This script simulates realistic usage patterns and validates token management,
 * resource prioritization, and context optimization.
 */

const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Configuration - adjust as needed
const CONFIG = {
  // Test parameters
  SESSION_ID: `test-session-${Date.now()}`,
  TOKEN_BUDGET: 8000,
  TEST_DURATION_MS: 30000, // 30 seconds by default
  PROJECTS_TO_TEST: [
    // Add real project paths to test with
    path.join(__dirname, '..'),
    // Add more project paths as needed
  ],
  
  // Test files to focus on (if empty, will select randomly)
  FOCUS_FILES: [
    'ResourceTracker.ts',
    'TokenCounter.ts',
    'ResourcePrioritizationRunner.ts',
    'resource-logger.ts'
  ],
  
  // Output paths
  REPORT_DIR: path.join(__dirname, '../test-results'),
  METRICS_FILE: 'resource-metrics.md',
  SUMMARY_FILE: 'test-summary.json',
  
  // Access patterns to simulate
  ACCESS_PATTERNS: {
    VIEW_PROBABILITY: 0.7,    // 70% of accesses are views
    EDIT_PROBABILITY: 0.2,    // 20% of accesses are edits
    REFERENCE_PROBABILITY: 0.1, // 10% of accesses are references
    
    REPEAT_ACCESS_FACTOR: 0.4, // 40% chance of accessing a recently accessed file
    RELATED_FILE_FACTOR: 0.3,  // 30% chance of accessing a related file
  }
};

// Ensure report directory exists
async function ensureReportDir() {
  try {
    await fs.mkdir(CONFIG.REPORT_DIR, { recursive: true });
    console.log(`Report directory created: ${CONFIG.REPORT_DIR}`);
  } catch (err) {
    console.error('Error creating report directory:', err);
    throw err;
  }
}

// Get all files in a directory recursively
async function getAllFiles(dir, fileList = []) {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory() && !file.startsWith('node_modules') && !file.startsWith('.git')) {
      await getAllFiles(filePath, fileList);
    } else if (stats.isFile()) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Determine file type based on extension
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Code files
  if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rb', '.php', '.swift', '.html', '.css', '.scss', '.sql'].includes(ext)) {
    return 'CODE';
  }
  
  // Documentation files
  if (['.md', '.txt', '.pdf', '.rst', '.adoc', '.docx'].includes(ext)) {
    return 'DOCUMENTATION';
  }
  
  // Data files
  if (['.json', '.csv', '.xml', '.yaml', '.yml', '.toml', '.ini', '.xls', '.xlsx'].includes(ext)) {
    return 'DATA';
  }
  
  // Default to documentation
  return 'DOCUMENTATION';
}

// Calculate artificial importance for a file to guide the simulation
function calculateFileImportance(filePath, accessCount, lastAccessTime, isModified) {
  // Focus on the specified files
  const fileName = path.basename(filePath);
  const focusFactor = CONFIG.FOCUS_FILES.includes(fileName) ? 2.0 : 1.0;
  
  // Calculate recency factor (0-10)
  const hoursSinceAccess = (Date.now() - lastAccessTime) / (1000 * 60 * 60);
  const recencyFactor = Math.max(0, 10 - hoursSinceAccess);
  
  // Calculate frequency factor (0-10)
  const frequencyFactor = Math.min(10, accessCount);
  
  // Additional factor for modified files
  const modifiedFactor = isModified ? 15 : 0;
  
  // Calculate base score
  let score = (recencyFactor + frequencyFactor + modifiedFactor) * focusFactor;
  
  // Add some randomness
  score += Math.random() * 10;
  
  return Math.min(100, score);
}

// Simulate resource tracking and access patterns
async function simulateResourceAccess(files) {
  // Import the modules
  const { ResourceTracker, AccessType, ResourceType } = require('../lib/resource-tracking/ResourceTracker');
  const { ResourcePrioritizationRunner } = require('../lib/resource-tracking/ResourcePrioritizationRunner');
  
  console.log(`\nStarting resource access simulation with session ID: ${CONFIG.SESSION_ID}`);
  console.log(`Token budget: ${CONFIG.TOKEN_BUDGET}, Duration: ${CONFIG.TEST_DURATION_MS / 1000}s\n`);
  
  // Create the resource prioritization runner
  const runner = new ResourcePrioritizationRunner(CONFIG.SESSION_ID);
  
  // Keep track of accessed files for realistic simulation
  const accessedFiles = new Map();
  
  // Track related files for realistic access patterns
  const relatedFiles = new Map();
  files.forEach(file => {
    // Group files by directory as "related"
    const dir = path.dirname(file);
    if (!relatedFiles.has(dir)) {
      relatedFiles.set(dir, []);
    }
    relatedFiles.get(dir).push(file);
    
    // Also group files by basename (without extension) to find related files
    const baseName = path.basename(file, path.extname(file));
    if (!relatedFiles.has(baseName)) {
      relatedFiles.set(baseName, []);
    }
    relatedFiles.get(baseName).push(file);
  });
  
  // Helper function to choose the next file to access
  function chooseNextFile() {
    // Decide whether to access a previously accessed file
    if (accessedFiles.size > 0 && Math.random() < CONFIG.ACCESS_PATTERNS.REPEAT_ACCESS_FACTOR) {
      // Choose a previously accessed file, weighted by importance
      const fileEntries = Array.from(accessedFiles.entries());
      const totalImportance = fileEntries.reduce((sum, [_, metadata]) => sum + metadata.importance, 0);
      let randomValue = Math.random() * totalImportance;
      
      for (const [file, metadata] of fileEntries) {
        randomValue -= metadata.importance;
        if (randomValue <= 0) {
          return file;
        }
      }
      
      // Fallback
      return fileEntries[0][0];
    }
    
    // Decide whether to access a related file
    if (accessedFiles.size > 0 && Math.random() < CONFIG.ACCESS_PATTERNS.RELATED_FILE_FACTOR) {
      // Choose a random accessed file
      const accessedFilesArray = Array.from(accessedFiles.keys());
      const randomAccessedFile = accessedFilesArray[Math.floor(Math.random() * accessedFilesArray.length)];
      
      // Find related files
      const dir = path.dirname(randomAccessedFile);
      const relatedInDir = relatedFiles.get(dir) || [];
      
      const baseName = path.basename(randomAccessedFile, path.extname(randomAccessedFile));
      const relatedByName = relatedFiles.get(baseName) || [];
      
      // Combine related files
      const related = [...new Set([...relatedInDir, ...relatedByName])];
      
      // Filter out the source file
      const otherRelated = related.filter(f => f !== randomAccessedFile);
      
      // Choose a random related file if available
      if (otherRelated.length > 0) {
        return otherRelated[Math.floor(Math.random() * otherRelated.length)];
      }
    }
    
    // Choose a random file
    return files[Math.floor(Math.random() * files.length)];
  }
  
  // Helper function to choose access type
  function chooseAccessType() {
    const random = Math.random();
    if (random < CONFIG.ACCESS_PATTERNS.VIEW_PROBABILITY) {
      return AccessType.VIEW;
    } else if (random < CONFIG.ACCESS_PATTERNS.VIEW_PROBABILITY + CONFIG.ACCESS_PATTERNS.EDIT_PROBABILITY) {
      return AccessType.EDIT;
    } else {
      return AccessType.REFERENCE;
    }
  }
  
  // Run the simulation
  const startTime = Date.now();
  let iterationCount = 0;
  let prioritizationCount = 0;
  
  while (Date.now() - startTime < CONFIG.TEST_DURATION_MS) {
    iterationCount++;
    
    // Choose a file to access
    const file = chooseNextFile();
    const accessType = chooseAccessType();
    const fileType = getFileType(file);
    
    // Determine file size
    let fileSize;
    try {
      const stats = await fs.stat(file);
      fileSize = stats.size;
    } catch (err) {
      fileSize = 1024; // Default if can't get size
    }
    
    // Prepare metadata
    const isModified = accessType === AccessType.EDIT;
    const metadata = {
      size: fileSize,
      modified: isModified
    };
    
    // Track the access
    runner.trackResourceAccess(
      file,
      ResourceType[fileType],
      accessType,
      metadata
    );
    
    // Update our tracking for simulation purposes
    if (!accessedFiles.has(file)) {
      accessedFiles.set(file, {
        accessCount: 0,
        lastAccess: Date.now(),
        modified: false,
        importance: 0
      });
    }
    
    const metadata2 = accessedFiles.get(file);
    metadata2.accessCount++;
    metadata2.lastAccess = Date.now();
    metadata2.modified = metadata2.modified || isModified;
    metadata2.importance = calculateFileImportance(
      file,
      metadata2.accessCount,
      metadata2.lastAccess,
      metadata2.modified
    );
    
    // Occasionally run prioritization
    if (iterationCount % 20 === 0) {
      prioritizationCount++;
      console.log(`Prioritizing resources (run ${prioritizationCount})...`);
      
      // Run prioritization
      const prioritizedResources = await runner.prioritizeResourcesForContext(CONFIG.TOKEN_BUDGET);
      
      console.log(`Prioritized ${prioritizedResources.length} resources within token budget.`);
      console.log(`Top 3 resources:`);
      
      // Log top 3 resources
      for (let i = 0; i < Math.min(3, prioritizedResources.length); i++) {
        const resource = prioritizedResources[i];
        console.log(`  ${i+1}. ${path.basename(resource)}`);
      }
      console.log('');
    }
    
    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  console.log(`\nSimulation completed with ${iterationCount} access events and ${prioritizationCount} prioritization runs.`);
  
  // Generate metrics report
  console.log('\nGenerating metrics report...');
  const report = await runner.generateMetricsReport();
  
  // Save the report
  const reportPath = path.join(CONFIG.REPORT_DIR, CONFIG.METRICS_FILE);
  await fs.writeFile(reportPath, report);
  console.log(`Metrics report saved to: ${reportPath}`);
  
  // Clean up resources
  await runner.dispose();
  
  // Return simulation data for summary
  return {
    sessionId: CONFIG.SESSION_ID,
    iterationCount,
    prioritizationCount,
    uniqueFiles: accessedFiles.size,
    tokenBudget: CONFIG.TOKEN_BUDGET,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString()
  };
}

// Run the tests and generate reports
async function runTests() {
  try {
    console.log('='.repeat(80));
    console.log('RESOURCE TRACKING SYSTEM TEST');
    console.log('RogerThat - Token Management System');
    console.log('='.repeat(80));
    
    // Ensure report directory exists
    await ensureReportDir();
    
    // Run unit tests first
    console.log('\nRunning unit tests...');
    try {
      // Using npx jest with specific pattern to run only resource tracking tests
      const { stdout, stderr } = await exec('npx jest --testPathPattern=resource-tracking|token-counting');
      console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (err) {
      console.error('Unit tests failed:', err.message);
      console.log(err.stdout || '');
      console.error(err.stderr || '');
      // Continue with the simulation even if tests fail
    }
    
    // Run the resource tracking simulation
    let simulationResults = [];
    
    for (const projectPath of CONFIG.PROJECTS_TO_TEST) {
      console.log(`\nCollecting files from project: ${projectPath}`);
      const files = await getAllFiles(projectPath);
      console.log(`Found ${files.length} files.`);
      
      // Run simulation
      const result = await simulateResourceAccess(files);
      simulationResults.push(result);
    }
    
    // Save summary
    const summaryPath = path.join(CONFIG.REPORT_DIR, CONFIG.SUMMARY_FILE);
    await fs.writeFile(summaryPath, JSON.stringify(simulationResults, null, 2));
    console.log(`\nTest summary saved to: ${summaryPath}`);
    
    console.log('\nAll tests completed successfully!');
  } catch (err) {
    console.error('Error running tests:', err);
  }
}

// Run the tests
runTests().catch(console.error);
