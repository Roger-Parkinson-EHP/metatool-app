# Session Persistence Implementation

## Overview

This document details the technical implementation of the session persistence feature in the MetaMCP extension. Session persistence enables users to continue their work seamlessly when hitting token limits in chat sessions by serializing, storing, and restoring relevant context.

## Architecture

The session persistence feature is built on several components working together:

```mermaid
flowchart TD
    subgraph MCP_Client["MCP Client"]  
        Claude["Claude Desktop"]
        TokenMonitor["Token Monitor"]
    end
    
    subgraph MetaMCP["MetaMCP"]  
        MMCP_Server["MetaMCP MCP Server"]
        SessionManager["Session Manager"]
    end
    
    subgraph MemorySystem["Memory System"] 
        MemoryMCP["Memory MCP"]
        EntityStore["Entity Store"]
        RelationStore["Relation Store"]
    end
    
    subgraph Storage["Storage"]  
        FileSystem["File System"]
    end
    
    TokenMonitor -->|Approaching Limit| Claude
    Claude -->|Save Request| MMCP_Server
    MMCP_Server -->|Serialize Request| SessionManager
    SessionManager -->|Store Entities| MemoryMCP
    MemoryMCP -->|Write Entities| EntityStore
    MemoryMCP -->|Write Relations| RelationStore
    EntityStore --> FileSystem
    RelationStore --> FileSystem
    
    Claude -->|Restore Request| MMCP_Server
    MMCP_Server -->|Deserialize Request| SessionManager
    SessionManager -->|Retrieve Entities| MemoryMCP
    MemoryMCP -->|Read Entities| EntityStore
    MemoryMCP -->|Read Relations| RelationStore
```

### Components

#### Session Manager

The Session Manager is the central component responsible for coordinating session persistence operations:

- **Serialization**: Converts session context into persistent entities and relationships
- **Deserialization**: Reconstructs session context from stored entities and relationships
- **Context Prioritization**: Determines which parts of context are most important to preserve
- **Session Tracking**: Maintains references between related sessions

#### Memory MCP

The Memory MCP provides the structured storage mechanism for session context:

- **Entity Storage**: Stores context items as discrete entities with properties
- **Relationship Tracking**: Maintains connections between related entities
- **Query Capabilities**: Enables retrieval of specific context items
- **Persistence**: Ensures entities and relationships are stored durably

#### Token Monitor

The Token Monitor tracks token usage within the MCP client:

- **Token Counting**: Estimates current token usage in the conversation
- **Threshold Monitoring**: Detects when the conversation approaches token limits
- **Notification**: Alerts the user and system when persistence is needed

## Data Model

The session persistence feature uses a structured data model to represent session context:

### Entity Types

#### Session Entity

Represents a single chat session:

```json
{
  "type": "session",
  "id": "session_<timestamp>",
  "properties": {
    "created_at": "ISO timestamp",
    "workspace_id": "workspace identifier",
    "token_count": "estimated token count",
    "summary": "brief description of session content"
  }
}
```

#### Conversation Entity

Represents the chat conversation content:

```json
{
  "type": "conversation",
  "id": "conversation_<session_id>",
  "properties": {
    "context": "serialized conversation context",
    "token_count": "token count of context"
  }
}
```

#### Context Item Entity

Represents specific important items in the context:

```json
{
  "type": "context_item",
  "id": "context_<unique_id>",
  "properties": {
    "category": "code|file|data|concept|task",
    "content": "serialized item content",
    "importance": "priority score (1-10)",
    "token_count": "token count of item"
  }
}
```

#### File Reference Entity

Represents a file referenced in the conversation:

```json
{
  "type": "file_reference",
  "id": "file_<hash>",
  "properties": {
    "path": "absolute file path",
    "hash": "file content hash",
    "last_modified": "ISO timestamp"
  }
}
```

#### Workspace State Entity

Represents the state of the workspace during the session:

```json
{
  "type": "workspace_state",
  "id": "workspace_state_<session_id>",
  "properties": {
    "workspace_id": "workspace identifier",
    "active_project": "current project",
    "enabled_mcps": "list of active MCPs",
    "settings": "serialized workspace settings"
  }
}
```

### Relationships

Connections between entities are represented as relationships:

