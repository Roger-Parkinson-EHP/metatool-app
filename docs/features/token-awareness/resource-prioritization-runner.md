# Resource Prioritization Runner

## Overview

The ResourcePrioritizationRunner serves as the central coordination component for resource-aware token management in the MetaMCP application. It integrates resource tracking, token counting, and database persistence to ensure the most relevant resources are included in LLM context windows while respecting token budget constraints.

## Core Functionality

The ResourcePrioritizationRunner provides the following key capabilities:

1. **Event-Based Persistence**: Tracks resource access events and persists them to the database in real-time
2. **Token-Aware Resource Prioritization**: Selects resources based on importance scores within token budget limits
3. **Coordinated Component Integration**: Bridges resource tracking and token counting capabilities
4. **Metrics Generation**: Produces reports on resource usage and prioritization effectiveness

## Component Architecture

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│   ResourceTracker  │     │    TokenCounter    │     │   ResourceService  │
│                    │     │                    │     │                    │
│  - Track access    │     │  - Count tokens    │     │  - Store resources │
│  - Calculate       │     │  - Estimate file   │     │  - Log access      │
│    importance      │     │    token counts    │     │  - Query DB        │
└────────────────────┘     └────────────────────┘     └────────────────────┘
            ▲                        ▲                         ▲
            │                        │                         │
            │                        │                         │
            │                        │                         │
            │        ┌────────────────────────────┐           │
            │        │  ResourcePrioritizationRunner           │
            └────────┤                            ├───────────┘
                     │  - Coordinate components   │
                     │  - Prioritize resources    │
                     │  - Generate metrics        │
                     └────────────────────────────┘
                                    │
                                    ▼
                     ┌────────────────────────────┐
                     │       LLM Context          │
                     │                            │
                     │  - Optimized resources     │
                     │  - Token-efficient         │
                     └────────────────────────────┘
```

## Implementation Details

### Constructor and Initialization

```typescript
constructor(sessionId: string) {
  this.tracker = new ResourceTracker();
  this.tokenCounter = new TokenCounter();
  this.resourceService = new ResourceService();
  this.sessionId = sessionId;
  
  // Set session ID on tracker
  this.tracker.setSessionId(sessionId);
  
  // Set up event listener for resource access
  this.tracker.on('resourceAccess', async (eventData) => {
    // Persist access to database
    try {
      const resourceId = await this.resourceService.trackResource({
        path: eventData.path,
        type: eventData.type,
        size: eventData.metadata.size,
        modifiedDuringSession: eventData.metadata.modified || false,
        lastAccessed: eventData.timestamp,
        accessCount: 1
      });
      
      await this.resourceService.logAccess({
        resourceUuid: resourceId,
        sessionUuid: this.sessionId,
        accessType: eventData.accessType
      });
    } catch (error) {
      console.error('Error persisting resource access:', error);
    }
  });
}
```

### Resource Access Tracking

```typescript
trackResourceAccess(
  path: string,
  type: ResourceType,
  accessType: AccessType,
  metadata: { size?: number; modified?: boolean } = {}
): void {
  this.tracker.trackAccess(path, type, accessType, metadata);
}
```

### Resource Prioritization

```typescript
async prioritizeResourcesForContext(tokenBudget: number): Promise<string[]> {
  // Get important resources based on tracker
  const resourcePaths = this.tracker.getImportantResourcePaths();
  const resources: Array<{
    path: string;
    importance: number;
    tokenCount: number;
    content?: string;
  }> = [];
  
  // Get token counts for each resource
  for (const path of resourcePaths) {
    try {
      // First try to get a token count estimate based on file size and type
      const tokenCount = await this.tokenCounter.estimateFileTokens(path);
      
      resources.push({
        path,
        importance: this.getResourceImportance(path),
        tokenCount
      });
    } catch (error) {
      console.error(`Error estimating tokens for ${path}:`, error);
    }
  }
  
  // Sort by importance
  resources.sort((a, b) => b.importance - a.importance);
  
  // Select resources to fit budget
  const selectedResources: string[] = [];
  let remainingBudget = tokenBudget;
  
  for (const resource of resources) {
    if (resource.tokenCount <= remainingBudget) {
      selectedResources.push(resource.path);
      remainingBudget -= resource.tokenCount;
      
      // Update session_resources table
      await this.resourceService.updateResourceImportance({
        sessionUuid: this.sessionId,
        resourceUuid: await this.getResourceUuid(resource.path),
        importanceScore: resource.importance
      });
      
      await this.resourceService.setResourceIncludedInContext({
        sessionUuid: this.sessionId,
        resourceUuid: await this.getResourceUuid(resource.path),
        included: true
      });
    }
  }
  
  return selectedResources;
}
```

### Metrics Generation

```typescript
async generateMetricsReport(): Promise<string> {
  const sessionResources = await this.resourceService.getSessionResources(this.sessionId);
  const resourcesByType: Record<string, number> = {};
  
  for (const resource of sessionResources) {
    resourcesByType[resource.type] = (resourcesByType[resource.type] || 0) + 1;
  }
  
  const includedResources = sessionResources.filter(r => r.importanceScore > 0);
  const totalTokens = includedResources.reduce((sum, r) => sum + (r.tokenCount || 0), 0);
  
  let report = `# Session Resource Metrics\n\n`;
  report += `## Overview\n\n`;
  report += `- Session ID: ${this.sessionId}\n`;
  report += `- Total Resources: ${sessionResources.length}\n`;
  report += `- Included in Context: ${includedResources.length}\n`;
  report += `- Total Tokens: ${totalTokens}\n\n`;
  
  report += `## Resources by Type\n\n`;
  for (const [type, count] of Object.entries(resourcesByType)) {
    report += `- ${type}: ${count}\n`;
  }
  
  report += `\n## Top Resources by Importance\n\n`;
  const topResources = [...sessionResources]
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, 5);
    
  for (const resource of topResources) {
    report += `- ${resource.path} (Importance: ${resource.importanceScore}, Tokens: ${resource.tokenCount || 'Unknown'})\n`;
  }
  
  return report;
}
```

## Usage Examples

### Creating a New Session

```typescript
// Create a new session with token budget
const sessionId = await ResourcePrioritizationRunner.createSession(8000, 'Development session');

