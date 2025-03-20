/**
 * ResourcePrioritizationRunner Tests
 * 
 * Comprehensive tests for the ResourcePrioritizationRunner component, covering
 * resource prioritization, token budget management, and persistence coordination.
 */

import { ResourcePrioritizationRunner } from '../ResourcePrioritizationRunner';
import { ResourceTracker, AccessType, ResourceType } from '../ResourceTracker';
import { TokenCounter } from '../../token-counting/TokenCounter';
import { ResourceService } from '../ResourceService';
import { ResourceLogger } from '../resource-logger';
import { createTestAccessSequence, createMockDatabaseResponses } from './test-utils';

// Mock dependencies
jest.mock('../ResourceTracker');
jest.mock('../../token-counting/TokenCounter');
jest.mock('../ResourceService');
jest.mock('../resource-logger');

describe('ResourcePrioritizationRunner', () => {
  let runner: ResourcePrioritizationRunner;
  let mockTracker: jest.Mocked<ResourceTracker>;
  let mockTokenCounter: jest.Mocked<TokenCounter>;
  let mockResourceService: jest.Mocked<ResourceService>;
  let mockLogger: jest.Mocked<ResourceLogger>;
  const sessionId = 'test-session-id';

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    
    // Create mock instances
    mockTracker = new ResourceTracker() as jest.Mocked<ResourceTracker>;
    mockTokenCounter = new TokenCounter() as jest.Mocked<TokenCounter>;
    mockResourceService = new ResourceService() as jest.Mocked<ResourceService>;
    mockLogger = new ResourceLogger('test') as jest.Mocked<ResourceLogger>;
    
    // Set up constructor mocks
    (ResourceTracker as jest.Mock).mockImplementation(() => mockTracker);
    (TokenCounter as jest.Mock).mockImplementation(() => mockTokenCounter);
    (ResourceService as jest.Mock).mockImplementation(() => mockResourceService);
    (ResourceLogger as jest.Mock).mockImplementation(() => mockLogger);
    
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
    
    // Configure mockLogger behavior
    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.timeOperation = jest.fn().mockImplementation(async (name, operation) => {
      return operation();
    });
    
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
      expect(ResourceLogger).toHaveBeenCalled();
    });
    
    it('should set up resource access event handling', () => {
      // Extract the event handler function that was registered
      const eventHandler = (mockTracker.on as jest.Mock).mock.calls[0][1];
      
      // Create a test event
      const eventData = {
        path: '/test/file.ts',
        type: ResourceType.CODE,
        accessType: AccessType.VIEW,
        sessionId,
        timestamp: new Date(),
        metadata: { size: 1024 }
      };
      
      // Call the event handler directly
      eventHandler(eventData);
      
      // Check that the appropriate database calls were made
      expect(mockResourceService.trackResource).toHaveBeenCalledWith({
        path: eventData.path,
        type: eventData.type,
        size: eventData.metadata.size,
        modifiedDuringSession: false,
        lastAccessed: eventData.timestamp,
        accessCount: 1
      });
      
      // logAccess should be called after trackResource completes
      // This is asynchronous, so we need to use process.nextTick
      process.nextTick(() => {
        expect(mockResourceService.logAccess).toHaveBeenCalledWith({
          resourceUuid: 'resource-uuid',
          sessionUuid: sessionId,
          accessType: eventData.accessType
        });
      });
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
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('getResourceImportance', () => {
    it('should delegate to ResourceTracker', () => {
      const path = '/path/to/file.ts';
      const result = runner.getResourceImportance(path);

      expect(mockTracker.getResourceImportance).toHaveBeenCalledWith(path);
      expect(result).toBe(50); // Value from mock
      expect(mockLogger.debug).toHaveBeenCalled();
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
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    it('should wait for pending operations to complete', async () => {
      // Add a mock pending operation
      const pendingOp = new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
      
      // @ts-ignore - Access private property for testing
      runner.pendingOperations.push(pendingOp);
      
      // Wait for the operation to complete
      const waitPromise = runner.waitForPendingOperations();
      
      // The wait should not resolve immediately
      const immediateResult = await Promise.race([
        waitPromise.then(() => true),
        new Promise(resolve => setTimeout(() => resolve(false), 10))
      ]);
      
      expect(immediateResult).toBe(false);
      
      // Eventually it should resolve
      await expect(waitPromise).resolves.toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('pending operations')
      );
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
      expect(mockLogger.timeOperation).toHaveBeenCalled();
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
      expect(mockLogger.error).toHaveBeenCalled();
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
      expect(mockLogger.error).toHaveBeenCalled();
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
      expect(mockLogger.timeOperation).toHaveBeenCalled();
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
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    it('should wait for pending operations before cleanup', async () => {
      // Add a mock pending operation
      const pendingOp = new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
      
      // @ts-ignore - Access private property for testing
      runner.pendingOperations.push(pendingOp);
      
      // Call dispose
      const disposePromise = runner.dispose();
      
      // Dispose should not resolve immediately
      const immediateResult = await Promise.race([
        disposePromise.then(() => true),
        new Promise(resolve => setTimeout(() => resolve(false), 10))
      ]);
      
      expect(immediateResult).toBe(false);
      
      // Eventually it should resolve
      await expect(disposePromise).resolves.toBeUndefined();
      expect(mockTracker.removeAllListeners).toHaveBeenCalled();
    });
  });
  
  describe('error handling', () => {
    it('should log errors when tracking resource access fails', async () => {
      // Make trackResource throw an error
      mockResourceService.trackResource.mockRejectedValue(new Error('Database error'));
      
      // Extract the event handler function that was registered
      const eventHandler = (mockTracker.on as jest.Mock).mock.calls[0][1];
      
      // Create a test event
      const eventData = {
        path: '/test/file.ts',
        type: ResourceType.CODE,
        accessType: AccessType.VIEW,
        sessionId,
        timestamp: new Date(),
        metadata: { size: 1024 }
      };
      
      // Call the event handler directly
      await eventHandler(eventData);
      
      // The error should be logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
