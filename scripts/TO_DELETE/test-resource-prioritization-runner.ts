/**
 * Integration test for ResourcePrioritizationRunner
 * 
 * This script tests the ResourcePrioritizationRunner in a simulated environment
 * with real file access patterns to validate its behavior.
 */

import fs from 'fs/promises';
import path from 'path';
import { ResourcePrioritizationRunner } from '../lib/resource-tracking/ResourcePrioritizationRunner';
import { ResourceType, AccessType } from '../lib/resource-tracking/ResourceTracker';

/**
 * Run the test scenario
 */
async function runTest() {
  console.log('Testing ResourcePrioritizationRunner...');
  
  // Create a test session
  const sessionId = await ResourcePrioritizationRunner.createSession(8000, 'Test session');
  console.log(`Created test session with ID: ${sessionId}`);
  
  // Initialize runner
  const runner = new ResourcePrioritizationRunner(sessionId);
  
  // Simulate a development workflow with file access events
  console.log('\nSimulating resource access events...');
  
  // Initial exploration phase
  await simulateResourceAccess(runner, '/project/src/main.ts', ResourceType.CODE, AccessType.VIEW, { size: 1024 });
  await simulateResourceAccess(runner, '/project/docs/api.md', ResourceType.DOCUMENTATION, AccessType.VIEW, { size: 5120 });
  await simulateResourceAccess(runner, '/project/src/utils.ts', ResourceType.CODE, AccessType.VIEW, { size: 2048 });
  
  // Development phase - editing main file
  await simulateResourceAccess(runner, '/project/src/main.ts', ResourceType.CODE, AccessType.EDIT, { size: 1100, modified: true });
  await simulateResourceAccess(runner, '/project/docs/api.md', ResourceType.DOCUMENTATION, AccessType.VIEW, { size: 5120 });
  
  // Adding new components
  await simulateResourceAccess(runner, '/project/src/components/Button.tsx', ResourceType.CODE, AccessType.VIEW, { size: 3072 });
  await simulateResourceAccess(runner, '/project/data/config.json', ResourceType.DATA, AccessType.VIEW, { size: 512 });
  
  // Final edits before commit
  await simulateResourceAccess(runner, '/project/src/main.ts', ResourceType.CODE, AccessType.EDIT, { size: 1200, modified: true });
  await simulateResourceAccess(runner, '/project/src/components/Button.tsx', ResourceType.CODE, AccessType.EDIT, { size: 3100, modified: true });
  
  // Prioritize for different token budgets
  await testPrioritization(runner, 2000);
  await testPrioritization(runner, 5000);
  await testPrioritization(runner, 10000);
  
  // Generate and save metrics report
  const report = await runner.generateMetricsReport();
  const reportPath = path.join(__dirname, `resource-test-${sessionId}.md`);
  await fs.writeFile(reportPath, report);
  
  console.log(`\nTest complete! Report saved to: ${reportPath}`);
}

/**
 * Simulate resource access with a small delay
 */
async function simulateResourceAccess(
  runner: ResourcePrioritizationRunner,
  path: string,
  type: ResourceType,
  accessType: AccessType,
  metadata: { size?: number; modified?: boolean } = {}
): Promise<void> {
  console.log(`- Accessing ${path} (${accessType})`);
  runner.trackResourceAccess(path, type, accessType, metadata);
  
  // Small delay to simulate time passing between accesses
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Test prioritization with different token budgets
 */
async function testPrioritization(runner: ResourcePrioritizationRunner, budget: number): Promise<void> {
  console.log(`\nPrioritizing resources for ${budget} token budget...`);
  const resources = await runner.prioritizeResourcesForContext(budget);
  
  console.log(`Selected ${resources.length} resources within budget:`);
  for (const path of resources) {
    const importance = runner.getResourceImportance(path);
    console.log(`- ${path} (importance: ${importance})`);
  }
}

// Run the test and handle any errors
runTest().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
