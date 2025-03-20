/**
 * analyzer-utils.js
 * 
 * Shared utility functions for codebase analysis scripts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Default configuration
const DEFAULT_CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  outputDir: path.resolve(__dirname, '..', 'analysis-output'),
  excludeDirs: ['node_modules', '.git', '.next', 'dist', '.venv', '.venv-python-repl', 'TO_DELETE'],
  includeExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.md', '.json', '.bat'],
  analysisModules: ['all'],
  reportFormats: ['json', 'html'],
  verbose: true,
  maxAnalysisDepth: 3,
  targetFiles: {
    servers: [
      'scripts/mcp-unified-server.js',
      'scripts/mcp-token-server.js',
      'scripts/mcp-semantic-server.js'
    ],
    config: 'C:/Users/roger/AppData/Roaming/Claude/claude_desktop_config.json'
  }
};

/**
 * Parse command-line arguments into a configuration object
 */
function parseArgs(args) {
  const config = { ...DEFAULT_CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      
      switch (key) {
        case 'modules':
          config.analysisModules = value.split(',');
          break;
        case 'format':
        case 'formats':
          config.reportFormats = value.split(',');
          break;
        case 'depth':
          config.maxAnalysisDepth = parseInt(value, 10);
          break;
        case 'output':
          config.outputDir = path.resolve(value);
          break;
        case 'verbose':
          config.verbose = value !== 'false';
          break;
        default:
          console.warn(`Unknown option: ${key}`);
      }
    }
  }
  
  return config;
}

/**
 * Merge a custom configuration with the default configuration
 */
function parseConfig(options = {}) {
  return { ...DEFAULT_CONFIG, ...options };
}

/**
 * Ensure the output directory exists
 */
function ensureOutputDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created output directory: ${dir}`);
  }
  return dir;
}

/**
 * Write a JSON file to the output directory
 */
function writeJsonOutput(outputDir, filename, data) {
  ensureOutputDirectory(outputDir);
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${filePath}`);
  return filePath;
}

/**
 * Format file size in a human-readable way
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Read a file's content safely
 */
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get all files in a directory recursively
 */
function getAllFiles(dir, excludeDirs = DEFAULT_CONFIG.excludeDirs, includeExtensions = DEFAULT_CONFIG.includeExtensions) {
  let results = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
  
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip excluded directories
        if (excludeDirs.includes(entry.name)) {
          continue;
        }
        
        // Recursively get files from subdirectories
        results = results.concat(getAllFiles(fullPath, excludeDirs, includeExtensions));
      } else {
        // Check file extension
        const ext = path.extname(entry.name).toLowerCase();
        if (!includeExtensions.includes(ext) && includeExtensions.length > 0) {
          continue;
        }
        
        results.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return results;
}

/**
 * Detect the programming language based on file extension
 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  const languageMap = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript (React)',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript (React)',
    '.py': 'Python',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
    '.cs': 'C#',
    '.go': 'Go',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.md': 'Markdown',
    '.json': 'JSON',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sql': 'SQL',
    '.sh': 'Shell',
    '.bat': 'Batch',
    '.ps1': 'PowerShell'
  };
  
  return languageMap[ext] || 'Unknown';
}

/**
 * Format elapsed time in a human-readable way
 */
function formatElapsedTime(startTimeMs) {
  const elapsedMs = Date.now() - startTimeMs;
  
  if (elapsedMs < 1000) return `${elapsedMs}ms`;
  if (elapsedMs < 60 * 1000) return `${(elapsedMs / 1000).toFixed(2)}s`;
  
  const minutes = Math.floor(elapsedMs / (60 * 1000));
  const seconds = ((elapsedMs % (60 * 1000)) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
}

module.exports = {
  DEFAULT_CONFIG,
  parseArgs,
  parseConfig,
  ensureOutputDirectory,
  writeJsonOutput,
  formatFileSize,
  readFileContent,
  getAllFiles,
  detectLanguage,
  formatElapsedTime
};
