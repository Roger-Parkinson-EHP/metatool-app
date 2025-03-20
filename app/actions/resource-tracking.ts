/**
 * Resource Tracking Actions
 * 
 * Server actions for resource tracking and prioritization functionality.
 * These actions integrate the ResourcePrioritizationRunner with the MetaMCP application.
 */

'use server';

import { ResourcePrioritizationRunner } from '../../lib/resource-tracking/ResourcePrioritizationRunner';
import { ResourceType, AccessType } from '../../lib/resource-tracking/ResourceTracker';
import path from 'path';

// Cache of active runners by session ID
const runners = new Map<string, ResourcePrioritizationRunner>();

/**
 * Get or create a ResourcePrioritizationRunner for a session
 */
function getRunner(sessionId: string): ResourcePrioritizationRunner {
  if (!runners.has(sessionId)) {
    runners.set(sessionId, new ResourcePrioritizationRunner(sessionId));
  }
  return runners.get(sessionId)!;
}

/**
 * Create a new resource tracking session
 */
export async function createTrackingSession(tokenBudget: number, summary?: string): Promise<string> {
  const sessionId = await ResourcePrioritizationRunner.createSession(tokenBudget, summary);
  runners.set(sessionId, new ResourcePrioritizationRunner(sessionId));
  return sessionId;
}

/**
 * Track resource access event
 */
export async function trackResourceAccess(
  sessionId: string,
  filePath: string,
  accessType: 'view' | 'edit' | 'execute' | 'reference',
  metadata: { size?: number; modified?: boolean } = {}
): Promise<void> {
  const runner = getRunner(sessionId);
  
  // Convert string access type to enum
  let accessTypeEnum: AccessType;
  switch (accessType) {
    case 'view': accessTypeEnum = AccessType.VIEW; break;
    case 'edit': accessTypeEnum = AccessType.EDIT; break;
    case 'execute': accessTypeEnum = AccessType.EXECUTE; break;
    case 'reference': accessTypeEnum = AccessType.REFERENCE; break;
    default: accessTypeEnum = AccessType.VIEW;
  }
  
  // Determine resource type from file extension
  const resourceType = getResourceTypeFromPath(filePath);
  
  // Track the access
  runner.trackResourceAccess(filePath, resourceType, accessTypeEnum, metadata);
  
  // Ensure any pending operations are completed
  await runner.waitForPendingOperations();
}

/**
 * Prioritize resources for context
 */
export async function prioritizeResourcesForContext(
  sessionId: string,
  tokenBudget: number
): Promise<string[]> {
  const runner = getRunner(sessionId);
  return runner.prioritizeResourcesForContext(tokenBudget);
}

/**
 * Generate a metrics report for a session
 */
export async function generateMetricsReport(sessionId: string): Promise<string> {
  const runner = getRunner(sessionId);
  return runner.generateMetricsReport();
}

/**
 * Clean up the runner for a session
 */
export async function cleanupTrackingSession(sessionId: string): Promise<void> {
  const runner = runners.get(sessionId);
  if (runner) {
    await runner.dispose();
    runners.delete(sessionId);
  }
}

/**
 * Count tokens in text
 */
export async function countTokens(text: string, modelName?: string): Promise<number> {
  // Create a temporary runner for token counting
  // This is inefficient but allows token counting without a session
  const tempRunner = new ResourcePrioritizationRunner('temp-session');
  const result = tempRunner.countTokens(text, modelName);
  await tempRunner.dispose();
  return result;
}

/**
 * Helper to determine resource type from file path
 */
function getResourceTypeFromPath(filePath: string): ResourceType {
  const ext = path.extname(filePath).toLowerCase();
  
  // Code files
  const codeExts = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', 
    '.go', '.rb', '.php', '.swift', '.html', '.css', '.scss', '.sql'
  ];
  
  // Documentation files
  const docExts = [
    '.md', '.txt', '.pdf', '.rst', '.adoc', '.docx', '.pptx', '.odt'
  ];
  
  // Data files
  const dataExts = [
    '.json', '.csv', '.xml', '.yaml', '.yml', '.toml', '.ini', 
    '.xls', '.xlsx', '.db', '.sqlite'
  ];
  
  // Research files
  const researchExts = [
    '.bib', '.tex', '.ipynb', '.r', '.rmd', '.dat', '.mat'
  ];
  
  if (codeExts.includes(ext)) return ResourceType.CODE;
  if (docExts.includes(ext)) return ResourceType.DOCUMENTATION;
  if (dataExts.includes(ext)) return ResourceType.DATA;
  if (researchExts.includes(ext)) return ResourceType.RESEARCH;
  
  // Default to documentation
  return ResourceType.DOCUMENTATION;
}
