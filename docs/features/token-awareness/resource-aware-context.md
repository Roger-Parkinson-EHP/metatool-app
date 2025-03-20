# Resource-Aware Context Management

## Overview

Resource-aware context management extends MetaMCP's token awareness capabilities by intelligently tracking, prioritizing, and managing resources that are crucial to a user's workflow. This feature ensures optimal token utilization while preserving the most valuable resources across sessions.

## Core Concept

The fundamental idea is simple: track which resources (files, documentation, data) are being used during a session, measure their importance based on usage patterns, and prioritize the most valuable ones when token limits are reached.

## Starting Simple

Rather than implementing a complex system upfront, we take a pragmatic approach:

1. **Track what's used**: Monitor which files are accessed, when, and how often
2. **Measure tokens**: Count tokens for different resource types to understand consumption
3. **Prioritize simply**: Start with basic heuristics like recency and frequency
4. **Compress gradually**: Begin with simple compression techniques that preserve meaning

## Basic Resource Tracking

The initial implementation focuses on core functionality:

```typescript
interface ResourceTracker {
  // Record an access to a resource
  trackAccess(path: string, accessType: 'view' | 'edit' | 'execute' | 'reference'): void;
  
  // Get access statistics for a resource
  getAccessStats(path: string): {
    accessCount: number;
    lastAccessed: Date;
    accessTypes: Set<string>;
  };
  
  // Get most frequently accessed resources
  getMostFrequentResources(limit: number): Array<{
    path: string;
    accessCount: number;
  }>;
  
  // Get most recently accessed resources
  getMostRecentResources(limit: number): Array<{
    path: string;
    lastAccessed: Date;
  }>;
}
```

## Simple Token Counting

To manage tokens effectively, we need accurate counting:

```typescript
interface TokenCounter {
  // Count tokens in text using model-specific tokenizer
  countTokens(text: string, modelName?: string): number;
  
  // Estimate tokens for a file based on its content
  countFileTokens(filePath: string): Promise<number>;
  
  // Check if content fits within budget
  fitsInBudget(content: string, budget: number): boolean;
}
```

## Basic Prioritization

Initial prioritization uses straightforward heuristics:

```typescript
function prioritizeResources(resources: Array<Resource>, tracker: ResourceTracker): Array<Resource> {
  return resources
    .map(resource => {
      const stats = tracker.getAccessStats(resource.path);
      
      // Simple scoring based on recency and frequency
      const recencyScore = stats.lastAccessed
        ? (Date.now() - stats.lastAccessed.getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      
      const frequencyScore = stats.accessCount || 0;
      
      const modifiedScore = stats.accessTypes.has('edit') ? 5 : 0;
      
      // Combined importance score
      const importance = 
        (10 - Math.min(recencyScore, 10)) * 2 + // Recency (0-20 points)
        Math.min(frequencyScore, 10) * 1.5 +    // Frequency (0-15 points)
        modifiedScore;                          // Modified bonus (0 or 5 points)
      
      return {
        ...resource,
        importance
      };
    })
    .sort((a, b) => b.importance - a.importance);
}
```

## Simple Compression Strategies

Start with basic compression techniques:

```typescript
interface CompressionStrategy {
  // Compress content to fit within token budget
  compress(content: string, targetTokens: number): string;
  
  // Estimate how well meaning is preserved
  preservationQuality(): number; // 0-1 scale
}

// Example strategies:

class WhitespaceCompression implements CompressionStrategy {
  compress(content: string, targetTokens: number): string {
    // Remove excess whitespace, normalize indentation
    return content
      .replace(/\s+/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n\s+/g, '\n');
  }
  
  preservationQuality(): number {
    return 0.95; // Very high preservation
  }
}

class CommentRemoval implements CompressionStrategy {
  compress(content: string, targetTokens: number): string {
    // Remove comments while preserving structure
    // Implementation depends on file type
    return content
      .replace(/\/\/[^\n]*/g, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
  }
  
  preservationQuality(): number {
    return 0.8; // Good preservation
  }
}

class TruncationStrategy implements CompressionStrategy {
  compress(content: string, targetTokens: number): string {
    const tokenCounter = new TokenCounter();
    const currentTokens = tokenCounter.countTokens(content);
    
    if (currentTokens <= targetTokens) {
      return content;
    }
    
    // Simple truncation with indicator
    const ratio = targetTokens / currentTokens;
    const keepChars = Math.floor(content.length * ratio);
    
    return content.substring(0, keepChars) + "\n\n[Content truncated to fit token limit]";
  }
  
  preservationQuality(): number {
    return 0.6; // Moderate preservation
  }
}
```

## Measurement-Driven Refinement

The key to improvement is measuring actual performance:

