# RogerThat Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the RogerThat token management system. The testing approach is designed to be feedback-driven, with test results automatically feeding back into the system to improve prioritization algorithms and token efficiency.

## Testing Philosophy

The RogerThat testing philosophy is built around these core principles:

1. **Data-Driven Decisions**: All algorithm improvements must be backed by measurable performance improvements
2. **Realistic Simulation**: Tests should simulate real user behaviors, not synthetic ideals
3. **Continuous Feedback**: Test results should automatically feed back into the system
4. **Comprehensive Coverage**: Tests should cover unit, integration, and system levels
5. **Military Precision**: Tests should be systematic, reproducible, and reliable

## Testing Levels

### Level 1: Unit Testing

Unit tests focus on individual components to ensure they function correctly in isolation:

#### ResourceTracker Tests

- Test tracking of resource access events
- Test importance score calculation
- Test prioritization of resources
- Test event emission

#### TokenCounter Tests

- Test token counting for different content types
- Test estimation of file token counts
- Test caching behavior
- Test different tokenizer models

#### ResourceService Tests

- Test database operations
- Test resource creation and update
- Test access logging
- Test session management

#### ResourcePrioritizationRunner Tests

- Test coordination of components
- Test resource prioritization within token budgets
- Test metrics generation
- Test error handling

### Level 2: Integration Testing

Integration tests verify that components work together correctly:

#### Component Integration Tests

- Test ResourceTracker + TokenCounter
- Test ResourceService + Database
- Test ResourcePrioritizationRunner + all components

#### React Hook Integration Tests

- Test useResourceTracking hook
- Test React component integration
- Test UI updates based on state changes

### Level 3: System Testing

System tests evaluate the entire system under realistic conditions:

#### Simulation Tests

- Test different user behavior patterns
- Test different prioritization algorithms
- Test different token budgets

#### Performance Tests

- Test token efficiency metrics
- Test system responsiveness under load
- Test database performance with many resources

## Testing Tools

### Automated Test Scripts

#### feedback-driven-testing.js

This script simulates different user behaviors and collects performance metrics:

```javascript
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('ROGERTHAT FEEDBACK-DRIVEN TESTING');
    console.log('='.repeat(80));
    
    await ensureDirectories();
    
    console.log('\nRunning automated feedback tests...');
    const results = await runAllTests();
    
    // Save raw results
    const resultsPath = path.join(CONFIG.RESULT_DIR, CONFIG.FEEDBACK_FILE);
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    
    // Generate and save feedback report
    const report = await generateFeedbackReport(results);
    const reportPath = path.join(CONFIG.RESULT_DIR, 'feedback-report.md');
    await fs.writeFile(reportPath, report);
    
    console.log('\nAll tests completed successfully!');
  } catch (err) {
    console.error('Error running tests:', err);
  }
}
```

#### analyze-token-efficiency.js

This script analyzes test results to identify the most effective strategies:

```javascript
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('ROGERTHAT TOKEN EFFICIENCY ANALYSIS');
    console.log('='.repeat(80));
    
    await ensureDirectories();
    
    console.log('\nLoading test results...');
    const results = await loadTestResults();
    
    if (results.length === 0) {
      console.error('No test results found. Please run feedback-driven-testing.js first.');
      return;
    }
    
    console.log(`Loaded ${results.length} test results.`);
    
    console.log('\nCalculating metrics...');
    const metrics = calculateMetrics(results);
    
    console.log('\nGenerating chart data...');
    const chartData = generateChartData(metrics);
    
    // Save chart data for visualization
    const chartDataPath = path.join(CONFIG.REPORT_DIR, CONFIG.CHART_DATA_FILE);
    await fs.writeFile(chartDataPath, JSON.stringify(chartData, null, 2));
    
    console.log('\nGenerating analysis report...');
    const report = await generateAnalysisReport(results, metrics);
    
    // Save the report
    const reportPath = path.join(CONFIG.REPORT_DIR, CONFIG.ANALYSIS_FILE);
    await fs.writeFile(reportPath, report);
  } catch (err) {
    console.error('Error running analysis:', err);
  }
}
```

### Jest Testing Framework

Jest is used for unit and integration tests:

