// Test script to check SDK exports
try {
  const sdk = require('@modelcontextprotocol/sdk');
  console.log('SDK exports:', Object.keys(sdk));
  console.log('Server available:', typeof sdk.Server === 'function');
  console.log('StdioServerTransport available:', typeof sdk.StdioServerTransport === 'function');
} catch (error) {
  console.error('Error importing SDK:', error.message);
}