```typescript
interface PerformanceMetrics {
  // Track token usage
  tokenUsage: {
    total: number;
    byResourceType: Record<string, number>;
    utilization: number; // percentage of budget used
  };
  
  // Track resource selection
  resourceSelection: {
    totalResources: number;
    includedResources: number;
    inclusionRate: number;
  };
  
  // Track compression
  compression: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    estimatedPreservation: number;
  };
}

function recordMetrics(session: Session, metrics: PerformanceMetrics): void {
  // Store metrics for analysis
  const metricsJson = JSON.stringify(metrics, null, 2);
  fs.writeFileSync(`./metrics/${session.id}.json`, metricsJson);
}
```

## Feedback Loops

Set up simple feedback mechanisms to improve over time:

```typescript
function adjustStrategyWeights(metrics: PerformanceMetrics[]): {
  recencyWeight: number;
  frequencyWeight: number;
  modificationWeight: number;
} {
  // Calculate strategy effectiveness
  const effectivenessScores = metrics.map(m => {
    // Higher is better
    return m.tokenUsage.utilization * m.compression.estimatedPreservation;
  });
  
  // Adjust weights based on effectiveness
  // This is a simple example - real implementation would be more sophisticated
  return {
    recencyWeight: effectivenessScores.length > 0 ? 2 + Math.random() : 2,
    frequencyWeight: effectivenessScores.length > 0 ? 1.5 + Math.random() : 1.5,
    modificationWeight: effectivenessScores.length > 0 ? 5 + Math.random() : 5,
  };
}
```

## Integration with Existing Systems

Integrate with existing components in simple ways:

```typescript
// Hook into file access events
editor.on('fileOpen', (path) => {
  resourceTracker.trackAccess(path, 'view');
});

editor.on('fileSave', (path) => {
  resourceTracker.trackAccess(path, 'edit');
});

// Hook into token counting
context.on('tokenLimitWarning', (remaining) => {
  const prioritizedResources = prioritizeResources(currentResources, resourceTracker);
  const selectedResources = selectResourcesForTokenBudget(prioritizedResources, remaining);
  displayResourceUsage(selectedResources, remaining);
});
```

## Database Schema

Start with a minimal schema that captures essential information:

```sql
-- Track resources
CREATE TABLE resources (
  id UUID PRIMARY KEY,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  last_accessed TIMESTAMP WITH TIME ZONE NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  modified_during_session BOOLEAN NOT NULL DEFAULT FALSE,
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Track resource access
CREATE TABLE resource_access_logs (
  id UUID PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES resources(id),
  access_type TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Track sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  token_count INTEGER NOT NULL
);

-- Link sessions and resources
CREATE TABLE session_resources (
  session_id UUID NOT NULL REFERENCES sessions(id),
  resource_id UUID NOT NULL REFERENCES resources(id),
  importance_score FLOAT NOT NULL,
  included_in_context BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (session_id, resource_id)
);
```

## Testing Framework

Create a simple testing system focused on real-world scenarios:

```typescript
async function testResourcePrioritization(scenario: string, resources: Resource[]): Promise<TestResult> {
  // Set up test environment
  const tracker = new ResourceTracker();
  const tokenCounter = new TokenCounter();
  
  // Simulate resource access based on scenario
  await simulateResourceAccess(scenario, resources, tracker);
  
  // Prioritize resources
  const prioritized = prioritizeResources(resources, tracker);
  
  // Allocate token budget
  const budget = 8000; // Example budget
  const selectedResources = selectResourcesForTokenBudget(prioritized, budget, tokenCounter);
  
  // Measure results
  const metrics = calculateMetrics(resources, selectedResources, budget, tokenCounter);
  
  return {
    scenario,
    metrics,
    selectedResources
  };
}

// Run a simple test battery
async function runTests(): Promise<void> {
  const scenarios = ['development', 'research', 'documentation'];
  const results = [];
  
  for (const scenario of scenarios) {
    const resources = await loadTestResources(scenario);
    results.push(await testResourcePrioritization(scenario, resources));
  }
  
  // Generate report
  generateTestReport(results);
}
```

## Iterative Deployment

Implement the system in stages:

1. **Stage 1**: Basic tracking and measurement
   - Track file access
   - Count tokens
   - Collect baseline metrics

2. **Stage 2**: Simple prioritization
   - Rank by recency and frequency
   - Apply basic compression
   - Measure effectiveness

3. **Stage 3**: Feedback integration
   - Adjust weights based on results
   - Refine compression strategies
   - Expand to more resource types

4. **Stage 4**: User experience
   - Add visualization
   - Provide manual controls
   - Collect user feedback

## Conclusion

Resource-aware context management doesn't need to be complex to be effective. By starting with simple tracking, measurement, and prioritization, we can build a system that delivers real value immediately while setting the foundation for more sophisticated capabilities in the future.

The key is a pragmatic approach focused on real-world usage patterns, continuous measurement, and iterative improvement based on actual performance data. This ensures that we build only what adds value and that every feature is grounded in observed needs rather than theoretical assumptions.
