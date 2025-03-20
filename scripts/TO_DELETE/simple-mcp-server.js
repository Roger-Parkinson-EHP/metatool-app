/**
 * simple-mcp-server.js
 * 
 * A simplified MCP server implementation that uses a direct SDK require approach
 * rather than trying to install packages.
 */

const fs = require('fs');
const path = require('path');

// Implement a bare-minimum MCP server without external dependencies
const startServer = async () => {
  try {
    // For stdio transport we need to handle reading from stdin
    process.stdin.setEncoding('utf8');
    let buffer = '';

    // Create a minimalist jsonrpc server
    const tools = [
      {
        name: 'echo',
        description: 'Echo back the provided text',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to echo back'
            }
          },
          required: ['text']
        }
      },
      {
        name: 'get_time',
        description: 'Get the current server time',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'analyze_code',
        description: 'Simple code analysis tool',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Code to analyze'
            },
            language: {
              type: 'string',
              description: 'Programming language'
            }
          },
          required: ['code']
        }
      }
    ];

    // Simple function to handle jsonrpc requests
    const handleRequest = async (requestStr) => {
      try {
        const request = JSON.parse(requestStr);
        const { method, params, id } = request;
        
        let result;
        
        if (method === 'initialize') {
          // Handle initialize request
          result = {
            capabilities: {
              tools: {},
              resources: {},
            },
            clientInfo: {
              name: 'Simple MCP Server',
              version: '1.0.0'
            }
          };
        } else if (method === 'tools/list') {
          // Handle tools/list request
          result = { tools };
        } else if (method === 'tools/call') {
          // Handle tools/call request
          const { name, arguments: args } = params;
          
          switch (name) {
            case 'echo':
              result = {
                content: [{
                  type: 'text',
                  text: `Echo: ${args.text}`
                }]
              };
              break;
              
            case 'get_time':
              result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    time: new Date().toISOString(),
                    timestamp: Date.now()
                  })
                }]
              };
              break;
              
            case 'analyze_code':
              const { code, language = 'javascript' } = args;
              const lineCount = code.split('\n').length;
              
              // Simple code analysis
              result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    lineCount,
                    characterCount: code.length,
                    language,
                    summary: `This code contains ${lineCount} lines and ${code.length} characters.`
                  })
                }]
              };
              break;
              
            default:
              result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ error: `Tool '${name}' not found` })
                }],
                isError: true
              };
          }
        } else {
          // Handle unknown method
          result = { error: { code: -32601, message: 'Method not found' } };
        }
        
        // Send the response
        const response = {
          jsonrpc: '2.0',
          id,
          result
        };
        
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        // Send error response
        const errorResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: { message: error.message, stack: error.stack }
          }
        };
        
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    };
    
    // Set up stdin for reading
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      
      // Process complete messages (separated by newlines)
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const message = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        
        if (message.trim()) {
          handleRequest(message);
        }
      }
    });
    
    // Start message
    console.error('Simple MCP server started successfully');
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.error('Shutting down server...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Shutting down server...');
      process.exit(0);
    });

  } catch (error) {
    console.error('Error starting server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Start the server
startServer().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
