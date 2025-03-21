/**
 * simple-cleanup-organizer.js
 * 
 * A simplified version of the cleanup organizer that analyzes the scripts directory
 * and suggests which files to keep, rename, or archive.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  scriptsDir: path.resolve(__dirname, '..', 'scripts'),
  outputDir: path.resolve(__dirname, '..', 'analysis-output'),
  toDeleteDir: path.resolve(__dirname, '..', 'scripts', 'TO_DELETE'),
  corePaths: [
    // Core MCP servers
    'unified-server.js',
    'simplified-rogerthat-server.js',
    'simplified-semantic-server.js',
    // Core utilities
    'fixed-codebase-analysis.js',
    'simple-cleanup-organizer.js'
  ],
  renameMappings: {
    'unified-server.js': 'mcp-unified-server.js',
    'simplified-rogerthat-server.js': 'mcp-token-server.js',
    'simplified-semantic-server.js': 'mcp-semantic-server.js'
  }
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
 * Check if a file looks like a test file
 */
function isTestFile(fileName) {
  return (
    fileName.startsWith('test-') ||
    fileName.includes('test.') ||
    fileName.includes('.test.') ||
    fileName.includes('spec.') ||
    fileName.includes('.spec.')
  );
}

/**
 * Analyze scripts and categorize them
 */