- **SESSION_CONTINUES** - Links a new session to its predecessor
- **SESSION_HAS_CONVERSATION** - Links a session to its conversation content
- **SESSION_IN_WORKSPACE** - Links a session to its workspace
- **CONVERSATION_REFERENCES_ITEM** - Links a conversation to important context items
- **CONVERSATION_REFERENCES_FILE** - Links a conversation to referenced files
- **SESSION_HAS_WORKSPACE_STATE** - Links a session to workspace state

## Serialization Process

When a session approaches the token limit, the serialization process is triggered:

1. **Token Threshold Detection**:
   - The Token Monitor estimates current token usage
   - When usage exceeds the configured threshold (e.g., 75% of limit), the process starts

2. **Context Prioritization**:
   - The Session Manager analyzes the conversation to identify key elements
   - Priority is assigned based on recency, relevance, and importance
   - Elements are categorized (code, files, data, concepts, tasks)

3. **Entity Creation**:
   - The Session Manager creates entities for the session, conversation, and context items
   - File references are extracted and stored as entities
   - Workspace state is captured

4. **Relationship Establishment**:
   - Relationships are created to link related entities
   - Previous session connections are established if applicable

5. **Storage**:
   - Entities and relationships are sent to Memory MCP
   - Memory MCP persists them to storage
   - Session metadata is updated

### Context Prioritization Algorithm

The context prioritization uses several factors to determine importance:

- **Recency**: More recent items get higher priority
- **Frequency**: Frequently referenced items get higher priority
- **Specificity**: Specific, detailed items get higher priority
- **Type**: Code and structured data typically get higher priority
- **User Marking**: Items explicitly marked as important get highest priority

The algorithm assigns a score to each context item, and items are ranked for inclusion based on this score.

## Deserialization Process

When a new session is started with a restoration request, the deserialization process is triggered:

1. **Session Identification**:
   - The user selects a previous session to continue from
   - Alternative: The system automatically suggests the most recent session

2. **Entity Retrieval**:
   - The Session Manager requests the session entity and related entities from Memory MCP
   - Relationships are traversed to gather all relevant context

3. **Context Reconstruction**:
   - Context items are ordered by priority
   - A compressed representation of the conversation is created
   - File references are resolved to current states

4. **Token Budget Management**:
   - Available token budget is calculated
   - Context is trimmed to fit within the budget while maximizing information preservation
   - Summarization is applied where appropriate

5. **Session Initialization**:
   - The reconstructed context is provided to the MCP client
   - A new session entity is created and linked to the previous session
   - Workspace state is restored

### Context Reconstruction Strategies

Several strategies are employed to reconstruct context efficiently:

- **Hierarchical Summarization**: Creating summaries at different levels of detail
- **Entity Extraction**: Pulling out key entities and their properties
- **Compressed Representation**: Using more token-efficient representations
- **Reference Mechanism**: Using references to content rather than full content
- **Selective Inclusion**: Including only the most relevant parts of context

## Storage Implementation

The session persistence feature uses a hierarchical storage structure:

```
storage/
├── sessions/
│   ├── workspace_1/
│   │   ├── session_<timestamp1>/
│   │   │   ├── metadata.json
│   │   │   ├── entities.json
│   │   │   └── relationships.json
│   │   └── session_<timestamp2>/
│   │       ├── metadata.json
│   │       ├── entities.json
│   │       └── relationships.json
│   └── workspace_2/
│       └── ...
└── shared/
    └── file_references/
        └── ...
```

This structure ensures:

- **Workspace Isolation**: Sessions from different workspaces are kept separate
- **Session Organization**: Each session has its own directory
- **Shared Resources**: Common resources can be shared across sessions

## API

The session persistence feature provides several APIs:

### Session Management API

```typescript
interface SessionManager {
  // Save the current session context
  saveSession(params: {
    workspaceId: string;
    conversationContext: string;
    tokenCount: number;
    contextItems?: ContextItem[];
    fileReferences?: FileReference[];
    workspaceState?: WorkspaceState;
  }): Promise<{ sessionId: string }>;

  // Restore a previous session
  restoreSession(params: {
    sessionId?: string; // If not provided, uses most recent
    workspaceId: string;
    tokenBudget: number;
  }): Promise<{ 
    context: string;
    contextItems: ContextItem[];
    fileReferences: FileReference[];
    workspaceState: WorkspaceState;
  }>;

  // List available sessions
  listSessions(params: {
    workspaceId: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    sessions: SessionMetadata[];
    total: number;
  }>;

  // Get session details
  getSession(params: {
    sessionId: string;
  }): Promise<SessionMetadata>;

  // Delete a session
  deleteSession(params: {
    sessionId: string;
  }): Promise<void>;
}
```

