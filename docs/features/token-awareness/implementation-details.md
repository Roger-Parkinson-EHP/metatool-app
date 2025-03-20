# RogerThat: Implementation Details

## Overview

This document provides a detailed look at the RogerThat token management system implementation, focusing on the core components, their interaction, testing methodology, and feedback-driven improvement cycles.

## System Architecture

RogerThat follows a modular architecture with clear separation of concerns:

```
+---------------------+    +---------------------+    +---------------------+
|                     |    |                     |    |                     |
|  ResourceTracker    |<-->|  TokenCounter       |<-->|  ResourceService    |
|  - Track access     |    |  - Count tokens     |    |  - Store resources  |
|  - Calculate        |    |  - Estimate file    |    |  - Log access       |
|    importance       |    |    token counts     |    |  - Query DB         |
|                     |    |                     |    |                     |
+---------------------+    +---------------------+    +---------------------+
            ^                        ^                         ^
            |                        |                         |
            v                        v                         v
+----------------------------------------------------------------------+
|                                                                      |
|                 ResourcePrioritizationRunner                         |
|                                                                      |
|  - Coordinate components      - Prioritize resources                 |
|  - Generate metrics           - Handle errors                        |
|                                                                      |
+----------------------------------------------------------------------+
                                    |
                                    v
+----------------------------------------------------------------------+
|                                                                      |
|                         LLM Context                                  |
|                                                                      |
|  - Optimized resources          - Token-efficient                    |
|                                                                      |
+----------------------------------------------------------------------+
```

## Core Components

### 1. ResourceTracker

Tracks file access patterns and calculates importance scores based on recency, frequency, access type, and modification status.

**Key Implementation Points:**

```typescript
export class ResourceTracker extends EventEmitter {
  private resources: Map<string, ResourceStats> = new Map();
  private currentSessionId?: string;
  
  // Track a resource access
  trackAccess(
    path: string,
    type: ResourceType,
    accessType: AccessType,
    metadata: { size?: number; modified?: boolean } = {}
  ): void {
    // Normalize path for consistent tracking
    const normalizedPath = this.normalizePath(path);
    
    // Get or create resource stats
    const stats = this.getOrCreateResourceStats(normalizedPath, type);
    
    // Update stats
    stats.accessCount++;
    stats.lastAccessed = new Date();
    stats.accessTypes.add(accessType);
    if (metadata.size !== undefined) stats.size = metadata.size;
    if (metadata.modified) stats.modified = true;
    
    // Emit event for listeners
    this.emit('resourceAccess', {
      path: normalizedPath,
      type,
      accessType,
      sessionId: this.currentSessionId,
      timestamp: new Date(),
      metadata
    });
  }
  
  // Calculate importance score for a resource
  getResourceImportance(path: string): number {
    const normalizedPath = this.normalizePath(path);
    const stats = this.resources.get(normalizedPath);
    
    if (!stats) return 0;
    
    // Calculate recency component (0-40 points)
    const hoursSinceLastAccess = 
      (Date.now() - stats.lastAccessed.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 40 - Math.min(hoursSinceLastAccess, 40));
    
    // Calculate frequency component (0-30 points)
    const frequencyScore = Math.min(stats.accessCount, 15) * 2;
    
    // Calculate access type component (0-15 points)
    let accessTypeScore = 0;
    if (stats.accessTypes.has(AccessType.EDIT)) accessTypeScore += 10;
    if (stats.accessTypes.has(AccessType.EXECUTE)) accessTypeScore += 5;
    if (stats.accessTypes.has(AccessType.REFERENCE)) accessTypeScore += 3;
    
    // Calculate modification bonus (0-15 points)
    const modificationScore = stats.modified ? 15 : 0;
    
    // Combined score (0-100)
    return recencyScore + frequencyScore + accessTypeScore + modificationScore;
  }
  
  // Get the most important resource paths
  getImportantResourcePaths(): string[] {
    // Calculate importance for all resources
    const resourceImportance = Array.from(this.resources.entries())
      .map(([path, stats]) => ({
        path,
        importance: this.getResourceImportance(path)
      }))
      .sort((a, b) => b.importance - a.importance);
    
    return resourceImportance.map(item => item.path);
  }
}
```