```typescript
describe('ResourceTracker', () => {
  let tracker: ResourceTracker;
  const sessionId = 'test-session-id';

  beforeEach(() => {
    tracker = new ResourceTracker();
    tracker.setSessionId(sessionId);
  });

  describe('Basic tracking functionality', () => {
    it('should track a resource access', () => {
      const path = '/project/src/main.ts';
      const type = ResourceType.CODE;
      const accessType = AccessType.VIEW;
      const metadata = { size: 1024 };

      tracker.trackAccess(path, type, accessType, metadata);

      const stats = tracker.getResourceStats(path);
      expect(stats).toBeDefined();
      expect(stats?.path).toBe(path);
      expect(stats?.type).toBe(type);
      expect(stats?.accessCount).toBe(1);
      expect(stats?.accessTypes.has(accessType)).toBe(true);
      expect(stats?.size).toBe(1024);
      expect(stats?.modified).toBe(false);
    });
  });
});
```

## Testing Scenarios

### Scenario 1: Development Workflow

Simulates a developer working on code files:

```javascript
function simulateDevelopmentWorkflow(runner, files, durationMs) {
  // Configuration
  const config = {
    codeFiles: files.filter(f => f.endsWith('.ts') || f.endsWith('.js')),
    docFiles: files.filter(f => f.endsWith('.md') || f.endsWith('.txt')),
    viewProbability: 0.7,
    editProbability: 0.25,
    referenceProbability: 0.05,
    focusOnFewFiles: true
  };
  
  // Simulation implementation
  const startTime = Date.now();
  while (Date.now() - startTime < durationMs) {
    // Simulate development activities
  }
}
```

### Scenario 2: Research Workflow

Simulates a researcher working with documentation:

```javascript
function simulateResearchWorkflow(runner, files, durationMs) {
  // Configuration
  const config = {
    codeFiles: files.filter(f => f.endsWith('.ts') || f.endsWith('.js')),
    docFiles: files.filter(f => f.endsWith('.md') || f.endsWith('.txt')),
    viewProbability: 0.8,
    editProbability: 0.1,
    referenceProbability: 0.1,
    focusOnDocumentation: true
  };
  
  // Simulation implementation
  const startTime = Date.now();
  while (Date.now() - startTime < durationMs) {
    // Simulate research activities
  }
}
```

### Scenario 3: Combined Workflow

Simulates a user switching between development and research:

```javascript
function simulateCombinedWorkflow(runner, files, durationMs) {
  // Configuration
  const config = {
    codeFiles: files.filter(f => f.endsWith('.ts') || f.endsWith('.js')),
    docFiles: files.filter(f => f.endsWith('.md') || f.endsWith('.txt')),
    dataFiles: files.filter(f => f.endsWith('.json') || f.endsWith('.csv')),
    viewProbability: 0.6,
    editProbability: 0.2,
    referenceProbability: 0.2,
    workflowSwitching: true
  };
  
  // Simulation implementation
  const startTime = Date.now();
  let inDevelopmentMode = true;
  let modeSwitch = 5000; // Switch modes every 5 seconds
  
  while (Date.now() - startTime < durationMs) {
    const currentTime = Date.now() - startTime;
    
    // Switch modes periodically
    if (currentTime > modeSwitch) {
      inDevelopmentMode = !inDevelopmentMode;
      modeSwitch += 5000;
    }
    
    // Simulate different activities based on mode
  }
}
```

## Test Data Generation

### Resource Dataset Generation

The system includes utilities to generate realistic test data:

```typescript
export function createMockFileSystem() {
  const mockFiles: Record<string, { content: string; size: number; type: ResourceType }> = {
    '/project/src/main.ts': {
      content: 'export function main() { console.log("Hello, world!"); }',
      size: 1024,
      type: ResourceType.CODE
    },
    '/project/src/utils.ts': {
      content: 'export function formatDate(date: Date) { return date.toISOString(); }',
      size: 2048, 
      type: ResourceType.CODE
    },
    '/project/docs/api.md': {
      content: '# API Documentation\n\nThis document describes the API.',
      size: 5120,
      type: ResourceType.DOCUMENTATION
    },
    // More mock files...
  };

  return { mockFiles };
}
```

### Test Access Sequence Generation

