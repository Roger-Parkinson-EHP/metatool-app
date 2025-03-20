/**
 * Test Priority Strategies
 * 
 * This script tests different resource prioritization strategies
 * and provides feedback on their effectiveness for different workflows.
 */

const { ResourceTracker, AccessType, ResourceType } = require('../lib/resource-tracking/ResourceTracker');
const { TokenCounter } = require('../lib/token-counting/TokenCounter');

// Define test scenarios
const scenarios = [
  {
    name: 'development',
    description: 'Development workflow with coding and documentation',
    resources: [
      { path: '/project/src/main.ts', type: 'CODE', content: 'export function main() {}', size: 1024 },
      { path: '/project/src/utils.ts', type: 'CODE', content: 'export function format() {}', size: 2048 },
      { path: '/project/docs/api.md', type: 'DOCUMENTATION', content: '# API', size: 5120 },
      { path: '/project/src/components/Button.tsx', type: 'CODE', content: 'export const Button = () => {}', size: 3072 },
      { path: '/project/data/config.json', type: 'DATA', content: '{ "api": "" }', size: 512 }
    ],
    accessEvents: [
      { path: '/project/src/main.ts', type: 'VIEW', minutesAgo: 180 },
      { path: '/project/docs/api.md', type: 'VIEW', minutesAgo: 180 },
      { path: '/project/src/utils.ts', type: 'VIEW', minutesAgo: 120 },
      { path: '/project/src/components/Button.tsx', type: 'VIEW', minutesAgo: 120 },
      { path: '/project/data/config.json', type: 'VIEW', minutesAgo: 120 },
      { path: '/project/src/main.ts', type: 'EDIT', minutesAgo: 60 },
      { path: '/project/src/utils.ts', type: 'EDIT', minutesAgo: 60 },
      { path: '/project/src/components/Button.tsx', type: 'VIEW', minutesAgo: 60 },
      { path: '/project/docs/api.md', type: 'VIEW', minutesAgo: 60 },
      { path: '/project/src/main.ts', type: 'EDIT', minutesAgo: 5 },
      { path: '/project/src/components/Button.tsx', type: 'EDIT', minutesAgo: 0 }
    ]
  },
  {
    name: 'research',
    description: 'Research workflow with papers and data analysis',
    resources: [
      { path: '/research/papers/paper1.md', type: 'RESEARCH', content: '# Research Paper 1', size: 10240 },
      { path: '/research/papers/paper2.md', type: 'RESEARCH', content: '# Research Paper 2', size: 8192 },
      { path: '/research/data/results.csv', type: 'DATA', content: 'id,value\n1,100', size: 4096 },
      { path: '/research/notes/summary.md', type: 'DOCUMENTATION', content: '# Summary', size: 2048 },
      { path: '/research/code/analysis.py', type: 'CODE', content: 'def analyze():\n    pass', size: 3072 }
    ],
    accessEvents: [
      { path: '/research/papers/paper1.md', type: 'VIEW', minutesAgo: 180 },
      { path: '/research/papers/paper2.md', type: 'VIEW', minutesAgo: 180 },
      { path: '/research/data/results.csv', type: 'VIEW', minutesAgo: 120 },
      { path: '/research/code/analysis.py', type: 'VIEW', minutesAgo: 120 },
      { path: '/research/notes/summary.md', type: 'EDIT', minutesAgo: 120 },
      { path: '/research/papers/paper1.md', type: 'REFERENCE', minutesAgo: 60 },
      { path: '/research/code/analysis.py', type: 'EDIT', minutesAgo: 60 },
      { path: '/research/data/results.csv', type: 'REFERENCE', minutesAgo: 60 },
      { path: '/research/notes/summary.md', type: 'EDIT', minutesAgo: 5 },
      { path: '/research/code/analysis.py', type: 'EXECUTE', minutesAgo: 0 }
    ]
  }
];

// Define priority strategies
const strategies = [
  {
    name: 'recency',
    description: 'Prioritize most recently accessed',
    prioritize: (resources, tokenBudget) => {
      return resources
        .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
        .slice(0, Math.ceil(tokenBudget / 1000))
        .map(r => r.path);
    }
  },
  {
    name: 'frequency',
    description: 'Prioritize most frequently accessed',
    prioritize: (resources, tokenBudget) => {
      return resources
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, Math.ceil(tokenBudget / 1000))
        .map(r => r.path);
    }
  },
  {
    name: 'modified',
    description: 'Prioritize recently modified resources',
    prioritize: (resources, tokenBudget) => {
      return resources
        .sort((a, b) => {
          if (a.modified !== b.modified) return a.modified ? -1 : 1;
          return b.lastAccessed.getTime() - a.lastAccessed.getTime();
        })
        .slice(0, Math.ceil(tokenBudget / 1000))
        .map(r => r.path);
    }
  },
  {
    name: 'hybrid',
    description: 'Balanced approach considering multiple factors',
    prioritize: (resources, tokenBudget) => {
      const nowTime = Date.now();
      const scored = resources.map(resource => {
        // Recency score (0-50 points)
        const hoursSinceAccess = (nowTime - resource.lastAccessed.getTime()) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 50 - (hoursSinceAccess * 10)); 
        
        // Frequency score (0-30 points)
        const frequencyScore = Math.min(30, resource.accessCount * 2);
        
        // Modification bonus (20 points)
        const modificationScore = resource.modified ? 20 : 0;
        
        // Total score
        const score = recencyScore + frequencyScore + modificationScore;
        
        return { ...resource, score };
      });
      
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.ceil(tokenBudget / 1000))
        .map(r => r.path);
    }
  }
];