// Initialize the runner
const runner = new ResourcePrioritizationRunner(sessionId);
```

### Tracking Resource Access

```typescript
// Track file opening
runner.trackResourceAccess('/project/src/main.ts', ResourceType.CODE, AccessType.VIEW, { size: 1024 });

// Track file editing
runner.trackResourceAccess('/project/src/main.ts', ResourceType.CODE, AccessType.EDIT, { modified: true });
```

### Prioritizing Resources for Context

```typescript
// Get prioritized resources within token budget
const tokenBudget = 3000;
const prioritizedResources = await runner.prioritizeResourcesForContext(tokenBudget);

// Use prioritized resources in context
console.log('Resources to include in context:');
for (const path of prioritizedResources) {
  console.log(`- ${path} (Importance: ${runner.getResourceImportance(path)})`);
}
```

### Generating a Metrics Report

```typescript
// Generate a human-readable report
const report = await runner.generateMetricsReport();
console.log(report);
```

## Integration Points

### Editor Integration

```typescript
// When files are opened in the editor
editor.on('fileOpen', (filePath, content) => {
  runner.trackResourceAccess(
    filePath, 
    getResourceTypeFromPath(filePath),
    AccessType.VIEW,
    { size: Buffer.byteLength(content, 'utf8') }
  );
});

// When files are modified
editor.on('fileModify', (filePath, content) => {
  runner.trackResourceAccess(
    filePath,
    getResourceTypeFromPath(filePath),
    AccessType.EDIT,
    { modified: true, size: Buffer.byteLength(content, 'utf8') }
  );
});
```

### LLM Context Integration

```typescript
// When preparing context for LLM
async function prepareContext(prompt: string, tokenBudget = 8000) {
  // Reserve tokens for prompt and overhead
  const promptTokens = runner.countTokens(prompt);
  const overheadTokens = 500; // Reserve for metadata, formatting, etc.
  const resourceTokens = tokenBudget - promptTokens - overheadTokens;
  
  // Get prioritized resources
  const resources = await runner.prioritizeResourcesForContext(resourceTokens);
  
  // Read resource contents and format for context
  // ...
  
  return formattedContext;
}
```

## Testing Approach

The ResourcePrioritizationRunner should be tested with a combination of unit, integration, and end-to-end tests:

### Unit Tests

- Test importance scoring calculations
- Test token budget allocation
- Test metrics report generation

### Integration Tests

- Test database persistence of resource access
- Test prioritization with different token budgets
- Test coordination between components

### End-to-End Tests

- Test with realistic file sets and access patterns
- Measure token efficiency in context preparation
- Compare different prioritization strategies

## Future Enhancements

1. **Content-Aware Prioritization**: Analyze resource content for semantic relevance
2. **Dependency Analysis**: Automatically identify related resources that should be included together
3. **User Preference Learning**: Adjust importance scoring based on user feedback
4. **Adaptive Compression**: Apply different compression strategies based on resource type and importance
5. **Visualization Tools**: Provide UI components for viewing resource importance and context inclusion
