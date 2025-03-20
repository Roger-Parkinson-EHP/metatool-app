/**
 * mcp-unified-server.js
 * 
 * A unified MCP server that combines the functionality of RogerThat token management,
 * semantic analysis, and MCP server management into a single server.
 */

// Import the MCP SDK using the standard pattern for better compatibility
const sdk = require('@modelcontextprotocol/sdk');
const { Server, StdioServerTransport } = sdk;

// Add diagnostic logging to verify the SDK is loaded correctly
console.error('SDK loaded successfully. Available exports:', Object.keys(sdk));
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configuration from environment variables
const CONFIG = {
  metamcp: {
    apiKey: process.env.METAMCP_API_KEY || 'sk_mt_default_key',
  },
  semantic: {
    embeddingCacheDir: process.env.EMBEDDING_CACHE_DIR || path.join(__dirname, '..', '.embeddings-cache'),
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '384'),
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
  },
  rogerthat: {
    tokenBudget: parseInt(process.env.TOKEN_BUDGET || '8000'),
    defaultAlgorithm: process.env.DEFAULT_ALGORITHM || 'hybrid-semantic',
    enableSemantic: process.env.ENABLE_SEMANTIC === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  enableAllFeatures: process.env.ENABLE_ALL_FEATURES === 'true',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'unified.db')
};

// Ensure directories exist
const ensureDirectories = () => {
  // Embeddings cache directory
  if (!fs.existsSync(CONFIG.semantic.embeddingCacheDir)) {
    fs.mkdirSync(CONFIG.semantic.embeddingCacheDir, { recursive: true });
  }
  
  // Database directory
  const dbDir = path.dirname(CONFIG.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Sessions directory
  const sessionsDir = path.join(__dirname, '..', '.sessions');
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }
  
  // Workspaces directory
  const workspacesDir = path.join(__dirname, '..', '.workspaces');
  if (!fs.existsSync(workspacesDir)) {
    fs.mkdirSync(workspacesDir, { recursive: true });
  }
};

/**
 * Resource Tracker class that handles token management and prioritization
 */
class ResourceTracker {
  constructor(db) {
    this.db = db;
    this.resources = new Map();
    this.relationshipCache = new Map();
    this.tokenBudget = CONFIG.rogerthat.tokenBudget;
    this.algorithm = CONFIG.rogerthat.defaultAlgorithm;
    this.enableSemantic = CONFIG.rogerthat.enableSemantic;
  }

  /**
   * Initialize the database tables
   */
  async initDatabase() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Create resources table if not exists
        this.db.run(`
          CREATE TABLE IF NOT EXISTS resources (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            tokens INTEGER NOT NULL,
            priority INTEGER DEFAULT 0,
            last_used INTEGER NOT NULL,
            semantic_score REAL DEFAULT 0
          )
        `);

        // Create relationships table if not exists
        this.db.run(`
          CREATE TABLE IF NOT EXISTS resource_relationships (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            similarity_score REAL NOT NULL,
            PRIMARY KEY (source_id, target_id),
            FOREIGN KEY (source_id) REFERENCES resources(id),
            FOREIGN KEY (target_id) REFERENCES resources(id)
          )
        `);