```typescript
export function createTestAccessSequence() {
  return [
    { path: '/project/src/main.ts', type: ResourceType.CODE, accessType: AccessType.VIEW, metadata: { size: 1024 }, timestamp: new Date(Date.now() - 60 * 60 * 1000) }, // 1 hour ago
    { path: '/project/docs/api.md', type: ResourceType.DOCUMENTATION, accessType: AccessType.VIEW, metadata: { size: 5120 }, timestamp: new Date(Date.now() - 55 * 60 * 1000) },
    { path: '/project/src/utils.ts', type: ResourceType.CODE, accessType: AccessType.VIEW, metadata: { size: 2048 }, timestamp: new Date(Date.now() - 50 * 60 * 1000) },
    { path: '/project/src/main.ts', type: ResourceType.CODE, accessType: AccessType.EDIT, metadata: { size: 1100, modified: true }, timestamp: new Date(Date.now() - 40 * 60 * 1000) },
    // More access events...
  ];
}
```

## Performance Metrics

RogerThat measures key performance metrics for evaluation:

### 1. Context Coverage

Percentage of important resources included in the context:

```typescript
function calculateCoverage(includedResources, totalImportantResources) {
  return (includedResources / Math.min(totalImportantResources, uniqueFiles.size)) * 100;
}
```

### 2. Token Efficiency

Ratio of important content to token usage:

```typescript
function calculateTokenEfficiency(includedResourcesImportance, tokenBudget) {
  return includedResourcesImportance / tokenBudget * 100;
}
```

### 3. Algorithm Effectiveness

Comparing different prioritization algorithms:

```typescript
function compareAlgorithms(results) {
  const algorithmsByCoverage = Object.entries(metrics.byAlgorithm)
    .sort(([, a], [, b]) => b.coverage - a.coverage);
  
  return algorithmsByCoverage.map(([algorithm, metrics]) => ({
    algorithm,
    coverage: metrics.coverage,
    uniqueFiles: metrics.uniqueFiles,
    editRatio: metrics.editRatio,
    viewRatio: metrics.viewRatio,
    referenceRatio: metrics.referenceRatio
  }));
}
```

## Test Result Analysis

The token efficiency analyzer generates comprehensive reports on test results:

```javascript
async function generateAnalysisReport(results, metrics) {
  // Find best algorithm overall
  const algorithmsByCoverage = Object.entries(metrics.byAlgorithm)
    .sort(([, a], [, b]) => b.coverage - a.coverage);
  
  const bestAlgorithm = algorithmsByCoverage[0][0];
  const bestAlgorithmMetrics = algorithmsByCoverage[0][1];
  
  // Generate report sections
  const report = [
    '# RogerThat Token Efficiency Analysis',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Overview',
    '',
    `Analyzed ${results.length} test sessions with various token budgets and prioritization algorithms.`,
    '',
    '## Key Findings',
    '',
    `### 1. Best Overall Algorithm: ${bestAlgorithm}`,
    '',
    `The '${bestAlgorithm}' algorithm achieved the highest average context coverage at ${bestAlgorithmMetrics.coverage.toFixed(2)}%.`,
    ''
  ];
  
  // Additional report sections...
  
  return report.join('\n');
}
```

## Continuous Integration

Tests are integrated into the CI/CD pipeline to ensure consistent quality:

1. **Pull Request Validation**: Unit and integration tests run on every PR
2. **Nightly Tests**: Performance and system tests run nightly
3. **Scheduled Feedback Tests**: Feedback-driven tests run weekly

## Next Testing Steps

Based on the implementation completed so far, these are the prioritized testing tasks:

1. **Implement End-to-End Tests**: Test the complete workflow from resource tracking to LLM context generation

2. **Add Database Performance Tests**: Test the system with large numbers of resources

3. **Create Visualization Tests**: Test the Highcharts dashboard with different scenarios

4. **Set Up Continuous Testing Pipeline**: Automate the feedback-driven testing process

5. **Implement User Testing Framework**: Collect and analyze user feedback on prioritization effectiveness

## Testing FAQs

### Q: How often should we run the feedback-driven tests?

A: For active development, run daily. For stable systems, run weekly to detect any regressions.

### Q: How do we interpret the token efficiency results?

A: Look for algorithms that maximize context coverage while respecting token budgets. Higher coverage percentages with similar token usage indicate more efficient algorithms.

### Q: How do we validate algorithm improvements?

A: Any algorithm change must show at least a 5% improvement in context coverage or token efficiency metrics across multiple test scenarios to be approved.

### Q: What's the best way to simulate user behavior?

A: Use real access patterns from anonymized usage data when possible. When not available, create realistic scenarios based on known workflows.

## Conclusion

The RogerThat testing strategy emphasizes feedback-driven, data-oriented testing to ensure continuous improvement. By systematically testing different prioritization algorithms and token budgets, we can optimize the token management system for maximum effectiveness in real-world scenarios.
