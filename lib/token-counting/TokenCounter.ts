/**
 * Token Counter
 * 
 * Provides token counting capabilities for different content types and language models.
 * This implementation focuses on accurate token counting to support resource-aware
 * context management and prioritization.
 */

import fs from 'fs/promises';
import path from 'path';
import { ResourceType } from '../resource-tracking/ResourceTracker';

// Simple approximation for token counting when no specialized tokenizer is available
function approximateTokenCount(text: string): number {
  // Simple approach - approximately 4 characters per token for English
  // This is a very rough approximation and should be replaced with model-specific tokenizers
  return Math.ceil(text.length / 4);
}

/**
 * Maps file extensions to resource types.
 * This helps automatically categorize files by their extensions.
 */
const EXTENSION_TYPE_MAP: Record<string, ResourceType> = {
  // Code files
  '.js': ResourceType.CODE,
  '.jsx': ResourceType.CODE,
  '.ts': ResourceType.CODE,
  '.tsx': ResourceType.CODE,
  '.py': ResourceType.CODE,
  '.java': ResourceType.CODE,
  '.c': ResourceType.CODE,
  '.cpp': ResourceType.CODE,
  '.cs': ResourceType.CODE,
  '.go': ResourceType.CODE,
  '.rb': ResourceType.CODE,
  '.php': ResourceType.CODE,
  '.swift': ResourceType.CODE,
  '.html': ResourceType.CODE,
  '.css': ResourceType.CODE,
  '.scss': ResourceType.CODE,
  '.sql': ResourceType.CODE,
  
  // Documentation files
  '.md': ResourceType.DOCUMENTATION,
  '.txt': ResourceType.DOCUMENTATION,
  '.pdf': ResourceType.DOCUMENTATION,
  '.rst': ResourceType.DOCUMENTATION,
  '.adoc': ResourceType.DOCUMENTATION,
  '.docx': ResourceType.DOCUMENTATION,
  
  // Data files
  '.json': ResourceType.DATA,
  '.csv': ResourceType.DATA,
  '.xml': ResourceType.DATA,
  '.yaml': ResourceType.DATA,
  '.yml': ResourceType.DATA,
  '.toml': ResourceType.DATA,
  '.ini': ResourceType.DATA,
  '.xls': ResourceType.DATA,
  '.xlsx': ResourceType.DATA,
};

/**
 * Interface for model-specific tokenizers.
 * Different LLMs may use different tokenization approaches.
 */
export interface Tokenizer {
  countTokens(text: string): number;
  modelName: string;
}

/**
 * Simple tokenizer for Claude models.
 * This is a placeholder - in production, this should use Claude's actual tokenization logic.
 */
export class ClaudeTokenizer implements Tokenizer {
  modelName = 'claude';
  
  countTokens(text: string): number {
    // Simple approximation - in production, this should use Claude's actual tokenization logic
    return Math.ceil(text.length / 3.8); // Claude seems to have slightly smaller tokens than GPT
  }
}

/**
 * Simple tokenizer for GPT models.
 * This is a placeholder - in production, this should use tiktoken or equivalent.
 */
export class GptTokenizer implements Tokenizer {
  modelName = 'gpt';
  
  countTokens(text: string): number {
    // Simple approximation - in production, this should use tiktoken
    return Math.ceil(text.length / 4.0);
  }
}

/**
 * Main token counter class that provides methods for counting tokens
 * in different types of content and files.
 */
export class TokenCounter {
  private tokenizers: Map<string, Tokenizer> = new Map();
  private defaultTokenizer: Tokenizer;
  private cache: Map<string, number> = new Map();
  
  /**
   * Creates a new TokenCounter instance.
   * 
   * @param cacheSize Maximum number of entries to keep in the token count cache
   */
  constructor(private cacheSize: number = 1000) {
    // Register default tokenizers
    this.registerTokenizer(new ClaudeTokenizer());
    this.registerTokenizer(new GptTokenizer());
    
    // Set default tokenizer
    this.defaultTokenizer = new ClaudeTokenizer();
  }
  
  /**
   * Registers a tokenizer for a specific model.
   * 
   * @param tokenizer The tokenizer to register
   */
  registerTokenizer(tokenizer: Tokenizer): void {
    this.tokenizers.set(tokenizer.modelName, tokenizer);
  }
  
  /**
   * Sets the default tokenizer to use when no model is specified.
   * 
   * @param modelName The name of the model to use as default
   */
  setDefaultTokenizer(modelName: string): void {
    const tokenizer = this.tokenizers.get(modelName);
    if (tokenizer) {
      this.defaultTokenizer = tokenizer;
    } else {
      throw new Error(`No tokenizer registered for model: ${modelName}`);
    }
  }
  
  /**
   * Gets the resource type for a file based on its extension.
   * 
   * @param filePath The path to the file
   * @returns The resource type or DOCUMENTATION as fallback
   */
  getResourceTypeFromPath(filePath: string): ResourceType {
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_TYPE_MAP[ext] || ResourceType.DOCUMENTATION;
  }
  
  /**
   * Counts tokens in the given text using the specified model's tokenizer.
   * 
   * @param text The text to count tokens in
   * @param modelName Optional model name to use specific tokenizer
   * @returns The number of tokens in the text
   */
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
  
  /**
   * Counts tokens in a file using appropriate tokenizer based on file type.
   * 
   * @param filePath Path to the file
   * @param modelName Optional model name to use specific tokenizer
   * @returns Promise resolving to the token count
   */
  async countFileTokens(filePath: string, modelName?: string): Promise<number> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.countTokens(content, modelName);
    } catch (error) {
      console.error(`Error counting tokens in file ${filePath}:`, error);
      return 0;
    }
  }
  
  /**
   * Estimates token count based on file size and type without reading the entire file.
   * This is useful for quick estimates on large files.
   * 
   * @param filePath Path to the file
   * @returns Promise resolving to estimated token count
   */
  async estimateFileTokens(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      const fileSizeInBytes = stats.size;
      const resourceType = this.getResourceTypeFromPath(filePath);
      
      // Average bytes per token varies by content type
      let bytesPerToken: number;
      switch (resourceType) {
        case ResourceType.CODE:
          bytesPerToken = 3.5; // Code tends to be more compact
          break;
        case ResourceType.DOCUMENTATION:
          bytesPerToken = 4.0; // Documentation is typically English text
          break;
        case ResourceType.DATA:
          bytesPerToken = 5.0; // Data formats like JSON have more structure
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
  
  /**
   * Checks if the text fits within the specified token budget.
   * 
   * @param text The text to check
   * @param budget The token budget
   * @param modelName Optional model name to use specific tokenizer
   * @returns True if the text fits within the budget, false otherwise
   */
  fitsInBudget(text: string, budget: number, modelName?: string): boolean {
    const tokenCount = this.countTokens(text, modelName);
    return tokenCount <= budget;
  }
  
  /**
   * Clears the token count cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Limits the cache size to the configured maximum.
   */
  private limitCacheSize(): void {
    if (this.cache.size > this.cacheSize) {
      // Remove oldest entries (first in, first out)
      const entriesToRemove = this.cache.size - this.cacheSize;
      const keys = Array.from(this.cache.keys()).slice(0, entriesToRemove);
      keys.forEach(key => this.cache.delete(key));
    }
  }
}