### Memory MCP API Integration

The Memory MCP is accessed through its standard MCP interface:

```typescript
interface MemoryMCP {
  // Create or update an entity
  upsert_entity(params: {
    type: string;
    id: string;
    properties: Record<string, any>;
  }): Promise<{ id: string }>;

  // Create a relationship between entities
  create_relationship(params: {
    from_id: string;
    to_id: string;
    type: string;
    properties?: Record<string, any>;
  }): Promise<{ id: string }>;

  // Query entities
  query_entities(params: {
    types?: string[];
    filters?: Filter[];
    sort?: Sort[];
    limit?: number;
    offset?: number;
  }): Promise<{
    entities: Entity[];
    total: number;
  }>;

  // Query relationships
  query_relationships(params: {
    from_id?: string;
    to_id?: string;
    types?: string[];
    filters?: Filter[];
    sort?: Sort[];
    limit?: number;
    offset?: number;
  }): Promise<{
    relationships: Relationship[];
    total: number;
  }>;
}
```

## Configuration

The session persistence feature is configured through several settings:

### Token Management

- **tokenLimit**: Maximum tokens before session must be saved (default: client's maximum)
- **tokenThreshold**: Percentage of token limit that triggers saving (default: 75%)
- **tokenSafetyMargin**: Extra tokens reserved for system messages (default: 100)

### Storage

- **storageDirectory**: Location for session persistence files (default: ~/.metamcp/sessions)
- **retentionPeriod**: How long sessions are kept before automatic cleanup (default: 30 days)
- **compressionEnabled**: Whether to compress stored sessions (default: true)

### Context Management

- **priorityThreshold**: Minimum priority score for items to be included (default: 3)
- **maxContextItems**: Maximum number of context items to restore (default: 50)
- **summarizationEnabled**: Whether to use summarization for context (default: true)

## Security Considerations

Session persistence involves storing potentially sensitive information, so several security measures are implemented:

- **Workspace Isolation**: Sessions from different workspaces are stored separately
- **File Path Sanitization**: File paths are validated and sanitized before storage
- **Permission Enforcement**: Access to session data respects workspace permissions
- **Optional Encryption**: Session data can be encrypted at rest
- **Data Minimization**: Only necessary data is persisted

## Performance Considerations

To ensure optimal performance, the implementation includes:

- **Incremental Updates**: Only changed entities are updated
- **Lazy Loading**: Entities are loaded on demand
- **Caching**: Frequently accessed entities are cached
- **Asynchronous Processing**: Long-running operations run in the background
- **Compression**: Data is compressed to reduce storage and improve I/O

## Edge Cases and Error Handling

The implementation handles various edge cases:

- **Storage Failure**: If storage fails, session data is kept in memory until resolution
- **Corrupted Session**: Corrupted sessions are skipped with warning
- **Missing Dependencies**: If Memory MCP is unavailable, graceful degradation occurs
- **Version Mismatch**: Data format version changes are handled through migration
- **Concurrent Access**: Locking prevents concurrent modification issues

## Testing Approach

The session persistence feature is tested through several approaches:

- **Unit Tests**: Individual components are tested in isolation
- **Integration Tests**: Components are tested working together
- **End-to-End Tests**: Full persistence flow is tested with real clients
- **Performance Tests**: System is tested under various load conditions
- **Security Tests**: System is tested for security vulnerabilities

## Implementation Phases

The session persistence feature is implemented in phases:

1. **Phase 1 (Basic Functionality)**:
   - Simple session serialization/deserialization
   - Basic file storage
   - Manual session selection

2. **Phase 2 (Enhanced Functionality)**:
   - Context prioritization
   - Hierarchical summarization
   - Automatic session continuation

3. **Phase 3 (Advanced Features)**:
   - Cross-session references
   - Adaptive token budgeting
   - Context analytics

## Enhanced Token Awareness

To optimize token usage and ensure efficient context preservation, the session persistence feature implements enhanced token awareness mechanisms:

### Dynamic Token Counting

```typescript
function countTokens(text: string): number {
  // Implement more accurate token counting
  // Uses a model-specific tokenizer that matches the LLM's tokenization
  return tokenCounter.count(text);
}
```

This provides precise token counting for different content types, ensuring that token budgets are accurately managed.

### Token Budget Allocation

```typescript
function allocateTokenBudget(totalBudget: number, contextTypes: string[]): Record<string, number> {
  // Smart budget allocation based on context types
  const budget: Record<string, number> = {};
  
  // Default allocation for development sessions
  if (contextTypes.includes('code')) {
    budget.code = Math.floor(totalBudget * 0.6); // 60% for code
    budget.conversation = Math.floor(totalBudget * 0.3); // 30% for conversation
    budget.metadata = Math.floor(totalBudget * 0.1); // 10% for metadata
  } else {
    // Different allocation for non-code contexts
    budget.conversation = Math.floor(totalBudget * 0.7);
    budget.metadata = Math.floor(totalBudget * 0.3);
  }
  
  return budget;
}
```

This enables smart allocation of the token budget across different types of context, prioritizing the most relevant content types.

### Adaptive Compression

```typescript
function compressContext(context: string, targetTokens: number): string {
  const currentTokens = countTokens(context);
  
  if (currentTokens <= targetTokens) {
    return context; // No compression needed
  }
  
  // Try increasingly aggressive compression strategies
  let compressedContext = context;
  
  // 1. Remove redundant whitespace
  compressedContext = removeRedundantWhitespace(compressedContext);
  if (countTokens(compressedContext) <= targetTokens) return compressedContext;
  
  // 2. Remove comments
  compressedContext = removeComments(compressedContext);
  if (countTokens(compressedContext) <= targetTokens) return compressedContext;
  
  // 3. Summarize sections
  compressedContext = summarizeSections(compressedContext, targetTokens);
  
  return compressedContext;
}
```

This applies progressive compression strategies to fit content within token limits while preserving as much meaning as possible.

## Vector Similarity for Context Prioritization

To enhance context prioritization, the system uses vector embeddings and similarity calculations to determine the most relevant information to persist:

### Embedding Generation

```typescript
async function generateEmbedding(content: string): Promise<number[]> {
  // Use a model to generate embeddings
  // Could use OpenAI, Hugging Face, or local models
  const response = await embeddingModel.embed(content);
  return response.embedding;
}
```

### Semantic Similarity Calculation

```typescript
async function prioritizeContext(currentContext: string, allContextItems: ContextItem[]): Promise<ContextItem[]> {
  // Generate embedding for current context
  const currentEmbedding = await generateEmbedding(currentContext);
  
  // Generate embeddings for all context items (could be cached)
  const itemsWithEmbeddings = await Promise.all(
    allContextItems.map(async item => ({
      ...item,
      embedding: await generateEmbedding(item.content),
      similarity: 0 // Will be calculated next
    }))
  );
  
  // Calculate cosine similarity
  for (const item of itemsWithEmbeddings) {
    item.similarity = calculateCosineSimilarity(currentEmbedding, item.embedding);
  }
  
  // Sort by similarity
  const sortedItems = [...itemsWithEmbeddings].sort((a, b) => b.similarity - a.similarity);
  
  return sortedItems;
}
```

This approach is particularly valuable for linking related code elements and API documentation through semantic understanding rather than just explicit references.

## File Operation Security

To ensure secure and controlled file operations, the session persistence feature implements strict controls:

### File Operation Logging

```typescript
function logFileOperation(operation: string, path: string, userId: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | ${userId} | ${operation} | ${path}`;
  
  // Append to log file
  fs.appendFileSync('file_operations.log', logEntry + '\n');
  
  // Could also emit to a structured logging system
  logger.info('FileOperation', { operation, path, userId, timestamp });
}
```

This provides an audit trail of all file operations for security monitoring and debugging.

### Permission System

```typescript
function checkFilePermission(operation: string, path: string, userId: string): boolean {
  // Check against allowed paths configuration
  const allowedPaths = config.getAllowedPathsForUser(userId);
  
  // Normalize paths for comparison
  const normalizedPath = path.normalize(path);
  
  // Check if path is in allowed paths
  const isAllowed = allowedPaths.some(allowedPath => 
    normalizedPath.startsWith(allowedPath)
  );
  
  // Always log attempts
  logFileOperation(operation, path, userId);
  
  return isAllowed;
}
```

This restricts file operations to only allowed paths, preventing unauthorized access.

### Restricted Operations

Some operations are explicitly restricted until proper controls are in place:

- **write_file**: Disabled by default, requiring explicit configuration to enable
- **create_directory**: Restricted to specific allowed directories only

When these operations are attempted, they are logged and blocked unless explicitly allowed by configuration.

## Integration with External MCP Servers

The session persistence feature can be enhanced by integrating with additional specialized MCP servers:

### Development Workflow MCPs

- **AiDD MCP**: Provides advanced code analysis and development context preservation
- **Code Analyzer MCP**: Enhances Python code context extraction and prioritization

### Token-Aware Context Extraction

- **Python MCP**: Implements token-aware Python code extraction for efficient token usage
- **Source Sage MCP**: Provides project structure visualization for better contextual understanding

These integrations enhance the core session persistence capabilities with specialized functionality for different content types and development workflows.

## Feedback Loops and Self-Improvement

The session persistence system includes mechanisms for continuous improvement through feedback loops:

### Context Preservation Measurement

```typescript
function measureContextPreservation(originalContext: string, restoredContext: string): number {
  // Calculate preservation score based on semantic similarity
  const originalEmbedding = await generateEmbedding(originalContext);
  const restoredEmbedding = await generateEmbedding(restoredContext);
  
  return calculateCosineSimilarity(originalEmbedding, restoredEmbedding);
}
```

This provides quantitative feedback on the effectiveness of context preservation.

### Adaptive Strategy Improvement

```typescript
function updatePrioritizationStrategy(preservationScores: Record<string, number[]>): void {
  // Analyze preservation scores across different context types
  // Adjust prioritization weights based on performance
  for (const [contextType, scores] of Object.entries(preservationScores)) {
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // If performance is below threshold, adjust weights
    if (avgScore < 0.8) { // 80% preservation threshold
      prioritizationWeights[contextType] *= 1.1; // Increase weight by 10%
    }
  }
}
```

This enables the system to learn from its performance and improve over time.

### Parametrized Testing

The system includes shell scripts for parametrized testing of different strategies:

```bash
#!/bin/bash
# test-session-persistence.sh

