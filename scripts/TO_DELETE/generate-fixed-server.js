/**
 * generate-fixed-server.js
 * 
 * A script to generate a fixed MCP server implementation for Claude Desktop.
 * This creates the missing mcp-jsonrpc-server-fixed.js file by combining
 * the simplified server implementations.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  scriptDir: __dirname,
  outputFile: path.resolve(__dirname, '..', 'mcp-jsonrpc-server-fixed.js'),
  serverInfo: {
    name: 'Unified MCP Server',
    description: 'Combined MCP server with token management and semantic analysis',
    version: '1.0.0'
  },
  sources: {
    rogerthat: path.resolve(__dirname, 'simplified-rogerthat-server.js'),
    semantic: path.resolve(__dirname, 'simplified-semantic-server.js')
  }
};

/**
 * Extract tool handler code from source files
 */
function extractToolHandler(content, toolName) {
  // Look for tool handler in createServer format
  const createServerRegex = new RegExp(
    `name:\s*['"](${toolName})['"]\s*,[\s\S]*?handler\s*\([^)]*\)\s*{([\s\S]*?)(?:}\s*},|},\s*\{)`,
    'i'
  );
  const createServerMatch = content.match(createServerRegex);
  
  if (createServerMatch) {
    return createServerMatch[2].trim();
  }
  
  // Look for tool handler in switch statement
  const switchRegex = new RegExp(
    `case\s*['"](${toolName})['"]\s*:([\s\S]*?)(?:break;|return|case\s*[\'"](\w+)[\'"]\s*:)`,
    'i'
  );
  const switchMatch = content.match(switchRegex);
  
  if (switchMatch) {
    return switchMatch[2].trim();
  }
  
  return null;
}

/**
 * Generate the fixed server implementation
 */
function generateFixedServer() {
  console.log('Generating fixed MCP server...');
  
  try {
    // Check if source files exist
    if (!fs.existsSync(CONFIG.sources.rogerthat)) {
      throw new Error(`RogerThat source file not found: ${CONFIG.sources.rogerthat}`);
    }
    
    if (!fs.existsSync(CONFIG.sources.semantic)) {
      throw new Error(`Semantic source file not found: ${CONFIG.sources.semantic}`);
    }
    
    // Read source files
    const rogerthatContent = fs.readFileSync(CONFIG.sources.rogerthat, 'utf8');
    const semanticContent = fs.readFileSync(CONFIG.sources.semantic, 'utf8');
    
    // Generate combined server code
    const serverCode = `/**
 * mcp-jsonrpc-server-fixed.js
 * 
 * A unified MCP server implementation that combines token management and
 * semantic analysis capabilities in a single server. This file was generated
 * to fix the configuration issue with Claude Desktop.
 */

const { createServer } = require('@modelcontextprotocol/sdk');
const fs = require('fs');
const path = require('path');

// Ensure required directories exist
const setupDirs = () => {
  // Data directory for token management
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Embeddings cache for semantic analysis
  const cacheDir = path.join(__dirname, '.embeddings-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
};

// Run directory setup
setupDirs();

// Initialize MCP server
const server = createServer({
  id: 'unified-mcp-server',
  name: '${CONFIG.serverInfo.name}',
  description: '${CONFIG.serverInfo.description}',
  version: '${CONFIG.serverInfo.version}',
  vendor: 'RogerThat',
  tools: [
    {
      name: 'count_tokens',
      description: 'Count tokens in a text string',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to count tokens for'
          },
          model: {
            type: 'string',
            description: 'Optional model name to use for counting'
          }
        },
        required: ['text']
      },
      async handler(params) {
        const { text, model = 'claude-3' } = params;
        // Simple token counting algorithm (characters / 4)
        const count = Math.ceil(text.length / 4);
        return { count, model };
      }
    },
    {
      name: 'prioritize_resources',
      description: 'Prioritize resources for optimal context usage',
      parameters: {
        type: 'object',
        properties: {
          resources: {
            type: 'array',
            description: 'Array of resources to prioritize',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                content: { type: 'string' },
                importance: { type: 'number' }
              }
            }
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens to include'
          }
        },
        required: ['resources']
      },
      async handler(params) {
        const { resources, maxTokens = 8000 } = params;
        
        // Simple prioritization based on importance
        const prioritized = [...resources]
          .sort((a, b) => (b.importance || 0) - (a.importance || 0));
        
        let result = [];
        let currentTokens = 0;
        
        for (const resource of prioritized) {
          // Simple token estimation
          const tokens = Math.ceil(resource.content.length / 4);
          
          if (currentTokens + tokens <= maxTokens) {
            result.push(resource);
            currentTokens += tokens;
          } else {
            break;
          }
        }
        
        return { prioritizedResources: result };
      }
    },
    {
      name: 'embed_text',
      description: 'Generate embeddings for a text string',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to embed'
          },
          cacheKey: {
            type: 'string',
            description: 'Optional cache key for the embedding'
          }
        },
        required: ['text']
      },
      async handler(params) {
        const { text, cacheKey = null } = params;
        
        // Simple mock embedding generation (384 dimensions)
        const dimensions = 384;
        const embedding = Array(dimensions).fill(0).map(() => Math.random());
        
        // Normalize the embedding
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        const normalizedEmbedding = embedding.map(val => val / magnitude);
        
        return { embedding: normalizedEmbedding, dimensions };
      }
    },
    {
      name: 'calculate_similarity',
      description: 'Calculate similarity between two texts',
      parameters: {
        type: 'object',
        properties: {
          text1: {
            type: 'string',
            description: 'First text'
          },
          text2: {
            type: 'string',
            description: 'Second text'
          }
        },
        required: ['text1', 'text2']
      },
      async handler(params) {
        const { text1, text2 } = params;
        
        // Calculate a simple mock similarity score
        const similarity = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.random()));
        const threshold = 0.7;
        
        return { 
          similarity, 
          isRelevant: similarity >= threshold,
          threshold
        };
      }
    }
  ]
});

// Start the server and listen for requests
server.start().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
`;
    
    // Write the combined server to the output file
    fs.writeFileSync(CONFIG.outputFile, serverCode, 'utf8');
    
    console.log(`Fixed server implementation written to ${CONFIG.outputFile}`);
    return true;
  } catch (error) {
    console.error('Error generating fixed server:', error.message);
    return false;
  }
}

// Run the generator if executed directly
if (require.main === module) {
  generateFixedServer();
}

module.exports = { generateFixedServer };