### 2. TokenCounter

Provides token counting capabilities for different content types and language models, with caching for performance.

**Key Implementation Points:**

```typescript
export class TokenCounter {
  private tokenizers: Map<string, Tokenizer> = new Map();
  private defaultTokenizer: Tokenizer;
  private cache: Map<string, number> = new Map();
  
  constructor(private cacheSize: number = 1000) {
    // Register default tokenizers
    this.registerTokenizer(new ClaudeTokenizer());
    this.registerTokenizer(new GptTokenizer());
    
    // Set default tokenizer
    this.defaultTokenizer = new ClaudeTokenizer();
  }
  
  // Count tokens in text
  countTokens(text: string, modelName?: string): number {
    // Use the cache if available
    const cacheKey = `${modelName || this.defaultTokenizer.modelName}:${text.slice(0, 100)}:${text.length}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Get the appropriate tokenizer
    const tokenizer = modelName ? this.tokenizers.get(modelName) : this.defaultTokenizer;
    
    // Count tokens
    let count: number;
    if (tokenizer) {
      count = tokenizer.countTokens(text);
    } else {
      count = approximateTokenCount(text);
    }
    
    // Cache the result
    this.cache.set(cacheKey, count);
    this.limitCacheSize();
    
    return count;
  }
  
  // Estimate token count for a file
  async estimateFileTokens(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      const fileSizeInBytes = stats.size;
      const resourceType = this.getResourceTypeFromPath(filePath);
      
      // Different file types have different bytes-per-token ratios
      let bytesPerToken: number;
      switch (resourceType) {
        case ResourceType.CODE:
          bytesPerToken = 3.5; // Code tends to be more compact
          break;
        case ResourceType.DOCUMENTATION:
          bytesPerToken = 4.0; // Documentation is typically English text
          break;
        case ResourceType.DATA:
          bytesPerToken = 5.0; // Data formats have more structure
          break;
        default:
          bytesPerToken = 4.0; // Default assumption
      }
      
      return Math.ceil(fileSizeInBytes / bytesPerToken);
    } catch (error) {
      console.error(`Error estimating tokens for file ${filePath}:`, error);
      return 0;
    }
  }
}
```

### 3. ResourceService

Manages persistence of resource tracking data, integrating with the database to store and retrieve resource metadata, session information, and access logs.

**Key Implementation Points:**

```typescript
export class ResourceService {
  // Create a new session
  async createSession(
    data: { tokenCount: number; summary?: string }
  ): Promise<string> {
    try {
      const result = await db.insert(schema.sessions)
        .values({
          uuid: randomUUID(),
          token_count: data.tokenCount,
          summary: data.summary || 'Resource prioritization session',
          created_at: new Date()
        })
        .returning();
      
      return result[0].uuid;
    } catch (error) {
      throw new Error(`Failed to create session: ${error}`);
    }
  }
  
  // Track a resource (create or update)
  async trackResource(
    data: {
      path: string;
      type: ResourceType;
      size?: number;
      lastAccessed: Date;
      accessCount: number;
      modifiedDuringSession: boolean;
    }
  ): Promise<string> {
    try {
      // Check if resource already exists
      const existing = await this.getResourceByPath(data.path);
      
      if (existing) {
        // Update existing resource
        const result = await db.update(schema.resources)
          .set({
            size: data.size ?? existing.size,
            last_accessed: data.lastAccessed,
            access_count: existing.accessCount + data.accessCount,
            modified_during_session: existing.modifiedDuringSession || data.modifiedDuringSession
          })
          .where(eq(schema.resources.uuid, existing.uuid))
          .returning();
        
        return result[0].uuid;
      } else {
        // Create new resource
        const result = await db.insert(schema.resources)
          .values({
            uuid: randomUUID(),
            path: data.path,
            type: data.type,
            size: data.size,
            last_accessed: data.lastAccessed,
            access_count: data.accessCount,
            modified_during_session: data.modifiedDuringSession,
            created_at: new Date()
          })
          .returning();
        
        return result[0].uuid;
      }
    } catch (error) {
      throw new Error(`Failed to track resource: ${error}`);
    }
  }
  
