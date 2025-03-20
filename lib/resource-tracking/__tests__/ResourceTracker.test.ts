/**
 * ResourceTracker Tests
 * 
 * Comprehensive tests for the ResourceTracker component, covering tracking,
 * importance calculation, and resource prioritization.
 */

import { ResourceTracker, AccessType, ResourceType } from '../ResourceTracker';
import { createTestAccessSequence, withMockTime } from './test-utils';

describe('ResourceTracker', () => {
  let tracker: ResourceTracker;
  const sessionId = 'test-session-id';

  beforeEach(() => {
    tracker = new ResourceTracker();
    tracker.setSessionId(sessionId);
  });

  describe('Basic tracking functionality', () => {
    it('should track a resource access', () => {
      const path = '/project/src/main.ts';
      const type = ResourceType.CODE;
      const accessType = AccessType.VIEW;
      const metadata = { size: 1024 };

      tracker.trackAccess(path, type, accessType, metadata);

      const stats = tracker.getResourceStats(path);
      expect(stats).toBeDefined();
      expect(stats?.path).toBe(path);
      expect(stats?.type).toBe(type);
      expect(stats?.accessCount).toBe(1);
      expect(stats?.accessTypes.has(accessType)).toBe(true);
      expect(stats?.size).toBe(1024);
      expect(stats?.modified).toBe(false);
    });

    it('should track multiple accesses to the same resource', () => {
      const path = '/project/src/main.ts';
      
      tracker.trackAccess(path, ResourceType.CODE, AccessType.VIEW, { size: 1024 });
      tracker.trackAccess(path, ResourceType.CODE, AccessType.EDIT, { modified: true });
      tracker.trackAccess(path, ResourceType.CODE, AccessType.VIEW);

      const stats = tracker.getResourceStats(path);
      expect(stats?.accessCount).toBe(3);
      expect(stats?.accessTypes.size).toBe(2); // VIEW and EDIT
      expect(stats?.modified).toBe(true);
    });

    it('should normalize file paths', () => {
      // Test with both forward and backslashes
      tracker.trackAccess('/project/src/main.ts', ResourceType.CODE, AccessType.VIEW);
      tracker.trackAccess('\\project\\src\\main.ts', ResourceType.CODE, AccessType.VIEW);

      // Both should be tracked as the same resource
      const normalizedPath = '/project/src/main.ts';
      const stats = tracker.getResourceStats(normalizedPath);
      expect(stats?.accessCount).toBe(2);
    });
  });

  describe('Resource importance calculation', () => {
    it('should calculate importance based on recency', () => {
      withMockTime(() => {
        const path = '/project/src/main.ts';
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const now = new Date();

        // Mock Date.now for the test
        jest.spyOn(Date, 'now').mockImplementation(() => oneHourAgo.getTime());
        tracker.trackAccess(path, ResourceType.CODE, AccessType.VIEW);

        // Move time forward
        jest.spyOn(Date, 'now').mockImplementation(() => now.getTime());

        // The importance should be lower due to time passing
        const importance = tracker.getResourceImportance(path);
        
        // Restore Date.now
        jest.spyOn(Date, 'now').mockRestore();

        // Importance should be reduced due to time passing
        expect(importance).toBeLessThan(50);
      });
    });

    it('should calculate importance based on frequency', () => {
      const path = '/project/src/main.ts';
      
      // Access the resource multiple times
      for (let i = 0; i < 10; i++) {
        tracker.trackAccess(path, ResourceType.CODE, AccessType.VIEW);
      }

      const importance = tracker.getResourceImportance(path);
      
      // Frequency component should add to importance
      expect(importance).toBeGreaterThan(20); // At least frequency score
    });

    it('should give higher importance to modified resources', () => {
      const path1 = '/project/src/main.ts';
      const path2 = '/project/src/utils.ts';
      
      // Both viewed the same number of times, but main.ts is modified
      tracker.trackAccess(path1, ResourceType.CODE, AccessType.VIEW);
      tracker.trackAccess(path1, ResourceType.CODE, AccessType.EDIT, { modified: true });
      
      tracker.trackAccess(path2, ResourceType.CODE, AccessType.VIEW);
      tracker.trackAccess(path2, ResourceType.CODE, AccessType.VIEW);

      const importance1 = tracker.getResourceImportance(path1);
      const importance2 = tracker.getResourceImportance(path2);
      
      // Modified resource should have higher importance
      expect(importance1).toBeGreaterThan(importance2);
    });
  });

  describe('Resource prioritization', () => {
    it('should get most frequently accessed resources', () => {
      const resources = [
        { path: '/path1', count: 5 },
        { path: '/path2', count: 10 },
        { path: '/path3', count: 2 },
        { path: '/path4', count: 7 }
      ];

      // Track accesses
      for (const res of resources) {
        for (let i = 0; i < res.count; i++) {
          tracker.trackAccess(res.path, ResourceType.CODE, AccessType.VIEW);
        }
      }

      const mostFrequent = tracker.getMostFrequentResources(2);
      expect(mostFrequent.length).toBe(2);
      expect(mostFrequent[0].path).toBe('/path2'); // Most frequent
      expect(mostFrequent[1].path).toBe('/path4'); // Second most frequent
    });

    it('should get most recent resources', () => {
      withMockTime(() => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const now = new Date();

        // Track accesses at different times
        jest.spyOn(Date, 'now').mockImplementation(() => oneHourAgo.getTime());
        tracker.trackAccess('/path1', ResourceType.CODE, AccessType.VIEW);

        jest.spyOn(Date, 'now').mockImplementation(() => thirtyMinutesAgo.getTime());
        tracker.trackAccess('/path2', ResourceType.CODE, AccessType.VIEW);

        jest.spyOn(Date, 'now').mockImplementation(() => tenMinutesAgo.getTime());
        tracker.trackAccess('/path3', ResourceType.CODE, AccessType.VIEW);

        jest.spyOn(Date, 'now').mockImplementation(() => now.getTime());
        tracker.trackAccess('/path4', ResourceType.CODE, AccessType.VIEW);

        const mostRecent = tracker.getMostRecentResources(2);
        
        // Restore Date.now
        jest.spyOn(Date, 'now').mockRestore();

        expect(mostRecent.length).toBe(2);
        expect(mostRecent[0].path).toBe('/path4'); // Most recent
        expect(mostRecent[1].path).toBe('/path3'); // Second most recent
      });
    });

    it('should prioritize resources by importance', () => {
      // Create a realistic access sequence
      const accessSequence = createTestAccessSequence();
      
      // Apply all accesses with their timestamps
      for (const access of accessSequence) {
        jest.spyOn(Date, 'now').mockImplementation(() => access.timestamp.getTime());
        tracker.trackAccess(access.path, access.type, access.accessType, access.metadata);
      }
      
      // Get important resource paths
      const importantPaths = tracker.getImportantResourcePaths();
      
      // Restore Date.now
      jest.spyOn(Date, 'now').mockRestore();
      
      // Most recently edited files should be most important
      expect(importantPaths.length).toBeGreaterThan(0);
      expect(importantPaths[0]).toBe('/project/src/components/Button.tsx'); // Most recently edited
      expect(importantPaths[1]).toBe('/project/src/main.ts'); // Second most recently edited and accessed multiple times
    });
  });

  describe('Event emission', () => {
    it('should emit events when tracking resources', () => {
      const mockListener = jest.fn();
      tracker.on('resourceAccess', mockListener);

      const path = '/project/src/main.ts';
      const type = ResourceType.CODE;
      const accessType = AccessType.VIEW;
      const metadata = { size: 1024 };

      tracker.trackAccess(path, type, accessType, metadata);

      expect(mockListener).toHaveBeenCalledWith({
        path,
        type,
        accessType,
        sessionId,
        timestamp: expect.any(Date),
        metadata
      });
    });

    it('should emit clear event when clearing', () => {
      const mockListener = jest.fn();
      tracker.on('clear', mockListener);

      // Add some resources first
      tracker.trackAccess('/path1', ResourceType.CODE, AccessType.VIEW);
      tracker.trackAccess('/path2', ResourceType.DOCUMENTATION, AccessType.VIEW);

      // Clear the tracker
      tracker.clear();

      expect(mockListener).toHaveBeenCalled();
      expect(tracker.getAllResources().length).toBe(0);
    });
  });

  describe('Type-specific functions', () => {
    it('should get resources by type', () => {
      // Add resources of different types
      tracker.trackAccess('/code1.ts', ResourceType.CODE, AccessType.VIEW);
      tracker.trackAccess('/code2.ts', ResourceType.CODE, AccessType.VIEW);
      tracker.trackAccess('/doc1.md', ResourceType.DOCUMENTATION, AccessType.VIEW);
      tracker.trackAccess('/data1.json', ResourceType.DATA, AccessType.VIEW);

      const codeResources = tracker.getResourcesByType(ResourceType.CODE);
      expect(codeResources.length).toBe(2);
      expect(codeResources[0].path).toBe('/code1.ts');
      expect(codeResources[1].path).toBe('/code2.ts');
    });

    it('should get modified resources', () => {
      // Add some modified and unmodified resources
      tracker.trackAccess('/file1.ts', ResourceType.CODE, AccessType.VIEW);
      tracker.trackAccess('/file2.ts', ResourceType.CODE, AccessType.EDIT, { modified: true });
      tracker.trackAccess('/file3.ts', ResourceType.CODE, AccessType.VIEW);
      tracker.trackAccess('/file4.ts', ResourceType.CODE, AccessType.EDIT, { modified: true });

      const modifiedResources = tracker.getModifiedResources();
      expect(modifiedResources.length).toBe(2);
      expect(modifiedResources[0].path).toBe('/file2.ts');
      expect(modifiedResources[1].path).toBe('/file4.ts');
    });
  });

  describe('Edge cases', () => {
    it('should handle non-existent resources gracefully', () => {
      const stats = tracker.getResourceStats('/non-existent-path');
      expect(stats).toBeUndefined();

      const importance = tracker.getResourceImportance('/non-existent-path');
      expect(importance).toBe(0);
    });

    it('should handle empty resource stats', () => {
      // Get most frequent when there are no resources
      const mostFrequent = tracker.getMostFrequentResources();
      expect(mostFrequent).toEqual([]);

      // Get most recent when there are no resources
      const mostRecent = tracker.getMostRecentResources();
      expect(mostRecent).toEqual([]);

      // Get important paths when there are no resources
      const importantPaths = tracker.getImportantResourcePaths();
      expect(importantPaths).toEqual([]);
    });
  });
});