function analyzeScripts() {
  console.log('Analyzing scripts directory...');
  
  // Get all script files
  const scriptFiles = fs.readdirSync(CONFIG.scriptsDir)
    .filter(file => file.endsWith('.js') || file.endsWith('.ts'));
  
  console.log(`Found ${scriptFiles.length} script files`);
  
  // Categorize scripts
  const categorized = {
    coreMcpServers: [],
    testingScripts: [],
    analyzerScripts: [],
    utilityScripts: [],
    redundantScripts: [],
    uncategorized: []
  };
  
  for (const file of scriptFiles) {
    const fullPath = path.join(CONFIG.scriptsDir, file);
    const stats = fs.statSync(fullPath);
    const fileInfo = {
      name: file,
      path: fullPath,
      size: stats.size,
      lastModified: stats.mtime
    };
    
    // Check if it's in the core paths
    if (CONFIG.corePaths.includes(file)) {
      // Further check if it's a core MCP server
      if (['unified-server.js', 'simplified-rogerthat-server.js', 'simplified-semantic-server.js'].includes(file)) {
        categorized.coreMcpServers.push(fileInfo);
      } 
      // Check if it's an analyzer script
      else if (file.includes('analyzer') || file.includes('mapper')) {
        categorized.analyzerScripts.push(fileInfo);
      }
      // Otherwise it's a utility
      else {
        categorized.utilityScripts.push(fileInfo);
      }
    }
    // Check if it's a test script
    else if (isTestFile(file)) {
      categorized.testingScripts.push(fileInfo);
    }
    // Check if it's likely a redundant server implementation
    else if (file.includes('server') || file.includes('mock')) {
      categorized.redundantScripts.push(fileInfo);
    }
    // Anything else is uncategorized
    else {
      categorized.uncategorized.push(fileInfo);
    }
  }
  
  // Sort each category by name
  for (const category in categorized) {
    categorized[category].sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return categorized;
}

/**
 * Create rename/cleanup suggestions
 */
function createSuggestions(categorized) {
  const suggestions = {
    rename: [],
    archive: [],
    keep: []
  };
  
  // Suggest renaming for core MCP servers
  for (const file of categorized.coreMcpServers) {
    if (CONFIG.renameMappings[file.name]) {
      suggestions.rename.push({
        from: file.name,
        to: CONFIG.renameMappings[file.name],
        reason: 'Better name for consistent naming convention'
      });
    } else {
      suggestions.keep.push({
        file: file.name,
        reason: 'Core MCP server'
      });
    }
  }
  
  // Keep analysis scripts
  for (const file of categorized.analyzerScripts) {
    suggestions.keep.push({
      file: file.name,
      reason: 'Analysis utility'
    });
  }
  
  // Keep utility scripts
  for (const file of categorized.utilityScripts) {
    suggestions.keep.push({
      file: file.name,
      reason: 'Utility script'
    });
  }
  
  // Archive redundant scripts
  for (const file of categorized.redundantScripts) {
    suggestions.archive.push({
      file: file.name,
      reason: 'Redundant or unused server/mock implementation'
    });
  }
  
  // Archive uncategorized scripts (unless they were modified recently)
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  for (const file of categorized.uncategorized) {
    if (file.lastModified < twoWeeksAgo) {
      suggestions.archive.push({
        file: file.name,
        reason: 'Uncategorized script not modified recently'
      });
    } else {
      suggestions.keep.push({
        file: file.name,
        reason: 'Recently modified script'
      });
    }
  }
  
  // Determine which testing scripts to keep or archive
  // Keep tests for core servers
  for (const file of categorized.testingScripts) {
    let shouldKeep = false;
    
    // Check if test directly relates to a core server
    for (const coreServer of categorized.coreMcpServers) {
      const coreServerBase = path.basename(coreServer.name, '.js');
      if (file.name.includes(coreServerBase)) {
        shouldKeep = true;
        break;
      }
    }
    
    if (shouldKeep) {
      suggestions.keep.push({
        file: file.name,
        reason: 'Test for core component'
      });
    } else {
      suggestions.archive.push({
        file: file.name,
        reason: 'Test for non-core component'
      });
    }
  }
  
  return suggestions;
}

/**
 * Apply the suggestions (move files to TO_DELETE or rename them)
 */
function applySuggestions(suggestions, dryRun = true) {
  console.log(`${dryRun ? 'Simulating' : 'Applying'} suggestions:`);
  
  // Create TO_DELETE directory if it doesn't exist
  if (!dryRun && !fs.existsSync(CONFIG.toDeleteDir)) {
    fs.mkdirSync(CONFIG.toDeleteDir, { recursive: true });
    console.log(`Created directory: ${CONFIG.toDeleteDir}`);
  }
  
  // Archive files
  console.log('\nArchiving files:');
  for (const suggestion of suggestions.archive) {
    const sourceFile = path.join(CONFIG.scriptsDir, suggestion.file);
    const targetFile = path.join(CONFIG.toDeleteDir, suggestion.file);
    
    if (dryRun) {
      console.log(`Would move: ${sourceFile} -> ${targetFile}`);
      console.log(`  Reason: ${suggestion.reason}`);
    } else {
      try {
        fs.renameSync(sourceFile, targetFile);
        console.log(`Moved: ${sourceFile} -> ${targetFile}`);
      } catch (error) {
        console.error(`Error moving ${sourceFile}: ${error.message}`);
      }
    }
  }
  
  // Rename files
  console.log('\nRenaming files:');
  for (const suggestion of suggestions.rename) {
    const sourceFile = path.join(CONFIG.scriptsDir, suggestion.from);
    const targetFile = path.join(CONFIG.scriptsDir, suggestion.to);
    
    if (dryRun) {
      console.log(`Would rename: ${sourceFile} -> ${targetFile}`);
      console.log(`  Reason: ${suggestion.reason}`);
    } else {
      try {
        fs.renameSync(sourceFile, targetFile);
        console.log(`Renamed: ${sourceFile} -> ${targetFile}`);
      } catch (error) {
        console.error(`Error renaming ${sourceFile}: ${error.message}`);
      }
    }
  }
  
  // List files to keep
  console.log('\nKeeping files:');
  for (const suggestion of suggestions.keep) {
    console.log(`Keeping: ${suggestion.file}`);
    console.log(`  Reason: ${suggestion.reason}`);
  }
}

/**
 * Main function to run the organizer
 */
function organizeScripts(dryRun = true) {
  console.log('Starting script organization analysis...');
  
  // Analyze scripts
  const categorized = analyzeScripts();
  
  // Create suggestions
  const suggestions = createSuggestions(categorized);
  
  // Write analysis to file
  writeJsonOutput('scripts-analysis.json', { categorized, suggestions });
  
  // Print summary
  console.log('\nScript Analysis Summary:');
  console.log(`- Core MCP Servers: ${categorized.coreMcpServers.length}`);
  console.log(`- Testing Scripts: ${categorized.testingScripts.length}`);
  console.log(`- Analyzer Scripts: ${categorized.analyzerScripts.length}`);
  console.log(`- Utility Scripts: ${categorized.utilityScripts.length}`);
  console.log(`- Redundant Scripts: ${categorized.redundantScripts.length}`);
  console.log(`- Uncategorized Scripts: ${categorized.uncategorized.length}`);
  
  console.log('\nSuggested Actions:');
  console.log(`- Files to rename: ${suggestions.rename.length}`);
  console.log(`- Files to archive: ${suggestions.archive.length}`);
  console.log(`- Files to keep: ${suggestions.keep.length}`);
  
  // Apply suggestions if not a dry run
  applySuggestions(suggestions, dryRun);
  
  if (dryRun) {
    console.log('\nThis was a dry run - no changes were made.');
    console.log('To apply these changes, run:');
    console.log('  node scripts/simple-cleanup-organizer.js --apply');
  } else {
    console.log('\nChanges have been applied!');
  }
  
  return { categorized, suggestions };
}

// Run the organizer if this module is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  
  organizeScripts(!apply);
}

module.exports = {
  organizeScripts,
  analyzeScripts,
  createSuggestions,
  applySuggestions,
  writeJsonOutput,
  CONFIG
};
