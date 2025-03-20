# RogerThat Semantic Enhancement

## Overview

This document provides a comprehensive guide to the semantic enhancement extension for the RogerThat token management system. The semantic enhancement adds text embedding capabilities and semantic relationship understanding to improve resource prioritization for LLM context windows.

## Architecture

The semantic enhancement consists of three main components:

1. **Semantic Analysis Server**: An MCP-compliant server that provides embedding generation and similarity calculations
2. **RogerThat Token Management Server**: The core server enhanced with semantic-aware prioritization algorithms
3. **Database Schema Extensions**: Additional tables and columns to support semantic relationships

```
+-------------------------+        +-------------------------+
|                         |        |                         |
|  Semantic Analysis      |<------>|  RogerThat Token        |
|  Server                 |        |  Management Server      |
|  - Generate embeddings  |        |  - Track resources      |
|  - Calculate similarity |        |  - Manage token budget  |
|  - Cache embeddings     |        |  - Prioritize resources |
|                         |        |                         |
+-------------------------+        +-------------------------+
             ^                                 ^
             |                                 |
             v                                 v
+---------------------------------------------------------------+
|                                                               |
|                       Database                                |
|                                                               |
|  +-----------------+   +---------------------+                |
|  | resources       |   | resource_relationships |             |
|  | - semantic_score|<->| - similarity_score    |             |
|  +-----------------+   +---------------------+                |
|          ^                         ^                         |
|          |                         |                         |
|          v                         v                         |
|  +-----------------+   +---------------------+                |
|  | sessions        |   | semantic_embeddings  |               |
|  | - semantic_algo |<->| - embedding vector   |               |
|  +-----------------+   +---------------------+                |
|                                                               |
+---------------------------------------------------------------+
```

## Components

### Semantic Analysis Server

The semantic analysis server provides the following capabilities:

- **Embedding Generation**: Transforms text into high-dimensional vectors
- **Similarity Calculation**: Computes cosine similarity between embeddings
- **Batch Processing**: Efficiently processes multiple similarity comparisons
- **Caching**: Maintains an on-disk cache of generated embeddings

API Methods:
- `generate_embedding`: Generate embeddings for a text input
- `calculate_similarity`: Calculate similarity between two embeddings
- `batch_similarity`: Compare a query embedding against multiple document embeddings

### RogerThat Token Management Server

The token management server has been enhanced with semantic capabilities:

- **Semantic Relationships**: Tracks semantic similarity between resources
- **Enhanced Prioritization Algorithms**: Adds semantic-aware algorithms
- **Hybrid Prioritization**: Combines semantic, recency, and importance scores

Prioritization Algorithms:
- `recency`: Prioritizes recently used resources
- `priority`: Prioritizes resources with high explicit priority
- `semantic`: Prioritizes resources based on semantic similarity to current query
- `hybrid-semantic`: Combines all factors with semantic similarity
- `hybrid`: Combines factors without semantic similarity (fallback)

### Database Schema Extensions

New tables and columns have been added to the database schema:

- **resources.semantic_score**: Semantic relevance score (0-100)
- **resource_relationships**: Tracks semantic similarity between resources
  - source_uuid: Source resource UUID
  - target_uuid: Target resource UUID 
  - similarity_score: Semantic similarity (0-1)
- **semantic_embeddings**: Stores resource embeddings
  - resource_uuid: Resource UUID
  - embedding: Binary representation of embedding vector
  - dimensions: Number of dimensions in the embedding
  - model_name: Name of the embedding model used
- **sessions.semantic_algorithm**: Algorithm used for semantic prioritization
- **sessions.semantic_enabled**: Whether semantic features are enabled

## Workflow

1. **Resource Tracking**: Resources are tracked as they are accessed, with text content analyzed
2. **Embedding Generation**: The semantic analysis server generates embeddings for resource content
3. **Relationship Tracking**: Semantic similarities between resources are calculated and stored
4. **Prioritization**: When tokens need to be allocated, resources are prioritized using the selected algorithm
5. **Feedback Loop**: Prioritization effectiveness is tracked and used to improve future allocations

## Setup and Configuration

### Installation

1. Update the Claude Desktop configuration file to include the semantic-analysis and rogerthat servers:

