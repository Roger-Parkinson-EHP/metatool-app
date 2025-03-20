/**
 * Unit tests for ResourcePrioritizationRunner
 */

import { ResourcePrioritizationRunner } from './ResourcePrioritizationRunner';
import { ResourceTracker, AccessType, ResourceType } from './ResourceTracker';
import { TokenCounter } from '../token-counting/TokenCounter';
import { ResourceService } from './ResourceService';

// Mock dependencies
jest.mock('./ResourceTracker');
jest.mock('../token-counting/TokenCounter');
jest.mock('./ResourceService');

describe('ResourcePrioritizationRunner', () => {
  let runner: ResourcePrioritizationRunner;
  let mockTracker: jest.Mocked<ResourceTracker>;
  let mockTokenCounter: jest.Mocked<TokenCounter>;
  let mockResourceService: jest.Mocked<ResourceService>;
  const sessionId = 'test-session-id';

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    
    // Create mock instances
    mockTracker = new ResourceTracker() as jest.Mocked<ResourceTracker>;
    mockTokenCounter = new TokenCounter() as jest.Mocked<TokenCounter>;
    mockResourceService = new ResourceService() as jest.Mocked<ResourceService>;
    
    // Set up constructor mocks
    (ResourceTracker as jest.Mock).mockImplementation(() => mockTracker);
    (TokenCounter as jest.Mock).mockImplementation(() => mockTokenCounter);
    (ResourceService as jest.Mock).mockImplementation(() => mockResourceService);
    
    // Configure mockTracker behavior
    mockTracker.setSessionId = jest.fn();
    mockTracker.on = jest.fn();
    mockTracker.removeAllListeners = jest.fn();
    mockTracker.trackAccess = jest.fn();
    mockTracker.getResourceImportance = jest.fn().mockReturnValue(50);
    mockTracker.getImportantResourcePaths = jest.fn().mockReturnValue([
      '/path/to/file1.ts',
      '/path/to/file2.md',
      '/path/to/file3.json'
    ]);
    
    // Configure mockTokenCounter behavior
    mockTokenCounter.countTokens = jest.fn().mockReturnValue(100);
    mockTokenCounter.estimateFileTokens = jest.fn().mockImplementation(async (path) => {
      // Return different token counts based on file extension
      if (path.endsWith('.ts')) return 500;
      if (path.endsWith('.md')) return 1000;
      if (path.endsWith('.json')) return 300;
      return 200;
    });
    
    // Configure mockResourceService behavior
    mockResourceService.trackResource = jest.fn().mockResolvedValue('resource-uuid');
    mockResourceService.logAccess = jest.fn().mockResolvedValue(undefined);
    mockResourceService.updateResourceImportance = jest.fn().mockResolvedValue(undefined);
    mockResourceService.setResourceIncludedInContext = jest.fn().mockResolvedValue(undefined);
    mockResourceService.getResourceByPath = jest.fn().mockImplementation(async (path) => ({
      uuid: `${path}-uuid`,
      path,
      type: path.endsWith('.ts') ? ResourceType.CODE : 
            path.endsWith('.md') ? ResourceType.DOCUMENTATION : ResourceType.DATA,
      lastAccessed: new Date(),
      accessCount: 3,
      modifiedDuringSession: true,
      createdAt: new Date()
    }));
    mockResourceService.getSessionResources = jest.fn().mockResolvedValue([
      {
        uuid: 'file1-uuid',
        path: '/path/to/file1.ts',
        type: ResourceType.CODE,
        tokenCount: 500,
        lastAccessed: new Date(),
        accessCount: 5,
        modifiedDuringSession: true,
        createdAt: new Date(),
        importanceScore: 80
      },
      {
        uuid: 'file2-uuid',
        path: '/path/to/file2.md',
        type: ResourceType.DOCUMENTATION,
        tokenCount: 1000,
        lastAccessed: new Date(),
        accessCount: 3,
        modifiedDuringSession: false,
        createdAt: new Date(),
        importanceScore: 60
      },
      {
        uuid: 'file3-uuid',
        path: '/path/to/file3.json',
        type: ResourceType.DATA,
        tokenCount: 300,
        lastAccessed: new Date(),
        accessCount: 2,
        modifiedDuringSession: false,
        createdAt: new Date(),
        importanceScore: 40
      }
    ]);
    
    // Create runner instance for testing
    runner = new ResourcePrioritizationRunner(sessionId);
  });

  describe('constructor', () => {
    it('should initialize dependencies correctly', () => {
      expect(ResourceTracker).toHaveBeenCalled();
      expect(TokenCounter).toHaveBeenCalled();
      expect(ResourceService).toHaveBeenCalled();
      expect(mockTracker.setSessionId).toHaveBeenCalledWith(sessionId);
      expect(mockTracker.on).toHaveBeenCalledWith('resourceAccess', expect.any(Function));
    });
  });

  describe('trackResourceAccess', () => {
    it('should delegate to ResourceTracker', () => {
      const path = '/path/to/file.ts';
      const type = ResourceType.CODE;
      const accessType = AccessType.VIEW;
      const metadata = { size: 1024, modified: false };

      runner.trackResourceAccess(path, type, accessType, metadata);

      expect(mockTracker.trackAccess).toHaveBeenCalledWith(path, type, accessType, metadata);
    });
  });

  describe('getResourceImportance', () => {
    it('should delegate to ResourceTracker', () => {
      const path = '/path/to/file.ts';
      const result = runner.getResourceImportance(path);

      expect(mockTracker.getResourceImportance).toHaveBeenCalledWith(path);
      expect(result).toBe(50); // Value from mock
    });
  });

  describe('countTokens', () => {
    it('should delegate to TokenCounter', () => {
      const text = 'Sample text';
      const modelName = 'claude';
      const result = runner.countTokens(text, modelName);

      expect(mockTokenCounter.countTokens).toHaveBeenCalledWith(text, modelName);
      expect(result).toBe(100); // Value from mock
    });
  });

  describe('waitForPendingOperations', () => {
    it('should resolve when there are no pending operations', async () => {
      await expect(runner.waitForPendingOperations()).resolves.toBeUndefined();
    });
  });

  describe('prioritizeResourcesForContext', () => {
    it('should prioritize resources within token budget', async () => {
      const tokenBudget = 2000;
      const result = await runner.prioritizeResourcesForContext(tokenBudget);

      // With a 2000 token budget, should include file1.ts (500 tokens) and file3.json (300 tokens)
      // but not file2.md (1000 tokens) as it would exceed remaining budget
      expect(result).toEqual(['/path/to/file1.ts', '/path/to/file3.json']);
      
      // Verify importance scores were updated
      expect(mockResourceService.updateResourceImportance).toHaveBeenCalledTimes(2);
      expect(mockResourceService.setResourceIncludedInContext).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      // Make estimateFileTokens throw for one file
      mockTokenCounter.estimateFileTokens.mockImplementation(async (path) => {
        if (path === '/path/to/file2.md') throw new Error('Test error');
        return 300;
      });

      const tokenBudget = 1000;
      const result = await runner.prioritizeResourcesForContext(tokenBudget);

      // Should still include the files that didn't error
      expect(result).toEqual(['/path/to/file1.ts', '/path/to/file3.json']);
    });

    it('should handle resource lookup errors', async () => {
      // Make getResourceUuid throw for one resource
      mockResourceService.getResourceByPath.mockImplementation(async (path) => {
        if (path === '/path/to/file1.ts') return null;
        
        return {
          uuid: `${path}-uuid`,
          path,
          type: ResourceType.CODE,
          lastAccessed: new Date(),
          accessCount: 3,
          modifiedDuringSession: true,
          createdAt: new Date()
        };
      });

      const tokenBudget = 2000;
      const result = await runner.prioritizeResourcesForContext(tokenBudget);

      // Should only include the file that didn't error
      expect(result).toEqual(['/path/to/file3.json']);
    });
  });

  describe('generateMetricsReport', () => {
    it('should generate a markdown report with resource metrics', async () => {
      const report = await runner.generateMetricsReport();

      // Verify report contains expected sections
      expect(report).toContain('# Session Resource Metrics');
      expect(report).toContain('## Overview');
      expect(report).toContain(`- Session ID: ${sessionId}`);
      expect(report).toContain('## Resources by Type');
      expect(report).toContain('## Top Resources by Importance');
      
      // Verify specific resource data is included
      expect(report).toContain('/path/to/file1.ts');
      expect(report).toContain('Importance: 80');
    });
  });

  describe('createSession', () => {
    it('should create a new session with the provided parameters', async () => {
      mockResourceService.createSession = jest.fn().mockResolvedValue('new-session-id');
      
      // Mock the static method by mocking implementation of ResourceService
      (ResourceService as jest.Mock).mockImplementation(() => mockResourceService);
      
      const tokenBudget = 8000;
      const summary = 'Test session';
      const result = await ResourcePrioritizationRunner.createSession(tokenBudget, summary);

      expect(mockResourceService.createSession).toHaveBeenCalledWith({
        tokenCount: tokenBudget,
        summary
      });
      expect(result).toBe('new-session-id');
    });

    it('should use default summary if none provided', async () => {
      mockResourceService.createSession = jest.fn().mockResolvedValue('new-session-id');
      
      // Mock the static method by mocking implementation of ResourceService
      (ResourceService as jest.Mock).mockImplementation(() => mockResourceService);
      
      const tokenBudget = 8000;
      const result = await ResourcePrioritizationRunner.createSession(tokenBudget);

      expect(mockResourceService.createSession).toHaveBeenCalledWith({
        tokenCount: tokenBudget,
        summary: 'Resource prioritization session'
      });
      expect(result).toBe('new-session-id');
    });
  });

  describe('dispose', () => {
    it('should clean up resources properly', async () => {
      await runner.dispose();

      expect(mockTracker.removeAllListeners).toHaveBeenCalled();
    });
  });
});
