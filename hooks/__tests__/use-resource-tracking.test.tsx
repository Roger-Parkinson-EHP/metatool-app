/**
 * Unit tests for useResourceTracking hook
 */

import { renderHook, act } from '@testing-library/react';
import { useResourceTracking } from '../use-resource-tracking';
import * as resourceTrackingActions from '../../app/actions/resource-tracking';

// Mock the resource tracking actions
jest.mock('../../app/actions/resource-tracking', () => ({
  createTrackingSession: jest.fn(),
  trackResourceAccess: jest.fn(),
  prioritizeResourcesForContext: jest.fn(),
  generateMetricsReport: jest.fn(),
  cleanupTrackingSession: jest.fn()
}));

describe('useResourceTracking', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();
    
    // Setup default mock implementations
    (resourceTrackingActions.createTrackingSession as jest.Mock).mockResolvedValue('test-session-id');
    (resourceTrackingActions.trackResourceAccess as jest.Mock).mockResolvedValue(undefined);
    (resourceTrackingActions.prioritizeResourcesForContext as jest.Mock).mockResolvedValue(['/path/to/file1.ts', '/path/to/file2.md']);
    (resourceTrackingActions.generateMetricsReport as jest.Mock).mockResolvedValue(
      `# Session Resource Metrics

## Overview
- Session ID: test-session-id
- Total Resources: 5
- Included in Context: 2
- Total Tokens: 1200

## Top Resources by Importance
- /path/to/file1.ts (Importance: 80, Tokens: 500)
- /path/to/file2.md (Importance: 60, Tokens: 700)
`
    );
  });

  it('should initialize with default values', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useResourceTracking());
    
    // Initial state
    expect(result.current.sessionId).toBeNull();
    expect(result.current.resources).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Should have called createTrackingSession
    expect(resourceTrackingActions.createTrackingSession).toHaveBeenCalledWith(8000, 'Resource tracking session');
    
    // Updated state after initialization
    expect(result.current.sessionId).toBe('test-session-id');
    expect(result.current.isLoading).toBe(false);
  });

  it('should use custom options if provided', async () => {
    const customOptions = {
      tokenBudget: 16000,
      sessionSummary: 'Custom session',
      autoCleanup: false
    };
    
    const { result, waitForNextUpdate } = renderHook(() => 
      useResourceTracking(customOptions)
    );
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Should have called createTrackingSession with custom options
    expect(resourceTrackingActions.createTrackingSession).toHaveBeenCalledWith(
      customOptions.tokenBudget,
      customOptions.sessionSummary
    );
  });

  it('should track resource access', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useResourceTracking());
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Track resource access
    await act(async () => {
      await result.current.trackAccess(
        '/path/to/file.ts',
        'edit',
        { size: 1024, modified: true }
      );
    });
    
    // Should have called trackResourceAccess
    expect(resourceTrackingActions.trackResourceAccess).toHaveBeenCalledWith(
      'test-session-id',
      '/path/to/file.ts',
      'edit',
      { size: 1024, modified: true }
    );
  });

  it('should prioritize resources', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useResourceTracking());
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Mock the parsing of resources from the report
    (resourceTrackingActions.generateMetricsReport as jest.Mock).mockResolvedValue(
      `# Session Resource Metrics

## Overview
- Session ID: test-session-id
- Total Resources: 3
- Included in Context: 2
- Total Tokens: 1500

## Top Resources by Importance
- /path/to/file1.ts (Importance: 85, Tokens: 500)
- /path/to/file2.md (Importance: 65, Tokens: 1000)
- /path/to/file3.json (Importance: 45, Tokens: 300)
`
    );
    
    // Prioritize resources
    await act(async () => {
      await result.current.prioritizeResources();
    });
    
    // Should have called prioritizeResourcesForContext
    expect(resourceTrackingActions.prioritizeResourcesForContext).toHaveBeenCalledWith(
      'test-session-id',
      8000 // default token budget
    );
    
    // Should have called generateMetricsReport to get resource details
    expect(resourceTrackingActions.generateMetricsReport).toHaveBeenCalledWith('test-session-id');
    
    // Should have parsed resources from the report
    expect(result.current.resources).toHaveLength(3);
    expect(result.current.resources[0].path).toBe('/path/to/file1.ts');
    expect(result.current.resources[0].importance).toBe(85);
    expect(result.current.resources[0].tokenCount).toBe(500);
    expect(result.current.resources[0].included).toBe(true); // Should be included based on prioritizeResourcesForContext mock
  });

  it('should handle errors when creating a session', async () => {
    // Mock createTrackingSession to throw an error
    (resourceTrackingActions.createTrackingSession as jest.Mock).mockRejectedValue(
      new Error('Failed to create session')
    );
    
    const { result, waitForNextUpdate } = renderHook(() => useResourceTracking());
    
    // Wait for initialization to complete (error state)
    await waitForNextUpdate();
    
    // Should have an error
    expect(result.current.error).toBe('Failed to create session: Failed to create session');
    expect(result.current.sessionId).toBeNull();
  });

  it('should handle errors when tracking access', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useResourceTracking());
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Mock trackResourceAccess to throw an error
    (resourceTrackingActions.trackResourceAccess as jest.Mock).mockRejectedValue(
      new Error('Failed to track resource')
    );
    
    // Track resource access
    await act(async () => {
      await result.current.trackAccess('/path/to/file.ts', 'view');
    });
    
    // Should have an error
    expect(result.current.error).toBe('Failed to track resource: Failed to track resource');
  });

  it('should clean up on unmount if autoCleanup is true', async () => {
    const { result, waitForNextUpdate, unmount } = renderHook(() => 
      useResourceTracking({ autoCleanup: true })
    );
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Unmount the hook
    unmount();
    
    // Should have called cleanupTrackingSession
    expect(resourceTrackingActions.cleanupTrackingSession).toHaveBeenCalledWith('test-session-id');
  });

  it('should not clean up on unmount if autoCleanup is false', async () => {
    const { result, waitForNextUpdate, unmount } = renderHook(() => 
      useResourceTracking({ autoCleanup: false })
    );
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Unmount the hook
    unmount();
    
    // Should not have called cleanupTrackingSession
    expect(resourceTrackingActions.cleanupTrackingSession).not.toHaveBeenCalled();
  });

  it('should provide context info', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useResourceTracking({
      tokenBudget: 10000
    }));
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Set up some resources
    await act(async () => {
      (resourceTrackingActions.generateMetricsReport as jest.Mock).mockResolvedValue(
        `# Session Resource Metrics
  
  ## Overview
  - Session ID: test-session-id
  - Total Resources: 3
  - Included in Context: 2
  - Total Tokens: 1500
  
  ## Top Resources by Importance
  - /path/to/file1.ts (Importance: 85, Tokens: 500)
  - /path/to/file2.md (Importance: 65, Tokens: 1000)
  - /path/to/file3.json (Importance: 45, Tokens: 300)
  `
      );
      await result.current.prioritizeResources();
    });
    
    // Get context info
    const contextInfo = result.current.getContextInfo();
    
    // Verify context info
    expect(contextInfo.sessionId).toBe('test-session-id');
    expect(contextInfo.resources).toHaveLength(3);
    expect(contextInfo.tokenBudget).toBe(10000);
    expect(contextInfo.isLoading).toBe(false);
    expect(contextInfo.error).toBeNull();
  });

  it('should handle parsing errors gracefully when processing metrics report', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useResourceTracking());
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Mock generateMetricsReport to return a malformed report
    (resourceTrackingActions.generateMetricsReport as jest.Mock).mockResolvedValue(
      `# Malformed report
      This doesn't have the expected format
      `
    );
    
    // Should still run without throwing, but resources will be empty
    await act(async () => {
      await result.current.prioritizeResources();
    });
    
    // Resources should be empty because parsing failed
    expect(result.current.resources).toHaveLength(0);
    
    // But no error should be set (parsing errors are handled gracefully)
    expect(result.current.error).toBeNull();
  });
  
  it('should respect the session ID when tracking resources', async () => {
    // Create hook with a predefined session ID
    const { result, waitForNextUpdate } = renderHook(() => useResourceTracking());
    
    // Wait for initialization to complete
    await waitForNextUpdate();
    
    // Track a resource
    await act(async () => {
      await result.current.trackAccess('/path/to/important.js', 'view');
    });
    
    // Verify the session ID was used
    expect(resourceTrackingActions.trackResourceAccess).toHaveBeenCalledWith(
      'test-session-id',
      '/path/to/important.js',
      'view',
      {}
    );
  });
});