  // Log a resource access
  async logAccess(
    data: {
      resourceUuid: string;
      sessionUuid: string;
      accessType: AccessType;
    }
  ): Promise<void> {
    try {
      await db.insert(schema.resourceAccessLogs)
        .values({
          uuid: randomUUID(),
          resource_uuid: data.resourceUuid,
          session_uuid: data.sessionUuid,
          access_type: data.accessType,
          timestamp: new Date()
        });
    } catch (error) {
      throw new Error(`Failed to log access: ${error}`);
    }
  }
  
  // Set resource importance in a session
  async updateResourceImportance(
    data: {
      sessionUuid: string;
      resourceUuid: string;
      importanceScore: number;
    }
  ): Promise<void> {
    // Implementation details omitted for brevity
  }
}
```

### 4. ResourcePrioritizationRunner

Coordinates the other components, managing resource prioritization within token budgets and handling asynchronous operations.

**Key Implementation Points:**

```typescript
export class ResourcePrioritizationRunner {
  private tracker: ResourceTracker;
  private tokenCounter: TokenCounter;
  private resourceService: ResourceService;
  private sessionId: string;
  private pendingOperations: Promise<any>[] = [];
  private logger: ResourceLogger;
  
  constructor(sessionId: string) {
    this.tracker = new ResourceTracker();
    this.tokenCounter = new TokenCounter();
    this.resourceService = new ResourceService();
    this.sessionId = sessionId;
    this.logger = new ResourceLogger(`ResourcePrioritizationRunner:${sessionId.substring(0, 8)}`);
    
    // Set session ID on tracker
    this.tracker.setSessionId(sessionId);
    
    // Set up event listener for resource access
    this.tracker.on('resourceAccess', async (eventData) => {
      // Persist access to database
      try {
        const operationPromise = (async () => {
          this.logger.debug(`Processing resource access: ${eventData.path} (${eventData.accessType})`);
          
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
          
          this.logger.debug(`Completed processing resource access: ${eventData.path}`);
        })();
        
        // Track pending operations for proper cleanup
        this.pendingOperations.push(operationPromise);
        
        // Clean up completed operations
        operationPromise.finally(() => {
          const index = this.pendingOperations.indexOf(operationPromise);
          if (index !== -1) {
            this.pendingOperations.splice(index, 1);
          }
        });
      } catch (error) {
        this.logger.error(`Error persisting resource access for ${eventData.path}:`, error);
      }
    });
  }
  
