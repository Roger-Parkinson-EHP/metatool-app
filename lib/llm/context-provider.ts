/**
 * LLM Context Provider
 * 
 * Integrates resource prioritization with LLM context management.
 * Prepares context for LLM API calls using prioritized resources.
 */

import fs from 'fs/promises';
import path from 'path';
import { prioritizeResourcesForContext } from '../../app/actions/resource-tracking';
import { TokenCounter } from '../token-counting/TokenCounter';

// Simple token counter for estimates
const tokenCounter = new TokenCounter();

export interface ContextOptions {
  sessionId: string;
  tokenBudget: number;
  projectDir: string;
  userPrompt: string;
  systemPrompt?: string;
  maxRetries?: number;
}

export interface ContextResult {
  systemPrompt: string;
  resources: Array<{ path: string; content: string; error?: string }>;
  formattedContext: string;
  userPrompt: string;
  tokenCounts: {
    prompt: number;
    resources: number;
    overhead: number;
    total: number;
  };
}

/**
 * Generate context for an LLM call using prioritized resources
 */
export async function generateContext(options: ContextOptions): Promise<ContextResult> {
  const { 
    sessionId, 
    tokenBudget, 
    projectDir, 
    userPrompt, 
    systemPrompt,
    maxRetries = 3  
  } = options;
  
  // Reserve tokens for the prompts and overhead
  const defaultSystemPrompt = 'You are a helpful assistant with access to the following project files:';
  const effectiveSystemPrompt = systemPrompt || defaultSystemPrompt;
  const promptTokens = tokenCounter.countTokens(userPrompt + effectiveSystemPrompt);
  const overheadTokens = 500; // Reserve for metadata, formatting, etc.
  const availableTokens = tokenBudget - promptTokens - overheadTokens;
  
  // Get prioritized resources
  let resourcePaths: string[] = [];
  
  // Add retry logic for prioritization
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      resourcePaths = await prioritizeResourcesForContext(sessionId, availableTokens);
      break;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error('Failed to prioritize resources after multiple attempts:', error);
        resourcePaths = []; // Empty array as fallback
      } else {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }
  }
  
  // Read resource contents
  const resources = await Promise.all(
    resourcePaths.map(async (relativePath) => {
      const fullPath = path.join(projectDir, relativePath);
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        return {
          path: relativePath,
          content
        };
      } catch (error) {
        console.error(`Error reading file ${fullPath}:`, error);
        return {
          path: relativePath,
          content: `[Error reading file]`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );
  
  // Format resources for context
  const resourcesContext = resources.map(resource => {
    const errorNote = resource.error ? `\n> Note: ${resource.error}` : '';
    return `### File: ${resource.path}${errorNote}\n\`\`\`\n${resource.content}\n\`\`\``;
  }).join('\n\n');
  
  // Calculate token counts
  const resourceTokens = tokenCounter.countTokens(resourcesContext);
  
  // Combine everything into the full context
  return {
    systemPrompt: effectiveSystemPrompt,
    resources,
    formattedContext: resourcesContext,
    userPrompt,
    tokenCounts: {
      prompt: promptTokens,
      resources: resourceTokens,
      overhead: overheadTokens,
      total: promptTokens + resourceTokens + overheadTokens
    }
  };
}
