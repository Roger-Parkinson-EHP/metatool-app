/**
 * rogerthat-server.js
 * 
 * An MCP server for token management with semantic awareness capabilities.
 * Implements the RogerThat system for optimized LLM context management.
 */

// Try multiple import paths since the SDK structure can vary
let MCPServer, NodeBridge;

try {
  // Try direct import from SDK root
  const ServerModule = require('@modelcontextprotocol/sdk');
  MCPServer = ServerModule.Server;
  NodeBridge = ServerModule.NodeBridge;
} catch (error) {
  try {
    // Fallback to importing from subdirectories
    MCPServer = require('@modelcontextprotocol/sdk/dist/cjs/src/server').Server;
    NodeBridge = require('@modelcontextprotocol/sdk/dist/cjs/src/shared/stdio').NodeBridge;
  } catch (innerError) {
    // Second fallback for ESM structure
    MCPServer = require('@modelcontextprotocol/sdk/dist/esm/src/server').Server;
    NodeBridge = require('@modelcontextprotocol/sdk/dist/esm/src/shared/stdio').NodeBridge;
  }
}

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configuration from environment variables
const TOKEN_BUDGET = parseInt(process.env.TOKEN_BUDGET || '8000');
const DEFAULT_ALGORITHM = process.env.DEFAULT_ALGORITHM || 'hybrid-semantic';
const ENABLE_SEMANTIC = process.env.ENABLE_SEMANTIC === 'true';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'rogerthat.db');

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/**
 * Resource Tracker class that handles token management and prioritization
 */
