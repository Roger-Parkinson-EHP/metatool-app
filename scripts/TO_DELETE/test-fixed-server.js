/**
 * Test script for the fixed unified-server.js
 * This script will run the server with output capturing to detect any errors
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to unified server script
const serverPath = path.join(__dirname, 'unified-server.js');

// Create log directory if it doesn't exist
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log file paths
const stdoutLogPath = path.join(logDir, 'unified-server-stdout.log');
const stderrLogPath = path.join(logDir, 'unified-server-stderr.log');

// Create writable streams for logs
const stdoutStream = fs.createWriteStream(stdoutLogPath, { flags: 'a' });
const stderrStream = fs.createWriteStream(stderrLogPath, { flags: 'a' });

// Add timestamp to logs
const timestamp = new Date().toISOString();
stdoutStream.write(`\n\n===== SERVER TEST START: ${timestamp} =====\n`);
stderrStream.write(`\n\n===== SERVER TEST START: ${timestamp} =====\n`);

// Start the server process
console.log(`Starting test of fixed server at ${timestamp}...`);
const serverProcess = spawn('node', [serverPath], {
  env: process.env
});

// Pipe outputs to logs and console
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  stdoutStream.write(output);
  console.log(`[SERVER STDOUT]: ${output.trim()}`);
});

serverProcess.stderr.on('data', (data) => {
  const output = data.toString();
  stderrStream.write(output);
  console.error(`[SERVER STDERR]: ${output.trim()}`);
});

// Handle process exit
serverProcess.on('exit', (code) => {
  const exitTimestamp = new Date().toISOString();
  const exitMessage = `\n===== SERVER EXITED WITH CODE ${code} AT ${exitTimestamp} =====\n`;
  stdoutStream.write(exitMessage);
  stderrStream.write(exitMessage);
  console.log(`Server process exited with code ${code}`);
  
  // Close streams
  stdoutStream.end();
  stderrStream.end();
});

// Handle signals
process.on('SIGINT', () => {
  console.log('\nStopping test...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\nStopping test...');
  serverProcess.kill('SIGTERM');
});

console.log('Test running. Press Ctrl+C to stop.');
