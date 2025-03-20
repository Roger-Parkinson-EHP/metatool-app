/**
 * Resource Prioritization Runner
 * 
 * Coordinates resource tracking, token counting, and database operations for resource-aware token management.
 * Acts as the central coordinator for prioritizing resources within token budget constraints.
 */

import fs from 'fs/promises';
import path from 'path';
import { ResourceTracker, AccessType, ResourceType } from './ResourceTracker';
import { TokenCounter } from '../token-counting/TokenCounter';
import { ResourceService } from './ResourceService';

/**
 * Main class that coordinates resource prioritization for token-aware context management
 */
export class ResourcePrioritizationRunner {
  private tracker: ResourceTracker;
  private tokenCounter: TokenCounter;
  private resourceService: ResourceService;
  private sessionId: string;
  private pendingOperations: Promise<any>[] = [];
  
  /**
   * Creates a new ResourcePrioritizationRunner instance for a session.
   * 
   * @param sessionId The UUID of the session to manage resources for
   */
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
        const operationPromise = (async () => {
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
        })();
        
        // Track pending operations
        this.pendingOperations.push(operationPromise);
        
        // Clean up completed operations
        operationPromise.finally(() => {
          const index = this.pendingOperations.indexOf(operationPromise);
          if (index !== -1) {
            this.pendingOperations.splice(index, 1);
          }
        });
      } catch (error) {
        console.error('Error persisting resource access:', error);
      }
    });
  }
  
  /**
   * Tracks a resource access event.
   * 
   * @param path The path to the resource
   * @param type The type of resource
   * @param accessType How the resource is being accessed
   * @param metadata Additional metadata about the resource
   */
  trackResourceAccess(
    path: string,
    type: ResourceType,
    accessType: AccessType,
    metadata: { size?: number; modified?: boolean } = {}
  ): void {
    this.tracker.trackAccess(path, type, accessType, metadata);
  }
  
  /**
   * Gets the importance score for a resource.
   * 
   * @param path The path to the resource
   * @returns The importance score (0-100)
   */
/**
 * Gets the importance score for a resource.
 * 
 * @param path The path to the resource
 * @returns The importance score (0-100)
 */
getResourceImportance(path: string): number {
  const score = this.tracker.getResourceImportance(path);
  this.logger.debug(`Resource importance for ${path}: ${score}`);
  return score;
}

/**
 * Counts tokens in the provided text.
 * 
 * @param text The text to count tokens in
 * @param modelName Optional model name to use specific tokenizer
 * @returns The number of tokens
 */
countTokens(text: string, modelName?: string): number {
  return this.tokenCounter.countTokens(text, modelName);
}

/**
 * Waits for all pending database operations to complete.
 * This is important to call before operations that depend on DB state.
 */
async waitForPendingOperations(): Promise<void> {
  if (this.pendingOperations.length > 0) {
    this.logger.info(`Waiting for ${this.pendingOperations.length} pending operations to complete`);
    await Promise.all(this.pendingOperations);
    this.logger.info('All pending operations completed');
  }
}

/**
 * Prioritizes resources to fit within a token budget.
 * Selects the most important resources based on usage patterns.
 * 
 * @param tokenBudget Maximum number of tokens available
 * @returns Array of resource paths prioritized by importance
 */
async prioritizeResourcesForContext(tokenBudget: number): Promise<string[]> {
  return this.logger.timeOperation('prioritizeResourcesForContext', async () => {
    this.logger.info(`Prioritizing resources for token budget: ${tokenBudget}`);
    
    // Wait for any pending database operations to complete first
    await this.waitForPendingOperations();
    
    // Get important resources based on tracker
    const resourcePaths = this.tracker.getImportantResourcePaths();
    this.logger.debug(`Got ${resourcePaths.length} important resource paths`);
    
    const resources: Array<{
      path: string;
      importance: number;
      tokenCount: number;
      content?: string;
    }> = [];
    
    // Get token counts for each resource
    for (const path of resourcePaths) {
      try {
        // Estimate tokens based on file size and type
        const tokenCount = await this.tokenCounter.estimateFileTokens(path);
        const importance = this.getResourceImportance(path);
        
        resources.push({
          path,
          importance,
          tokenCount
        });
        
        this.logger.debug(`Resource ${path}: ${tokenCount} tokens, importance ${importance}`);
      } catch (error) {
        this.logger.error(`Error estimating tokens for ${path}:`, error);
      }
    }
    
    // Sort by importance
    resources.sort((a, b) => b.importance - a.importance);
    this.logger.debug('Resources sorted by importance');
    
    // Select resources to fit budget
    const selectedResources: string[] = [];
    let remainingBudget = tokenBudget;
    
    // Track database update operations
    const updatePromises: Promise<any>[] = [];
    
    for (const resource of resources) {
      if (resource.tokenCount <= remainingBudget) {
        selectedResources.push(resource.path);
        remainingBudget -= resource.tokenCount;
        
        this.logger.debug(`Selected ${resource.path}: ${resource.tokenCount} tokens, ` +
          `remaining budget: ${remainingBudget}`);
        
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
      } else {
        this.logger.debug(`Skipped ${resource.path}: ${resource.tokenCount} tokens exceeds ` +
          `remaining budget of ${remainingBudget}`);
      }
    }
    
    // Wait for all database updates to complete
    if (updatePromises.length > 0) {
      this.logger.debug(`Waiting for ${updatePromises.length} database updates to complete`);
      await Promise.all(updatePromises);
    }
    
    this.logger.info(`Selected ${selectedResources.length} resources within token budget`);
    return selectedResources;
  });
}