// Run a test scenario with all strategies
async function runScenario(scenario) {
  console.log(`\n== Running ${scenario.name} scenario ==`);
  console.log(scenario.description);
  console.log(`Resources: ${scenario.resources.length}`);
  console.log(`Access events: ${scenario.accessEvents.length}`);
  
  const results = [];
  
  // For each strategy
  for (const strategy of strategies) {
    // Set up tracker
    const tracker = new ResourceTracker();
    const tokenCounter = new TokenCounter();
    
    // Register resources
    for (const resource of scenario.resources) {
      tracker.trackAccess(
        resource.path,
        resource.type,
        AccessType.VIEW,
        { size: resource.size }
      );
    }
    
    // Simulate access sequence
    const now = new Date();
    for (const event of scenario.accessEvents) {
      const timestamp = new Date(now.getTime() - event.minutesAgo * 60 * 1000);
      const originalNow = Date.now;
      global.Date.now = () => timestamp.getTime();
      
      tracker.trackAccess(
        event.path,
        scenario.resources.find(r => r.path === event.path).type,
        event.type,
        { modified: event.type === 'EDIT' }
      );
      
      global.Date.now = originalNow;
    }
    
    // Apply prioritization strategy
    const tokenBudget = 3000; // Typical context size
    const resources = tracker.getAllResources();
    const prioritized = strategy.prioritize(resources, tokenBudget);
    
    // Calculate token usage
    let totalTokens = 0;
    const prioritizedResources = [];
    
    for (const path of prioritized) {
      const resource = scenario.resources.find(r => r.path === path);
      const tokens = tokenCounter.countTokens(resource.content);
      prioritizedResources.push({
        path: resource.path,
        type: resource.type,
        tokens: tokens,
        importance: tracker.getResourceImportance(resource.path)
      });
      totalTokens += tokens;
    }
    
    results.push({
      strategy: strategy.name,
      resources: prioritizedResources,
      totalTokens: totalTokens,
      utilization: totalTokens / tokenBudget
    });
  }
  
  // Print results
  console.log('\nStrategy Results:');
  console.log('-----------------');
  
  for (const result of results) {
    console.log(`\n${result.strategy} (${Math.round(result.utilization * 100)}% utilization)`);
    console.log('Prioritized resources:');
    for (const resource of result.resources) {
      console.log(`- ${resource.path} (${resource.type}, ${resource.tokens} tokens, importance: ${resource.importance})`);
    }
  }
  
  return results;
}

// Run all scenarios
async function runTests() {
  const allResults = {};
  
  for (const scenario of scenarios) {
    allResults[scenario.name] = await runScenario(scenario);
  }
  
  // Print summary
  console.log('\n=== Overall Results ===');
  
  for (const scenarioName in allResults) {
    console.log(`\n${scenarioName} scenario:`);
    console.log('Strategy   | Resources | Token Usage | Utilization');
    console.log('----------|-----------|-------------|------------');
    
    for (const result of allResults[scenarioName]) {
      console.log(
        `${result.strategy.padEnd(10)} | ` +
        `${result.resources.length.toString().padEnd(9)} | ` +
        `${result.totalTokens.toString().padEnd(11)} | ` +
        `${Math.round(result.utilization * 100)}%`
      );
    }
  }
  
  // Provide feedback on strategies
  console.log('\n=== Strategy Recommendations ===');
  
  for (const scenarioName in allResults) {
    console.log(`\nFor ${scenarioName} workflows:`);
    const results = allResults[scenarioName];
    
    // Sort by utilization (most efficient first)
    results.sort((a, b) => b.utilization - a.utilization);
    
    console.log(`Best strategy: ${results[0].strategy} (${Math.round(results[0].utilization * 100)}% utilization)`);
    console.log('Key resources included:');
    results[0].resources.slice(0, 3).forEach(r => console.log(`- ${r.path}`));
  }
}

// Run the tests
runTests().catch(console.error);