```json
{
  "mcpServers": {
    "semantic-analysis": {
      "command": "node",
      "args": [
        "D:\\UserRoger\\Documents\\GitHub\\modelcontextprotocol\\metatool-app\\scripts\\semantic-server.js"
      ],
      "description": "Semantic analysis service for RogerThat token management, providing text embedding and similarity calculation.",
      "type": "STDIO",
      "restart": {
        "maxRestarts": 3,
        "policy": "on-failure"
      },
      "options": {
        "env": {
          "EMBEDDING_CACHE_DIR": "D:\\UserRoger\\Documents\\GitHub\\modelcontextprotocol\\metatool-app\\.embeddings-cache",
          "EMBEDDING_DIMENSIONS": "384",
          "SIMILARITY_THRESHOLD": "0.7"
        }
      }
    },
    "rogerthat": {
      "command": "node",
      "args": [
        "D:\\UserRoger\\Documents\\GitHub\\modelcontextprotocol\\metatool-app\\scripts\\rogerthat-server.js"
      ],
      "description": "Military-grade token management system for LLM context optimization with semantic awareness capabilities.",
      "type": "STDIO",
      "restart": {
        "maxRestarts": 3,
        "policy": "on-failure"
      },
      "options": {
        "env": {
          "TOKEN_BUDGET": "8000",
          "DEFAULT_ALGORITHM": "hybrid-semantic",
          "ENABLE_SEMANTIC": "true",
          "LOG_LEVEL": "info"
        }
      }
    }
  }
}
```

2. Run the database migration to add semantic tables and columns:

```bash
npm run migrate
```

3. Install required NPM packages:

```bash
npm install @xenova/transformers sqlite3
```

### Configuration Options

#### Semantic Analysis Server

- `EMBEDDING_CACHE_DIR`: Directory to store embedding cache (default: `./.embeddings-cache`)
- `EMBEDDING_DIMENSIONS`: Dimensions of embedding vectors (default: `384`)
- `SIMILARITY_THRESHOLD`: Threshold for considering two resources similar (default: `0.7`)
- `LOG_LEVEL`: Logging verbosity (default: `info`)

#### RogerThat Token Management Server

- `TOKEN_BUDGET`: Maximum tokens available for context (default: `8000`)
- `DEFAULT_ALGORITHM`: Default prioritization algorithm (default: `hybrid-semantic`)
- `ENABLE_SEMANTIC`: Whether to enable semantic features (default: `true`)
- `LOG_LEVEL`: Logging verbosity (default: `info`)
- `DB_PATH`: Path to SQLite database (default: `./data/rogerthat.db`)

## Usage

The semantic enhancement integrates seamlessly with the existing RogerThat token management system. When semantic features are enabled, the system will automatically:

1. Generate embeddings for tracked resources
2. Calculate semantic relationships between resources
3. Use semantic understanding for resource prioritization

To explicitly use semantic-aware prioritization, send a request to the RogerThat server:

```javascript
// Example request to prioritize resources using semantic understanding
const prioritized = await fetch('/api/rogerthat/prioritize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "How do I implement a binary search tree?",
    algorithm: "semantic",  // Or "hybrid-semantic"
  })
});
```

## Testing

Test scripts have been provided to validate the semantic enhancement:

- `test-resource-prioritization-runner.ts`: Tests prioritization algorithms
- `test-semantic-similarity.js`: Tests embedding generation and similarity calculation

To run tests:

```bash
npm run test:semantic
```

## Performance Considerations

- Embedding generation is computationally intensive; caching is essential
- The system automatically caches embeddings to minimize computational overhead
- For large codebases, consider using batch operations for embedding generation
- Similarity calculations scale with O(n²) where n is the number of resources

## Future Enhancements

1. **Semantic Clustering**: Group semantically similar resources for better organization
2. **Query Understanding**: Dynamically adjust token allocation based on query intent
3. **Incremental Embedding**: Update embeddings only for changed portions of resources
4. **Multi-Modal Embeddings**: Support for code-specific and multi-modal embeddings
5. **Federated Learning**: Improve prioritization algorithms based on community feedback

## Conclusion

The semantic enhancement significantly improves the RogerThat token management system by adding understanding of content relationships. By leveraging semantic similarity, the system can make more intelligent decisions about which resources to include in the context window, leading to more effective AI interactions.