/**
 * Helper to get resource UUID from path.
 * 
 * @param path Resource path
 * @returns Resource UUID
 */
private async getResourceUuid(path: string): Promise<string> {
  const resource = await this.resourceService.getResourceByPath(path);
  if (!resource) {
    this.logger.error(`Resource not found for path: ${path}`);
    throw new Error(`Resource not found for path: ${path}`);
  }
  return resource.uuid;
}

/**
 * Generates a metrics report for the current session.
 * 
 * @returns Markdown-formatted report
 */
async generateMetricsReport(): Promise<string> {
  return this.logger.timeOperation('generateMetricsReport', async () => {
    this.logger.info('Generating metrics report');
    
    // Wait for any pending operations to complete
    await this.waitForPendingOperations();
    
    const sessionResources = await this.resourceService.getSessionResources(this.sessionId);
    this.logger.debug(`Found ${sessionResources.length} resources for session`);
    
    const resourcesByType: Record<string, number> = {};
    
    for (const resource of sessionResources) {
      resourcesByType[resource.type] = (resourcesByType[resource.type] || 0) + 1;
    }
    
    const includedResources = sessionResources.filter(r => r.importanceScore > 0);
    const totalTokens = includedResources.reduce((sum, r) => sum + (r.tokenCount || 0), 0);
    
    this.logger.info(`Report summary: ${includedResources.length}/${sessionResources.length} ` +
      `resources included, ${totalTokens} tokens`);
    
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
  });
}

/**
 * Creates a new session with a token budget.
 * Static factory method for convenience.
 * 
 * @param tokenBudget Maximum tokens available for context
 * @param summary Optional summary of the session purpose
 * @returns Session ID
 */
static async createSession(tokenBudget: number, summary?: string): Promise<string> {
  const logger = new ResourceLogger('ResourcePrioritizationRunner:static');
  
  return logger.timeOperation('createSession', async () => {
    logger.info(`Creating new session with token budget: ${tokenBudget}`);
    
    const resourceService = new ResourceService();
    const sessionId = await resourceService.createSession({
      tokenCount: tokenBudget,
      summary: summary || 'Resource prioritization session'
    });
    
    logger.info(`Created new session: ${sessionId}`);
    return sessionId;
  });
}

/**
 * Cleans up resources used by this runner.
 * Call this when the runner is no longer needed.
 */
async dispose(): Promise<void> {
}

export default ResourcePrioritizationRunner;
  this.logger.info('Disposing resource prioritization runner');
  
  // Wait for any pending operations to complete
  await this.waitForPendingOperations();
  
  // Remove event listeners to prevent memory leaks
  this.tracker.removeAllListeners();
  
  this.logger.info('Resource prioritization runner disposed');
}
  getResourceImportance(path: string): number {
    return this.tracker.getResourceImportance(path);
  }
  
  /**
   * Counts tokens in the provided text.
   * 
   * @param text The text to count tokens in
   * @param modelName Optional model name to use specific tokenizer
   * @returns The number of tokens
   */
  countTokens(text: string, modelName?: string): number {
    return this.tokenCounter.countTokens(text, modelName);
  }
  
  /**
   * Waits for all pending database operations to complete.
   * This is important to call before operations that depend on DB state.
   */
  async waitForPendingOperations(): Promise<void> {
    if (this.pendingOperations.length > 0) {
      await Promise.all(this.pendingOperations);
    }
  }
  
  /**
   * Prioritizes resources to fit within a token budget.
   * Selects the most important resources based on usage patterns.
   * 
   * @param tokenBudget Maximum number of tokens available
   * @returns Array of resource paths prioritized by importance
   */
  async prioritizeResourcesForContext(tokenBudget: number): Promise<string[]> {
    // Wait for any pending database operations to complete first
    await this.waitForPendingOperations();
    
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
        // Estimate tokens based on file size and type
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
    
    // Track database update operations
    const updatePromises: Promise<any>[] = [];
    
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
          console.error(`Error updating resource metadata for ${resource.path}:`, error);
        }
      }
    }
    
    // Wait for all database updates to complete
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    
    return selectedResources;
  }
  
  /**
   * Helper to get resource UUID from path.
   * 
   * @param path Resource path
   * @returns Resource UUID
   */
  private async getResourceUuid(path: string): Promise<string> {
    const resource = await this.resourceService.getResourceByPath(path);
    if (!resource) {
      throw new Error(`Resource not found for path: ${path}`);
    }
    return resource.uuid;
  }
  
  /**
   * Generates a metrics report for the current session.
   * 
   * @returns Markdown-formatted report
   */
  async generateMetricsReport(): Promise<string> {
    // Wait for any pending operations to complete
    await this.waitForPendingOperations();
    
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

  /**
   * Creates a new session with a token budget.
   * Static factory method for convenience.
   * 
   * @param tokenBudget Maximum tokens available for context
   * @param summary Optional summary of the session purpose
   * @returns Session ID
   */
  static async createSession(tokenBudget: number, summary?: string): Promise<string> {
    const resourceService = new ResourceService();
    return resourceService.createSession({
      tokenCount: tokenBudget,
      summary: summary || 'Resource prioritization session'
    });
  }
  
  /**
   * Cleans up resources used by this runner.
   * Call this when the runner is no longer needed.
   */
  async dispose(): Promise<void> {
    // Wait for any pending operations to complete
    await this.waitForPendingOperations();
    
    // Remove event listeners to prevent memory leaks
    this.tracker.removeAllListeners();
  }
}

export default ResourcePrioritizationRunner;