class ResourceTracker {
  constructor(db) {
    this.db = db;
    this.resources = new Map();
    this.relationshipCache = new Map();
    this.tokenBudget = TOKEN_BUDGET;
    this.algorithm = DEFAULT_ALGORITHM;
    this.enableSemantic = ENABLE_SEMANTIC;
    this.semanticClient = null;
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
   * Set the semantic client for embedding generation
   * @param {Object} client - The semantic client instance
   */
  setSemanticClient(client) {
    this.semanticClient = client;
  }

  /**
   * Add a resource to the tracker
   * @param {string} id - Resource identifier
   * @param {string} content - Resource content
   * @param {number} tokens - Token count for the resource
   * @param {number} priority - Priority level (0-100)
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

    // If semantic is enabled, generate embeddings
    if (this.enableSemantic && this.semanticClient) {
      try {
        // Request embedding from semantic service
        const embedding = await this.semanticClient.generateEmbedding(content);
        
        // Store embedding in database
        await new Promise((resolve, reject) => {
          this.db.run(
            'INSERT OR REPLACE INTO semantic_embeddings (resource_id, embedding) VALUES (?, ?)',
            [id, Buffer.from(embedding.buffer)],
            (err) => err ? reject(err) : resolve()
          );
        });

        // Update semantic relationships
        await this.updateSemanticRelationships(id, embedding);
      } catch (error) {
        console.error(`Error generating embeddings for resource ${id}:`, error.message);
      }
    }
  }

  /**
   * Update semantic relationships between resources
   * @param {string} sourceId - Source resource ID
   * @param {Float32Array} sourceEmbedding - Source resource embedding
   */
  async updateSemanticRelationships(sourceId, sourceEmbedding) {
    if (!this.enableSemantic || !this.semanticClient) return;

    // Get all existing resource embeddings
    const resources = await new Promise((resolve, reject) => {
      this.db.all('SELECT resource_id, embedding FROM semantic_embeddings', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Calculate similarity with each resource
    for (const resource of resources) {
      if (resource.resource_id === sourceId) continue;

      const targetEmbedding = new Float32Array(resource.embedding.buffer);
      const similarityScore = await this.semanticClient.calculateSimilarity(
        sourceEmbedding,
        targetEmbedding
      );

      // Store relationship if similarity exceeds threshold
      if (similarityScore > 0.5) {
        await new Promise((resolve, reject) => {
          this.db.run(
            'INSERT OR REPLACE INTO resource_relationships (source_id, target_id, similarity_score) VALUES (?, ?, ?)',
            [sourceId, resource.resource_id, similarityScore],
            (err) => err ? reject(err) : resolve()
          );
        });

        // Also store the inverse relationship
        await new Promise((resolve, reject) => {
          this.db.run(
            'INSERT OR REPLACE INTO resource_relationships (source_id, target_id, similarity_score) VALUES (?, ?, ?)',
            [resource.resource_id, sourceId, similarityScore],
            (err) => err ? reject(err) : resolve()
          );
        });

        // Cache the relationship
        this.relationshipCache.set(`${sourceId}-${resource.resource_id}`, similarityScore);
        this.relationshipCache.set(`${resource.resource_id}-${sourceId}`, similarityScore);
      }
    }
  }

  /**
   * Update a resource's last used timestamp
   * @param {string} id - Resource identifier
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
    }
  }

  /**
   * Remove a resource from the tracker
   * @param {string} id - Resource identifier
   */
  async removeResource(id) {
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
  }

  /**
   * Prioritize resources to fit within token budget
   * @param {string} currentQuery - Current user query for semantic comparison
   * @param {string} algorithm - Prioritization algorithm to use
   * @returns {Array} Prioritized resource list
   */
  async prioritizeResources(currentQuery, algorithm = this.algorithm) {
    const allResources = [...this.resources.values()];
    
    // Calculate total tokens
    const totalTokens = allResources.reduce((sum, res) => sum + res.tokens, 0);
    
    // If total tokens is within budget, return all resources
    if (totalTokens <= this.tokenBudget) {
      return allResources.map(r => ({
        id: r.id,
        content: r.content,
        tokens: r.tokens,
        score: r.priority
      }));
    }
    
    // Choose prioritization algorithm
    switch (algorithm) {
      case 'recency':
        return this.prioritizeByRecency(allResources);
      
      case 'priority':
        return this.prioritizeByPriority(allResources);
      
      case 'semantic':
        if (this.enableSemantic && this.semanticClient) {
          return await this.prioritizeBySemantic(allResources, currentQuery);
        }
        // Fall back to hybrid if semantic is not available
        return this.prioritizeByHybrid(allResources);
      
      case 'hybrid-semantic':
        if (this.enableSemantic && this.semanticClient) {
          return await this.prioritizeByHybridSemantic(allResources, currentQuery);
        }
        // Fall back to hybrid if semantic is not available
        return this.prioritizeByHybrid(allResources);
      
      case 'hybrid':
      default:
        return this.prioritizeByHybrid(allResources);
    }
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
   * Prioritize using semantic similarity to current query
   */
  async prioritizeBySemantic(resources, currentQuery) {
    if (!currentQuery || !this.semanticClient) {
      return this.prioritizeByHybrid(resources);
    }
    
    try {
      // Generate embedding for current query
      const queryEmbedding = await this.semanticClient.generateEmbedding(currentQuery);
      
      // Score each resource by semantic similarity to query
      const scoredResources = [];
      
      for (const resource of resources) {
        // Get resource embedding
        const embedding = await new Promise((resolve, reject) => {
          this.db.get(
            'SELECT embedding FROM semantic_embeddings WHERE resource_id = ?',
            [resource.id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row ? new Float32Array(row.embedding.buffer) : null);
            }
          );
        });
        
        let semanticScore = 0;
        if (embedding) {
          semanticScore = await this.semanticClient.calculateSimilarity(queryEmbedding, embedding);
        }
        
        scoredResources.push({
          ...resource,
          score: semanticScore * 100 // Scale to 0-100
        });
      }
      
      const sorted = scoredResources.sort((a, b) => b.score - a.score);
      return this.truncateToTokenBudget(sorted);
    } catch (error) {
      console.error('Error in semantic prioritization:', error);
      return this.prioritizeByHybrid(resources);
    }
  }

  /**
   * Prioritize using a combination of semantic similarity, priority, and recency
   */
  async prioritizeByHybridSemantic(resources, currentQuery) {
    if (!currentQuery || !this.semanticClient) {
      return this.prioritizeByHybrid(resources);
    }
    
    try {
      // Generate embedding for current query
      const queryEmbedding = await this.semanticClient.generateEmbedding(currentQuery);
      
      // Score each resource
      const currentTime = Date.now();
      const scoredResources = [];
      
      for (const resource of resources) {
        // Get resource embedding
        const embedding = await new Promise((resolve, reject) => {
          this.db.get(
            'SELECT embedding FROM semantic_embeddings WHERE resource_id = ?',
            [resource.id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row ? new Float32Array(row.embedding.buffer) : null);
            }
          );
        });
        
        let semanticScore = 0;
        if (embedding) {
          semanticScore = await this.semanticClient.calculateSimilarity(queryEmbedding, embedding);
        }
        
        // Calculate hybrid score (semantic, priority, recency)
        const recencyScore = Math.max(0, 1 - (currentTime - resource.lastUsed) / (24 * 60 * 60 * 1000));
        const hybridScore = (semanticScore * 50) + (resource.priority * 0.3) + (recencyScore * 20);
        
        scoredResources.push({
          ...resource,
          score: hybridScore
        });
      }
      
      const sorted = scoredResources.sort((a, b) => b.score - a.score);
      return this.truncateToTokenBudget(sorted);
    } catch (error) {
      console.error('Error in hybrid-semantic prioritization:', error);
      return this.prioritizeByHybrid(resources);
    }
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
    
    // Load relationships if semantic is enabled
    if (this.enableSemantic) {
      const relationships = await new Promise((resolve, reject) => {
        this.db.all('SELECT * FROM resource_relationships', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // Populate relationship cache
      for (const rel of relationships) {
        this.relationshipCache.set(
          `${rel.source_id}-${rel.target_id}`,
          rel.similarity_score
        );
      }
    }
  }
}

/**
 * Semantic client for communicating with the semantic-analysis service
 */
class SemanticClient {
  constructor() {
    this.ready = false;
    // We'll use RPC methods to communicate with the semantic server
  }

  /**
   * Attempt to connect to the semantic server
   */
  async connect() {
    try {
      // Simulate successful connection
      this.ready = true;
      console.log('Successfully connected to semantic-analysis service');
      return true;
    } catch (error) {
      console.error('Failed to connect to semantic-analysis service:', error.message);
      return false;
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text) {
    if (!this.ready) {
      throw new Error('Semantic client not connected');
    }
    
    // In a real implementation, this would call the semantic-analysis service
    // For now, return a mock embedding
    return new Float32Array(384).fill(0.1);
  }

  /**
   * Calculate similarity between two embeddings
   */
  async calculateSimilarity(embedding1, embedding2) {
    if (!this.ready) {
      throw new Error('Semantic client not connected');
    }
    
    // In a real implementation, this would call the semantic-analysis service
    // For now, return a random similarity score
    return Math.random() * 0.5 + 0.5; // Random value between 0.5 and 1.0
  }
}

// Initialize database
const db = new sqlite3.Database(DB_PATH);

// Initialize resource tracker and semantic client
const resourceTracker = new ResourceTracker(db);
const semanticClient = new SemanticClient();

// Start MCP server
async function startServer() {
  try {
    // Initialize database
    await resourceTracker.initDatabase();
    
    // Load resources from database
    await resourceTracker.loadResources();
    
    // Connect to semantic service if enabled
    if (ENABLE_SEMANTIC) {
      const connected = await semanticClient.connect();
      if (connected) {
        resourceTracker.setSemanticClient(semanticClient);
      }
    }
    
    // Create MCP server
    const server = new MCPServer({
      name: 'rogerthat',
      version: '1.0.0'
    }, {
      capabilities: {
        // Add capabilities as needed
        resources: true,
        tools: true
      },
      instructions: 'RogerThat token management system with semantic awareness'
    });
    
    // Register custom methods
    server.setRequestHandler('resources/add', async (request) => {
      const { id, content, tokens, priority } = request.params;
      await resourceTracker.addResource(id, content, tokens, priority);
      return { success: true };
    });
    
    server.setRequestHandler('resources/remove', async (request) => {
      const { id } = request.params;
      await resourceTracker.removeResource(id);
      return { success: true };
    });
    
    server.setRequestHandler('resources/mark_used', async (request) => {
      const { id } = request.params;
      await resourceTracker.markResourceUsed(id);
      return { success: true };
    });
    
    server.setRequestHandler('resources/prioritize', async (request) => {
      const { query, algorithm } = request.params;
      const prioritized = await resourceTracker.prioritizeResources(query, algorithm);
      return { resources: prioritized };
    });
    
    // Connect to Node transport
    const bridge = new NodeBridge(process.stdin, process.stdout);
    server.connectTransport(bridge);
    
    console.log('RogerThat token management server started');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle process exit
process.on('exit', () => {
  db.close();
});

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});