  // Prioritize resources for context within token budget
  async prioritizeResourcesForContext(tokenBudget: number): Promise<string[]> {
    return this.logger.timeOperation('prioritizeResourcesForContext', async () => {
      this.logger.info(`Prioritizing resources for token budget: ${tokenBudget}`);
      
      // Wait for any pending database operations to complete first
      await this.waitForPendingOperations();
      
      // Get important resources based on tracker
      const resourcePaths = this.tracker.getImportantResourcePaths();
      
      // Get token counts for each resource
      const resources = [];
      for (const path of resourcePaths) {
        try {
          // Estimate tokens based on file size and type
          const tokenCount = await this.tokenCounter.estimateFileTokens(path);
          const importance = this.getResourceImportance(path);
          
          resources.push({ path, importance, tokenCount });
        } catch (error) {
          this.logger.error(`Error estimating tokens for ${path}:`, error);
        }
      }
      
      // Sort by importance
      resources.sort((a, b) => b.importance - a.importance);
      
      // Select resources to fit budget
      const selectedResources = [];
      let remainingBudget = tokenBudget;
      
      // Track database update operations
      const updatePromises = [];
      
      for (const resource of resources) {
        if (resource.tokenCount <= remainingBudget) {
          selectedResources.push(resource.path);
          remainingBudget -= resource.tokenCount;
          
          // Update session_resources table
          try {
            const resourceUuid = await this.getResourceUuid(resource.path);
            
            updatePromises.push(
              this.resourceService.updateResourceImportance({
                sessionUuid: this.sessionId,
                resourceUuid,
                importanceScore: resource.importance
              })
            );
            
            updatePromises.push(
              this.resourceService.setResourceIncludedInContext({
                sessionUuid: this.sessionId,
                resourceUuid,
                included: true
              })
            );
          } catch (error) {
            this.logger.error(`Error updating resource metadata for ${resource.path}:`, error);
          }
        }
      }
      
      // Wait for all database updates to complete
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
      
      return selectedResources;
    });
  }
}
```

### 5. ResourceLogger

Provides structured logging with configurable log levels and operation timing for diagnostics and performance monitoring.

**Key Implementation Points:**

```typescript
export class ResourceLogger {
  private componentName: string;
  
  constructor(componentName: string) {
    this.componentName = componentName;
  }
  
