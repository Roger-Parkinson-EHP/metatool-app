try {
  module.exports = require('@modelcontextprotocol/sdk');
} catch (error) {
  console.error('Falling back to local typescript-sdk...');
  try {
    module.exports = require('../../typescript-sdk');
  } catch (secondError) {
    console.error('Could not load SDK from any location:', secondError.message);
    
    // Correct mock implementation based on mcp-jsonrpc-server-fixed.js
    class Server {
      constructor(serverInfo, serverMetadata) { 
        this.serverInfo = serverInfo || {};
        this.serverMetadata = serverMetadata || {};
        this.handlers = new Map();
        this.transport = null;
        console.error('Using SDK mock implementation'); 
      }
      
      setRequestHandler(method, handler) {
        console.error(Registered handler for method: );
        this.handlers.set(method, handler);
      }
      
      async connect(transport) { 
        console.error('MCP server connect method called');
        this.transport = transport;
        
        if (transport) {
          transport.onmessage = async (message) => {
            try {
              console.error(Received message: ...);
              const { method, id, params } = message;
              
              // Handle initialize request specifically
              if (method === 'initialize') {
                const response = {
                  jsonrpc: '2.0',
                  id,
                  result: {
                    protocolVersion: params.protocolVersion || '2024-11-05',
                    serverInfo: this.serverInfo,
                    capabilities: this.serverMetadata.capabilities || {}
                  }
                };
                console.error(Sending initialize response);
                transport.send(response);
                return;
              }
              
              // Handle other registered methods
              const handler = this.handlers.get(method);
              if (handler) {
                try {
                  const result = await handler(message);
                  transport.send({
                    jsonrpc: '2.0',
                    id,
                    result
                  });
                } catch (err) {
                  console.error(Error in handler for :, err);
                  transport.send({
                    jsonrpc: '2.0',
                    id,
                    error: {
                      code: -32000,
                      message: err.message
                    }
                  });
                }
              } else {
                transport.send({
                  jsonrpc: '2.0',
                  id,
                  error: {
                    code: -32601,
                    message: Method '' not found
                  }
                });
              }
            } catch (err) {
              console.error('Error processing message:', err);
              if (message && message.id) {
                transport.send({
                  jsonrpc: '2.0',
                  id: message.id,
                  error: {
                    code: -32603,
                    message: 'Internal error: ' + err.message
                  }
                });
              }
            }
          };
        }
        
        return Promise.resolve();
      }
      
      close() { 
        console.error('Closing MCP server');
        return Promise.resolve(); 
      }
    }
    
    class StdioServerTransport {
      constructor() {
        this.onmessage = null;
        
        // Set up message handling from stdin
        process.stdin.setEncoding('utf8');
        let buffer = '';
        
        process.stdin.on('data', (chunk) => {
          buffer += chunk;
          
          // Process complete messages (JSON-RPC messages are separated by newlines)
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep the last incomplete line in the buffer
          
          for (const line of lines) {
            if (line.trim() && this.onmessage) {
              try {
                const message = JSON.parse(line);
                this.onmessage(message);
              } catch (error) {
                console.error('Error parsing message:', error);
              }
            }
          }
        });
      }
      
      send(message) {
        // Send message to stdout
        const json = JSON.stringify(message);
        process.stdout.write(json + '\n');
      }
    }
    
    module.exports = {
      Server,
      StdioServerTransport
    };
  }
}