        // Create embeddings table if not exists
        this.db.run(`
          CREATE TABLE IF NOT EXISTS semantic_embeddings (
            resource_id TEXT PRIMARY KEY,
            embedding BLOB NOT NULL,
            FOREIGN KEY (resource_id) REFERENCES resources(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /**
   * Add a resource to the tracker
   */
  async addResource(id, content, tokens, priority = 0) {
    const timestamp = Date.now();

    // Add to in-memory cache
    this.resources.set(id, {
      id,
      content,
      tokens,
      priority,
      lastUsed: timestamp,
      semanticScore: 0
    });

    // Add to database
    await new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO resources (id, content, tokens, priority, last_used, semantic_score) VALUES (?, ?, ?, ?, ?, ?)',
        [id, content, tokens, priority, timestamp, 0],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Return success
    return { id, success: true };
  }

  /**
   * Update a resource's last used timestamp
   */
  async markResourceUsed(id) {
    const timestamp = Date.now();
    const resource = this.resources.get(id);
    
    if (resource) {
      resource.lastUsed = timestamp;
      
      await new Promise((resolve, reject) => {
        this.db.run(
          'UPDATE resources SET last_used = ? WHERE id = ?',
          [timestamp, id],
          (err) => err ? reject(err) : resolve()
        );
      });
      
      return { success: true };
    }
    
    return { success: false, error: 'Resource not found' };
  }

  /**
   * Remove a resource from the tracker
   */
  async removeResource(id) {
    if (!this.resources.has(id)) {
      return { success: false, error: 'Resource not found' };
    }
    
    this.resources.delete(id);
    
    await new Promise((resolve, reject) => {
      this.db.run('DELETE FROM resources WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Remove all relationships
    await new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM resource_relationships WHERE source_id = ? OR target_id = ?',
        [id, id],
        (err) => err ? reject(err) : resolve()
      );
    });
    
    // Remove embeddings
    await new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM semantic_embeddings WHERE resource_id = ?',
        [id],
        (err) => err ? reject(err) : resolve()
      );
    });
    
    return { success: true };
  }

  /**
   * Prioritize resources to fit within token budget
   */
  async prioritizeResources(currentQuery, algorithm = this.algorithm) {
    const allResources = [...this.resources.values()];
    
    // Calculate total tokens
    const totalTokens = allResources.reduce((sum, res) => sum + res.tokens, 0);
    
    // If total tokens is within budget, return all resources
    if (totalTokens <= this.tokenBudget) {
      return {
        resources: allResources.map(r => ({
          id: r.id,
          content: r.content,
          tokens: r.tokens,
          score: r.priority
        })),
        totalTokens,
        budgetTokens: this.tokenBudget
      };
    }
    
    // Choose prioritization algorithm
    let prioritizedResources;
    
    switch (algorithm) {
      case 'recency':
        prioritizedResources = this.prioritizeByRecency(allResources);
        break;
      
      case 'priority':
        prioritizedResources = this.prioritizeByPriority(allResources);
        break;
      
      case 'hybrid-semantic':
      case 'hybrid':
      default:
        prioritizedResources = this.prioritizeByHybrid(allResources);
        break;
    }
    
    return {
      resources: prioritizedResources,
      totalTokens,
      budgetTokens: this.tokenBudget,
      algorithm
    };
  }

  /**
   * Prioritize by recency (most recently used first)
   */
  prioritizeByRecency(resources) {
    const sorted = [...resources].sort((a, b) => b.lastUsed - a.lastUsed);
    return this.truncateToTokenBudget(sorted);
  }

  /**
   * Prioritize by explicit priority value
   */
  prioritizeByPriority(resources) {
    const sorted = [...resources].sort((a, b) => b.priority - a.priority);
    return this.truncateToTokenBudget(sorted);
  }

  /**
   * Prioritize using a hybrid approach (combination of priority and recency)
   */
  prioritizeByHybrid(resources) {
    const currentTime = Date.now();
    
    // Calculate score based on recency and priority
    // Higher score = higher priority
    const scored = resources.map(r => {
      const recencyScore = Math.max(0, 1 - (currentTime - r.lastUsed) / (24 * 60 * 60 * 1000));
      const hybridScore = (r.priority * 0.7) + (recencyScore * 30);
      
      return {
        ...r,
        score: hybridScore
      };
    });
    
    const sorted = scored.sort((a, b) => b.score - a.score);
    return this.truncateToTokenBudget(sorted);
  }

  /**
   * Truncate resource list to fit token budget
   */
  truncateToTokenBudget(sortedResources) {
    const result = [];
    let tokenCount = 0;
    
    for (const resource of sortedResources) {
      if (tokenCount + resource.tokens <= this.tokenBudget) {
        result.push({
          id: resource.id,
          content: resource.content,
          tokens: resource.tokens,
          score: resource.score || resource.priority
        });
        tokenCount += resource.tokens;
      } else {
        break;
      }
    }
    
    return result;
  }

  /**
   * Load resources from database
   */
  async loadResources() {
    // Load resources
    const resources = await new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM resources', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Update in-memory map
    for (const resource of resources) {
      this.resources.set(resource.id, {
        id: resource.id,
        content: resource.content,
        tokens: resource.tokens,
        priority: resource.priority,
        lastUsed: resource.last_used,
        semanticScore: resource.semantic_score
      });
    }
    
    console.log(`Loaded ${resources.length} resources from database`);
  }
}

/**
 * Main function to start the server
 */
async function startServer() {
  try {
    // Ensure directories exist
    ensureDirectories();
    
    // Initialize database
    const db = new sqlite3.Database(CONFIG.dbPath);
    const resourceTracker = new ResourceTracker(db);
    
    // Initialize database and load resources
    await resourceTracker.initDatabase();
    await resourceTracker.loadResources();
    
    // Create server with better error handling
    console.error('Creating MCP server...');
    let server;
    try {
      server = new Server(
        {
          name: 'Unified MCP Server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            logging: {}
          },
          instructions: 'Unified server combining RogerThat token management, semantic analysis, and MCP server management'
        }
      );
      console.error('MCP server created successfully');
    } catch (serverError) {
      console.error('Failed to create server:', serverError.message);
      throw serverError;
    }

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

    // Register custom resource handlers
    server.setRequestHandler('resources/custom/add', async (request) => {
      const { id, content, tokens, priority } = request.params;
      const result = await resourceTracker.addResource(id, content, tokens, priority);
      return result;
    });
    
    server.setRequestHandler('resources/custom/remove', async (request) => {
      const { id } = request.params;
      const result = await resourceTracker.removeResource(id);
      return result;
    });
    
    server.setRequestHandler('resources/custom/mark_used', async (request) => {
      const { id } = request.params;
      const result = await resourceTracker.markResourceUsed(id);
      return result;
    });
    
    server.setRequestHandler('resources/custom/prioritize', async (request) => {
      const { query, algorithm } = request.params;
      const result = await resourceTracker.prioritizeResources(query, algorithm);
      return result;
    });

    // Create and connect transport with better error handling
    console.log('Starting unified MCP server...');
    console.error('SDK Server and StdioServerTransport are available');
    
    const transport = new StdioServerTransport();
    
    // Add error handler to the transport
    transport.onerror = (error) => {
      console.error('Transport error:', error.message);
    };
    
    try {
      await server.connect(transport);
      console.log('Unified MCP server successfully started and connected');
    } catch (connectError) {
      console.error('Failed to connect server to transport:', connectError.message);
      throw connectError;
    }

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('Shutting down server...');
      await server.close();
      db.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down server...');
      await server.close();
      db.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error starting server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