# Parameters
SESSION_SIZE=${1:-"medium"}  # small, medium, large
CONTEXT_TYPE=${2:-"code"}    # code, conversation, mixed
COMPRESSION=${3:-"on"}       # on, off
PRIORITY_ALGO=${4:-"recency"}  # recency, importance, hybrid, vector

# Set up test environment
mkdir -p test_results/${SESSION_SIZE}_${CONTEXT_TYPE}_${COMPRESSION}_${PRIORITY_ALGO}

# Generate test conversation based on parameters
node scripts/generate-test-conversation.js \
  --size ${SESSION_SIZE} \
  --type ${CONTEXT_TYPE} \
  > test_data/conversation.json

# Run serialization test
echo "Testing serialization..."
time node scripts/serialize-session.js \
  --compression ${COMPRESSION} \
  --algorithm ${PRIORITY_ALGO} \
  --input test_data/conversation.json \
  --output test_data/serialized.json \
  2> test_results/${SESSION_SIZE}_${CONTEXT_TYPE}_${COMPRESSION}_${PRIORITY_ALGO}/serialize_metrics.txt

# Run deserialization test
echo "Testing deserialization..."
time node scripts/deserialize-session.js \
  --input test_data/serialized.json \
  --output test_data/restored.json \
  2> test_results/${SESSION_SIZE}_${CONTEXT_TYPE}_${COMPRESSION}_${PRIORITY_ALGO}/deserialize_metrics.txt

# Compare original vs restored
node scripts/compare-sessions.js \
  --original test_data/conversation.json \
  --restored test_data/restored.json \
  > test_results/${SESSION_SIZE}_${CONTEXT_TYPE}_${COMPRESSION}_${PRIORITY_ALGO}/comparison.json

# Generate report
node scripts/generate-report.js \
  --metrics test_results/${SESSION_SIZE}_${CONTEXT_TYPE}_${COMPRESSION}_${PRIORITY_ALGO}/ \
  --output test_results/${SESSION_SIZE}_${CONTEXT_TYPE}_${COMPRESSION}_${PRIORITY_ALGO}/report.md

echo "Test complete. Results in test_results/${SESSION_SIZE}_${CONTEXT_TYPE}_${COMPRESSION}_${PRIORITY_ALGO}/"
```

This framework enables systematic testing of different persistence strategies and automatic collection of performance metrics.
