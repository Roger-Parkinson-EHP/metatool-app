/**
 * semantic-server.js
 * 
 * An MCP server for semantic text analysis that provides embedding generation
 * and similarity calculations for the RogerThat token management system.
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
const { pipeline } = require('@xenova/transformers');

// Configuration from environment variables
const EMBEDDING_CACHE_DIR = process.env.EMBEDDING_CACHE_DIR || './.embeddings-cache';
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '384');
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Ensure cache directory exists
if (!fs.existsSync(EMBEDDING_CACHE_DIR)) {
  fs.mkdirSync(EMBEDDING_CACHE_DIR, { recursive: true });
}

// Initialize embedding model pipeline
let embeddingPipeline = null;
let embeddingCache = new Map();
let embeddingCacheFile = path.join(EMBEDDING_CACHE_DIR, 'cache.json');

// Load embedding cache if exists
if (fs.existsSync(embeddingCacheFile)) {
  try {
    const cacheData = JSON.parse(fs.readFileSync(embeddingCacheFile, 'utf8'));
    embeddingCache = new Map(Object.entries(cacheData));
    console.log(`Loaded ${embeddingCache.size} cached embeddings`);
  } catch (err) {
    console.error('Error loading embedding cache:', err.message);
  }
}

/**
 * Initialize the embedding model pipeline
 */
async function initEmbeddingModel() {
  try {
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded successfully');
    return true;
  } catch (err) {
    console.error('Error loading embedding model:', err.message);
    return false;
  }
}

/**
 * Generate embeddings for a given text
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<Float32Array>} - The embedding vector
 */
async function generateEmbedding(text) {
  if (!embeddingPipeline) {
    const success = await initEmbeddingModel();
    if (!success) {
      throw new Error('Failed to initialize embedding model');
    }
  }

  // Check cache first
  const cacheKey = text.trim().substring(0, 100); // Use first 100 chars as key
  if (embeddingCache.has(cacheKey)) {
    return new Float32Array(embeddingCache.get(cacheKey));
  }

  // Generate new embedding
  const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
  const embedding = output.data;
  
  // Cache the result
  embeddingCache.set(cacheKey, Array.from(embedding));
  
  // Periodically save cache
  if (embeddingCache.size % 10 === 0) {
    saveEmbeddingCache();
  }
  
  return embedding;
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {Float32Array} embedding1 - First embedding vector
 * @param {Float32Array} embedding2 - Second embedding vector
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embedding dimensions do not match');
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  
  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }
  
  return dotProduct / (norm1 * norm2);
}

/**
 * Save the embedding cache to disk
 */
function saveEmbeddingCache() {
  try {
    const cacheObj = Object.fromEntries(embeddingCache);
    fs.writeFileSync(embeddingCacheFile, JSON.stringify(cacheObj), 'utf8');
    console.log(`Saved ${embeddingCache.size} embeddings to cache`);
  } catch (err) {
    console.error('Error saving embedding cache:', err.message);
  }
}

// Start MCP server
async function startServer() {
  try {
    // Initialize embedding model
    await initEmbeddingModel();
    
    // Create MCP server
    const server = new MCPServer({
      name: 'semantic-analysis',
      version: '1.0.0'
    }, {
      capabilities: {
        // Add capabilities as needed
        tools: true
      },
      instructions: 'Semantic analysis service for text embedding generation and similarity calculation'
    });
    
    // Register methods for embedding generation and similarity calculation
    server.setRequestHandler('generate_embedding', async (request) => {
      const { text } = request.params;
      
      try {
        const embedding = await generateEmbedding(text);
        return {
          embedding: Array.from(embedding),
          dimensions: embedding.length
        };
      } catch (error) {
        console.error('Error generating embedding:', error.message);
        throw new Error(`Failed to generate embedding: ${error.message}`);
      }
    });
    
    server.setRequestHandler('calculate_similarity', async (request) => {
      const { embedding1, embedding2 } = request.params;
      
      try {
        const vec1 = new Float32Array(embedding1);
        const vec2 = new Float32Array(embedding2);
        const similarity = calculateSimilarity(vec1, vec2);
        
        return {
          similarity,
          above_threshold: similarity >= SIMILARITY_THRESHOLD
        };
      } catch (error) {
        console.error('Error calculating similarity:', error.message);
        throw new Error(`Failed to calculate similarity: ${error.message}`);
      }
    });
    
    server.setRequestHandler('batch_similarity', async (request) => {
      const { query_embedding, document_embeddings } = request.params;
      
      try {
        const queryVec = new Float32Array(query_embedding);
        const results = [];
        
        for (const [docId, embedding] of Object.entries(document_embeddings)) {
          const docVec = new Float32Array(embedding);
          const similarity = calculateSimilarity(queryVec, docVec);
          
          results.push({
            id: docId,
            similarity,
            above_threshold: similarity >= SIMILARITY_THRESHOLD
          });
        }
        
        // Sort by similarity (highest first)
        results.sort((a, b) => b.similarity - a.similarity);
        
        return { results };
      } catch (error) {
        console.error('Error calculating batch similarity:', error.message);
        throw new Error(`Failed to calculate batch similarity: ${error.message}`);
      }
    });
    
    // Periodically save cache
    const saveInterval = setInterval(saveEmbeddingCache, 5 * 60 * 1000); // Every 5 minutes
    
    // Connect to Node transport
    const bridge = new NodeBridge(process.stdin, process.stdout);
    server.connectTransport(bridge);
    
    console.log('Semantic analysis server started successfully');
    
    // Handle clean shutdown
    process.on('SIGINT', () => {
      clearInterval(saveInterval);
      saveEmbeddingCache();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      clearInterval(saveInterval);
      saveEmbeddingCache();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});


