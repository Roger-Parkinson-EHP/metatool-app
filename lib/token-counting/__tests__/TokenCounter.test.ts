/**
 * TokenCounter Tests
 * 
 * Comprehensive tests for the TokenCounter component, covering token counting
 * for different content types and tokenizers.
 */

import { TokenCounter, ClaudeTokenizer, GptTokenizer } from '../TokenCounter';
import fs from 'fs/promises';

// Mock fs module
jest.mock('fs/promises');

describe('TokenCounter', () => {
  let counter: TokenCounter;

  beforeEach(() => {
    counter = new TokenCounter();
    // Reset all mocks
    jest.resetAllMocks();
  });

  describe('Tokenizer registration and selection', () => {
    it('should use the default tokenizer when no model specified', () => {
      // Default is Claude tokenizer
      const text = 'This is a test text.';
      const tokens = counter.countTokens(text);
      
      // Claude tokenizer uses ~3.8 chars per token
      expect(tokens).toBeCloseTo(Math.ceil(text.length / 3.8), 0);
    });

    it('should use the correct tokenizer when model is specified', () => {
      const text = 'This is a test text.';
      
      // Claude tokenizer
      const claudeTokens = counter.countTokens(text, 'claude');
      expect(claudeTokens).toBeCloseTo(Math.ceil(text.length / 3.8), 0);
      
      // GPT tokenizer
      const gptTokens = counter.countTokens(text, 'gpt');
      expect(gptTokens).toBeCloseTo(Math.ceil(text.length / 4.0), 0);
    });

    it('should allow setting a different default tokenizer', () => {
      // Set GPT as default
      counter.setDefaultTokenizer('gpt');
      
      const text = 'This is a test text.';
      const tokens = counter.countTokens(text); // No model specified, should use GPT
      
      // GPT tokenizer uses ~4.0 chars per token
      expect(tokens).toBeCloseTo(Math.ceil(text.length / 4.0), 0);
    });

    it('should throw error when setting an unknown tokenizer', () => {
      expect(() => {
        counter.setDefaultTokenizer('unknown-model');
      }).toThrow('No tokenizer registered for model: unknown-model');
    });

    it('should register a custom tokenizer', () => {
      // Create a custom tokenizer
      const customTokenizer = {
        modelName: 'custom-model',
        countTokens: (text: string) => Math.ceil(text.length / 5.0) // 5 chars per token
      };
      
      // Register it
      counter.registerTokenizer(customTokenizer);
      
      // Use it
      const text = 'This is a test text.';
      const tokens = counter.countTokens(text, 'custom-model');
      
      expect(tokens).toBeCloseTo(Math.ceil(text.length / 5.0), 0);
    });
  });

  describe('Token counting functionality', () => {
    it('should count tokens in simple text', () => {
      const text = 'This is a simple test text with 10 words in it.';
      const tokens = counter.countTokens(text);
      
      // A reasonable number of tokens for this text
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(20);
    });

    it('should count tokens in code', () => {
      const code = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
      `;
      
      const tokens = counter.countTokens(code);
      
      // Code should have a reasonable number of tokens
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(50);
    });

    it('should count tokens in structured data', () => {
      const json = JSON.stringify({
        name: 'Token Counter',
        version: '1.0.0',
        features: ['accurate counting', 'multiple models', 'caching'],
        metrics: {
          performance: 'high',
          accuracy: 99.5
        }
      }, null, 2);
      
      const tokens = counter.countTokens(json);
      
      // Structured data should have a reasonable number of tokens
      expect(tokens).toBeGreaterThan(20);
      expect(tokens).toBeLessThan(100);
    });

    it('should use caching for repeated texts', () => {
      const text = 'This text will be counted multiple times.';
      
      // Create spy on the default tokenizer
      const tokenizer = new ClaudeTokenizer();
      const spy = jest.spyOn(tokenizer, 'countTokens');
      counter.registerTokenizer(tokenizer);
      counter.setDefaultTokenizer('claude');
      
      // Count tokens multiple times
      const tokens1 = counter.countTokens(text);
      const tokens2 = counter.countTokens(text);
      const tokens3 = counter.countTokens(text);
      
      // Tokenizer should only be called once due to caching
      expect(spy).toHaveBeenCalledTimes(1);
      
      // All counts should be the same
      expect(tokens1).toBe(tokens2);
      expect(tokens2).toBe(tokens3);
    });

    it('should limit cache size', () => {
      // Create counter with small cache
      const smallCacheCounter = new TokenCounter(2);
      
      // Count tokens for different texts
      smallCacheCounter.countTokens('Text 1');
      smallCacheCounter.countTokens('Text 2');
      
      // This should evict the first entry
      smallCacheCounter.countTokens('Text 3');
      
      // Create spies to check if the tokenizer is called
      const tokenizer = new ClaudeTokenizer();
      const spy = jest.spyOn(tokenizer, 'countTokens');
      smallCacheCounter.registerTokenizer(tokenizer);
      smallCacheCounter.setDefaultTokenizer('claude');
      
      // Count Text 1 again - should call tokenizer since it was evicted
      smallCacheCounter.countTokens('Text 1');
      expect(spy).toHaveBeenCalledTimes(1);
      
      // Count Text 3 again - should use cache
      smallCacheCounter.countTokens('Text 3');
      expect(spy).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('File-based token counting', () => {
    it('should count tokens in a file', async () => {
      // Mock file content
      const fileContent = 'This is a test file content.';
      (fs.readFile as jest.Mock).mockResolvedValue(fileContent);
      
      const tokens = await counter.countFileTokens('/path/to/file.txt');
      
      // Should use the file content for counting
      expect(tokens).toBeCloseTo(Math.ceil(fileContent.length / 3.8), 0);
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf8');
    });

    it('should handle file reading errors', async () => {
      // Mock file reading error
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const tokens = await counter.countFileTokens('/path/to/nonexistent.txt');
      
      // Should return 0 on error
      expect(tokens).toBe(0);
    });

    it('should estimate tokens based on file size and type', async () => {
      // Mock file stats
      (fs.stat as jest.Mock).mockResolvedValue({
        size: 1000,
        isFile: () => true
      });
      
      // Test different file types
      const codeTokens = await counter.estimateFileTokens('/path/to/file.js');
      const docTokens = await counter.estimateFileTokens('/path/to/file.md');
      const dataTokens = await counter.estimateFileTokens('/path/to/file.json');
      const unknownTokens = await counter.estimateFileTokens('/path/to/file.xyz');
      
      // Different file types should use different bytes per token
      expect(codeTokens).toBeCloseTo(Math.ceil(1000 / 3.5), 0); // Code: 3.5 bytes/token
      expect(docTokens).toBeCloseTo(Math.ceil(1000 / 4.0), 0); // Doc: 4.0 bytes/token
      expect(dataTokens).toBeCloseTo(Math.ceil(1000 / 5.0), 0); // Data: 5.0 bytes/token
      expect(unknownTokens).toBeCloseTo(Math.ceil(1000 / 4.0), 0); // Unknown: 4.0 bytes/token (default)
    });

    it('should handle file stat errors', async () => {
      // Mock file stat error
      (fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const tokens = await counter.estimateFileTokens('/path/to/nonexistent.txt');
      
      // Should return 0 on error
      expect(tokens).toBe(0);
    });
  });

  describe('Resource type detection', () => {
    it('should detect code files', () => {
      const codeFiles = [
        '/path/to/file.js',
        '/path/to/file.ts',
        '/path/to/file.py',
        '/path/to/file.java',
        '/path/to/file.c',
        '/path/to/file.cpp',
        '/path/to/file.cs',
        '/path/to/file.go',
        '/path/to/file.rb',
        '/path/to/file.php',
        '/path/to/file.swift',
        '/path/to/file.html',
        '/path/to/file.css',
        '/path/to/file.scss',
        '/path/to/file.sql'
      ];
      
      for (const file of codeFiles) {
        expect(counter.getResourceTypeFromPath(file)).toBe(ResourceType.CODE);
      }
    });

    it('should detect documentation files', () => {
      const docFiles = [
        '/path/to/file.md',
        '/path/to/file.txt',
        '/path/to/file.pdf',
        '/path/to/file.rst',
        '/path/to/file.adoc',
        '/path/to/file.docx'
      ];
      
      for (const file of docFiles) {
        expect(counter.getResourceTypeFromPath(file)).toBe(ResourceType.DOCUMENTATION);
      }
    });

    it('should detect data files', () => {
      const dataFiles = [
        '/path/to/file.json',
        '/path/to/file.csv',
        '/path/to/file.xml',
        '/path/to/file.yaml',
        '/path/to/file.yml',
        '/path/to/file.toml',
        '/path/to/file.ini',
        '/path/to/file.xls',
        '/path/to/file.xlsx'
      ];
      
      for (const file of dataFiles) {
        expect(counter.getResourceTypeFromPath(file)).toBe(ResourceType.DATA);
      }
    });

    it('should default to documentation for unknown extensions', () => {
      const unknownFiles = [
        '/path/to/file.xyz',
        '/path/to/file.unknown',
        '/path/to/file'
      ];
      
      for (const file of unknownFiles) {
        expect(counter.getResourceTypeFromPath(file)).toBe(ResourceType.DOCUMENTATION);
      }
    });
  });

  describe('Utility functions', () => {
    it('should check if text fits in budget', () => {
      const text = 'This is a test text with approximately 12 tokens.';
      const tokens = counter.countTokens(text);
      
      // Should fit in a larger budget
      expect(counter.fitsInBudget(text, tokens + 10)).toBe(true);
      
      // Should not fit in a smaller budget
      expect(counter.fitsInBudget(text, tokens - 1)).toBe(false);
      
      // Should exactly fit in a matching budget
      expect(counter.fitsInBudget(text, tokens)).toBe(true);
    });

    it('should clear the cache', () => {
      const text = 'This is a text to cache.';
      
      // Create spy on the default tokenizer
      const tokenizer = new ClaudeTokenizer();
      const spy = jest.spyOn(tokenizer, 'countTokens');
      counter.registerTokenizer(tokenizer);
      counter.setDefaultTokenizer('claude');
      
      // Count once to cache
      counter.countTokens(text);
      expect(spy).toHaveBeenCalledTimes(1);
      
      // Count again should use cache
      counter.countTokens(text);
      expect(spy).toHaveBeenCalledTimes(1); // Still 1
      
      // Clear cache
      counter.clearCache();
      
      // Count again should call tokenizer
      counter.countTokens(text);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