  debug(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.debug(
        formatLogMessage(this.componentName, message),
        ...args
      );
    }
  }
  
  // Other log methods (info, warn, error) omitted for brevity
  
  async timeOperation<T>(
    operationName: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    this.debug(`Starting operation: ${operationName}`);
    
    try {
      const result = await operation();
      const duration = Math.round(performance.now() - startTime);
      this.debug(`Completed operation: ${operationName} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.error(`Failed operation: ${operationName} (${duration}ms)`, error);
      throw error;
    }
  }
}
```

## React Integration

The `useResourceTracking` hook provides a convenient way to incorporate resource tracking into React components:

```typescript
export function useResourceTracking(options: ResourceTrackingOptions = {}) {
  const {
    tokenBudget = 8000,
    sessionSummary = 'Resource tracking session',
    autoCleanup = true
  } = options;
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize session
  useEffect(() => {
    let mounted = true;
    
    const initSession = async () => {
      try {
        setIsLoading(true);
        const newSessionId = await createTrackingSession(tokenBudget, sessionSummary);
        
        if (mounted) {
          setSessionId(newSessionId);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(`Failed to create session: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    initSession();
    
    // Cleanup on unmount
    return () => {
      mounted = false;
      
      if (autoCleanup && sessionId) {
        cleanupTrackingSession(sessionId).catch(console.error);
      }
    };
  }, [tokenBudget, sessionSummary, autoCleanup]);
  
  // Other methods (trackAccess, prioritizeResources, etc.) omitted for brevity
  
  return {
    sessionId,
    resources,
    isLoading,
    error,
    trackAccess,
    prioritizeResources,
    getContextInfo
  };
}
```

## Feedback-Driven Testing

The feedback-driven testing system simulates different user behaviors and evaluates prioritization algorithms:

```javascript
async function runTestSession(sessionId, tokenBudget, algorithm) {
  console.log(`\n*** Starting test session ${sessionId} with ${tokenBudget} token budget and '${algorithm}' algorithm ***\n`);
  
  // Initialize the runner
  const runner = new ResourcePrioritizationRunner(sessionId);
  
  // Get all files in the project
  const files = await getAllFiles(CONFIG.PROJECTS_DIR);
  
  // Run simulated user behavior
  const stats = await simulateUserBehavior(runner, files, CONFIG.SESSION_DURATION_MS, algorithm);
  
  // Generate metrics report
  const report = await runner.generateMetricsReport();
  
  // Return results
  return {
    sessionId,
    tokenBudget,
    algorithm,
    uniqueFiles: stats.uniqueFilesCount,
    totalAccesses: stats.totalAccesses,
    viewCount: stats.viewCount,
    editCount: stats.editCount,
    referenceCount: stats.referenceCount,
    coverage: stats.coverage,
    timestamp: new Date().toISOString()
  };
}
```

## Highcharts-Based Visualization

The RogerThat dashboard provides interactive visualizations using Highcharts:

```tsx
const tokenGaugeOptions = {
  chart: {
    type: 'solidgauge',
    height: '200px',
  },
  title: {
    text: 'Token Budget Usage',
    style: { fontSize: '16px' }
  },
  pane: {
    startAngle: -90,
    endAngle: 90,
    background: {
      backgroundColor: '#EEE',
      innerRadius: '60%',
      outerRadius: '100%',
      shape: 'arc'
    }
  },
  yAxis: {
    min: 0,
    max: tokenBudget,
    stops: [
      [0.1, '#55BF3B'], // green
      [0.5, '#DDDF0D'], // yellow
      [0.9, '#DF5353']  // red
    ],
    lineWidth: 0,
    minorTickInterval: null,
    tickAmount: 2
  },
  series: [{
    name: 'Tokens Used',
    data: [tokenUsage],
    dataLabels: {
      format: '<div style="text-align:center"><span style="font-size:1.25rem">{y}</span><br/>' +
        '<span style="font-size:0.75rem;opacity:0.6">of {max} tokens</span></div>'
    }
  }]
};
```

## Token Efficiency Analysis

The token efficiency analyzer evaluates different algorithms and token budgets:

```javascript
function calculateMetrics(results) {
  // Group results by algorithm
  const byAlgorithm = {};
  for (const result of results) {
    const { algorithm } = result;
    if (!byAlgorithm[algorithm]) {
      byAlgorithm[algorithm] = [];
    }
    byAlgorithm[algorithm].push(result);
  }
  
  // Calculate metrics for each algorithm
  const algorithmMetrics = {};
  for (const [algorithm, algResults] of Object.entries(byAlgorithm)) {
    algorithmMetrics[algorithm] = {
      coverage: calculateAverage(algResults, 'coverage'),
      uniqueFiles: calculateAverage(algResults, 'uniqueFiles'),
      totalAccesses: calculateAverage(algResults, 'totalAccesses'),
      editRatio: calculateAverage(algResults, result => result.editCount / result.totalAccesses * 100),
      viewRatio: calculateAverage(algResults, result => result.viewCount / result.totalAccesses * 100),
      referenceRatio: calculateAverage(algResults, result => result.referenceCount / result.totalAccesses * 100),
    };
  }
  
  // Other metric calculations (by budget, combined) omitted for brevity
  
  return {
    byAlgorithm: algorithmMetrics,
    byBudget: budgetMetrics,
    combined: combinedMetrics
  };
}
```

## Next Steps

Based on the implementation and testing work completed, the following steps should be prioritized:

1. **Integration Testing**: Test the integration with actual LLM systems to measure real-world context effectiveness

2. **Semantic Relevance Enhancements**: Add semantic similarity to importance scoring using embeddings

3. **Adaptive Algorithm Selection**: Implement automatic algorithm selection based on session characteristics

4. **File Relationship Analysis**: Add tracking of file relationships to identify related resources

5. **User Feedback Collection**: Implement mechanisms to collect and incorporate user feedback

## Best Practices

The RogerThat implementation follows these best practices:

1. **Error Handling**: Comprehensive error handling throughout the codebase

2. **Asynchronous Operation Management**: Careful tracking of pending operations

3. **Performance Optimization**: Caching and efficient database interactions

4. **Testability**: Clean separation of concerns for easier testing

5. **Logging**: Structured logging with configurable levels

6. **Feedback-Driven**: Built-in mechanisms to gather data for continuous improvement
