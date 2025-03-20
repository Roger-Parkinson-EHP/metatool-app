/**
 * Test script to verify the MCP SDK import fix
 * 
 * This script verifies that we can successfully import the MCP SDK components
 * using the standard import pattern rather than explicit paths.
 */

console.log('Starting import test...');

// Wrap in try/catch to capture any errors
try {
  // Test the standard import pattern
  console.log('Testing standard import pattern...');
  const sdk = require('@modelcontextprotocol/sdk');
  console.log('SDK import successful. Available exports:', Object.keys(sdk));
  
  // Verify Server component is available
  console.log('Testing Server component access...');
  const { Server } = sdk;
  if (typeof Server === 'function') {
    console.log('Server component imported successfully');
  } else {
    console.error('Error: Server component not available or not a function');
    process.exit(1);
  }
  
  // Verify StdioServerTransport component is available
  console.log('Testing StdioServerTransport component access...');
  const { StdioServerTransport } = sdk;
  if (typeof StdioServerTransport === 'function') {
    console.log('StdioServerTransport component imported successfully');
  } else {
    console.error('Error: StdioServerTransport component not available or not a function');
    process.exit(1);
  }
  
  // Test server creation (but don't connect)
  console.log('Testing server creation...');
  const server = new Server(
    {
      name: 'Test Server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );
  console.log('Server created successfully');
  
  // All tests passed
  console.log('\n✅ All import tests PASSED!');
} catch (error) {
  // Log any errors
  console.error('\n❌ Test FAILED with error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
