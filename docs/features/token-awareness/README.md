# Resource-Aware Token Management

This directory contains documentation and implementation details for the resource-aware token management system in MetaMCP. This feature enhances the application's token awareness by intelligently tracking, prioritizing, and managing resources that are crucial to a user's workflow.

## Core Components

### 1. ResourceTracker

Monitors file access and usage patterns to determine resource importance:

- Tracks file views, edits, executions, and references
- Calculates importance scores based on recency, frequency, and modifications
- Provides methods to query resources by importance

### 2. TokenCounter

Counts tokens accurately for different content types:

- Supports multiple language models (Claude, GPT)
- Estimates token counts for files based on size and type
- Caches results for performance

### 3. ResourceService

Handles database operations for persistence:

- Stores resource metadata and access logs
- Tracks sessions and resource importance
- Provides query methods for analysis

### 4. ResourcePrioritizationRunner

Coordinates the above components:

- Integrates event-based persistence with database
- Handles token-aware resource prioritization
- Generates metrics reports for analysis

## Database Schema

The database schema supports resource tracking with the following tables:

- `resources`: Stores metadata about files and other resources
- `sessions`: Tracks token-limited LLM interaction sessions
- `resource_access_logs`: Records resource access events
- `session_resources`: Links sessions to resources with importance scores

## UI Components

- `ResourceImportanceIndicator`: Visual indicator for resource importance
- `ContextResourcesPanel`: Panel showing resources included in context

## Integration Points

### Editor Integration

The system integrates with the editor to track file operations:

```typescript
// When files are opened in the editor
editor.on('fileOpen', (filePath, content) => {
  trackResourceAccess(
    sessionId, 
    filePath,
    'view',
    { size: Buffer.byteLength(content, 'utf8') }
  );
});
```

### LLM Context Integration

The system optimizes LLM context preparation:

```typescript
// When preparing context for LLM
async function prepareContext(prompt, tokenBudget) {
  const prioritizedResources = await prioritizeResourcesForContext(
    sessionId, tokenBudget - promptTokens - overheadTokens
  );
  
  // Format resources for context...
}
```

## Key Features

### Pragmatic, Simple Approach

- Started with minimal viable functionality
- Focused on measuring actual usage patterns
- Built for iterative improvement

### Multiple Prioritization Strategies

- Recency-based: Prioritizes most recently accessed resources
- Frequency-based: Prioritizes most frequently accessed resources
- Modification-aware: Prioritizes edited resources
- Type-aware: Considers resource types in prioritization
- Hybrid: Uses a weighted combination of factors

### Workflow Simulation

- Development workflow: Code editing and documentation reading
- Research workflow: Working with papers and data analysis
- Content creation workflow: Document drafting and reference materials

### Measurement and Feedback

- Tracks metrics like token efficiency and coverage
- Generates reports comparing strategies
- Provides data for continuous improvement

## Future Enhancements

1. **Content-Aware Prioritization**: Analyze resource content for semantic relevance
2. **Dependency Analysis**: Automatically identify related resources
3. **User Preference Learning**: Adjust based on user feedback
4. **Adaptive Compression**: Apply different compression strategies based on resource type
5. **Vector Embeddings**: Use semantic similarity for resource prioritization

## Documentation Index

- [Implementation Plan](./implementation-plan.md): Detailed implementation strategy
- [Resource-Aware Context](./resource-aware-context.md): Overview and technical approach
- [Resource Prioritization Runner](./resource-prioritization-runner.md): Runner implementation details

## Getting Started

To use the resource-aware token management in your MetaMCP implementation:

1. Create a tracking session:
   ```typescript
   const sessionId = await createTrackingSession(8000, 'Development session');
   ```

2. Track resource access:
   ```typescript
   await trackResourceAccess(
     sessionId,
     '/path/to/file.js',
     'edit',
     { size: content.length, modified: true }
   );
   ```

3. Prioritize resources for context:
   ```typescript
   const prioritizedResources = await prioritizeResourcesForContext(
     sessionId, tokenBudget
   );
   ```

4. Generate metrics:
   ```typescript
   const report = await generateMetricsReport(sessionId);
   ```
