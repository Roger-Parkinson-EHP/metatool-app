/**
 * mcp-jsonrpc-server-fixed.js
 * 
 * A unified MCP server implementation that combines token management and
 * semantic analysis capabilities in a single server. This file was created
 * to fix the configuration issue with Claude Desktop.
 */

// Fixed imports to avoid path issues
const { Server } = require('@modelcontextprotocol/sdk/dist/cjs/server/index');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/dist/cjs/server/stdio');
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

// Configuration from environment variables
const CONFIG = {
  metamcp: {
    apiKey: process.env.METAMCP_API_KEY || 'sk_mt_default_key',
  },
  semantic: {
    embeddingCacheDir: process.env.EMBEDDING_CACHE_DIR || path.join(__dirname, '.embeddings-cache'),
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '384'),
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
  },
  rogerthat: {
    tokenBudget: parseInt(process.env.TOKEN_BUDGET || '8000'),
    defaultAlgorithm: process.env.DEFAULT_ALGORITHM || 'hybrid-semantic',
    enableSemantic: process.env.ENABLE_SEMANTIC === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  enableAllFeatures: process.env.ENABLE_ALL_FEATURES === 'true'
};

// Create server instance
const server = new Server(
  {
    name: 'Unified MCP Server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Register token counting tool
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'count_tokens': {
      const { text, model = 'claude-3' } = args;
      // Simple token counting algorithm (characters / 4)
      const count = Math.ceil(text.length / 4);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count, model })
        }]
      };
    }
      
    case 'prioritize_resources': {
      const { resources, maxTokens = CONFIG.rogerthat.tokenBudget } = args;
      
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
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ prioritizedResources: result })
        }]
      };
    }
      
    case 'embed_text': {
      const { text, cacheKey = null } = args;
      
      // Simple mock embedding generation (384 dimensions)
      const dimensions = CONFIG.semantic.embeddingDimensions;
      const embedding = Array(dimensions).fill(0).map(() => Math.random());
      
      // Normalize the embedding
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      const normalizedEmbedding = embedding.map(val => val / magnitude);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ embedding: normalizedEmbedding, dimensions })
        }]
      };
    }
      
    case 'calculate_similarity': {
      const { text1, text2 } = args;
      
      // Calculate a simple mock similarity score
      const similarity = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.random()));
      const threshold = CONFIG.semantic.similarityThreshold;
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ 
            similarity, 
            isRelevant: similarity >= threshold,
            threshold
          })
        }]
      };
    }
      
    default:
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Tool '${name}' not found` })
        }],
        isError: true
      };
  }
});

// Register tools/list endpoint
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'count_tokens',
        description: 'Count tokens in a text string',
        inputSchema: {
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
        }
      },
      {
        name: 'prioritize_resources',
        description: 'Prioritize resources for optimal context usage',
        inputSchema: {
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
        }
      },
      {
        name: 'embed_text',
        description: 'Generate embeddings for a text string',
        inputSchema: {
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
        }
      },
      {
        name: 'calculate_similarity',
        description: 'Calculate similarity between two texts',
        inputSchema: {
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
        }
      }
    ]
  };
});

// Start the server
(async () => {
  try {
    console.log('Starting MCP server...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('MCP server connected successfully');
  } catch (error) {
    console.error('Error starting server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  try {
    await server.close();
  } catch (error) {
    console.error('Error closing server:', error.message);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  try {
    await server.close();
  } catch (error) {
    console.error('Error closing server:', error.message);
  }
  process.exit(0);
});
