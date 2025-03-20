/**
 * Setup script for fixing the MCP server dependencies
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== MCP Server Dependencies Setup ===');
console.log('This script will fix the issues with the MCP servers.');

try {
  // Step 1: Build the TypeScript SDK
  console.log('\n1. Building the TypeScript SDK...');
  const sdkPath = path.resolve(__dirname, '../../typescript-sdk');
  console.log(`   SDK Path: ${sdkPath}`);
  
  try {
    console.log('   Running build command in TypeScript SDK directory...');
    execSync('npm run build', {
      stdio: 'inherit',
      cwd: sdkPath
    });
    console.log('   SDK build successful!');
  } catch (buildError) {
    console.error('   Error building SDK:', buildError.message);
    console.log('   Attempting to continue with installation anyway...');
  }
  
  // Step 2: Install the TypeScript SDK
  console.log('\n2. Installing TypeScript SDK...');
  console.log('   (Using --legacy-peer-deps to handle React 19 compatibility)');
  execSync('npm install ../typescript-sdk --legacy-peer-deps --force', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  
  // Ensure our Python REPL server is executable
  console.log('\n3. Setup custom Python REPL server...');
  try {
    fs.chmodSync(path.resolve(__dirname, 'python_repl_server.py'), '755');
    console.log('   Set executable permissions for the Python REPL server');
  } catch (error) {
    console.warn('   Warning: Could not set executable permissions for the Python REPL server');
  }
  
  console.log('\nSetup complete!');
  console.log('\nInstructions:');
  console.log('1. Restart the Claude application to reload the MCP servers');
  console.log('2. If you still encounter issues:');
  console.log('   - Check the logs for specific error messages');
  console.log('\nEnjoy using MCP servers with Claude!');
} catch (error) {
  console.error('\nError during setup:', error.message);
  console.log('\nTroubleshooting:');
  console.log('1. Try building the TypeScript SDK manually:');
  console.log('   cd ../typescript-sdk && npm run build');
  console.log('2. Try installing the TypeScript SDK manually:');
  console.log('   npm install ../typescript-sdk --legacy-peer-deps --force');
  console.log('3. For Python errors, make sure Python is installed and in your PATH');
}
