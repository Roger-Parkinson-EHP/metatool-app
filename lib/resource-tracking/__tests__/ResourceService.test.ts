/**
 * ResourceService Tests
 * 
 * Comprehensive tests for the ResourceService component, covering database interactions,
 * resource tracking, and session management.
 */

import { ResourceService } from '../ResourceService';
import { ResourceType, AccessType } from '../ResourceTracker';
import { db } from '../../../db';

// Mock database client
jest.mock('../../../db', () => ({
  db: {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ uuid: 'test-uuid' }])
      })
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ uuid: 'test-uuid' }])
        })
      })
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue([]),
          all: jest.fn().mockResolvedValue([])
        }),
        leftJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([]),
            all: jest.fn().mockResolvedValue([])
          })
        }),
        orderBy: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue([]),
          all: jest.fn().mockResolvedValue([])
        })
      })
    })
  },
  eq: jest.fn((column, value) => ({ column, operator: '=', value })),
  and: jest.fn((...conditions) => ({ type: 'AND', conditions })),
  desc: jest.fn((column) => ({ column, direction: 'desc' })),
  sql: jest.fn((text) => ({ text })),
}));

describe('ResourceService', () => {
  let service: ResourceService;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    service = new ResourceService();
  });

  describe('createSession', () => {
    it('should create a new session in the database', async () => {
      const sessionData = {
        tokenCount: 8000,
        summary: 'Test session'
      };

      // Configure mock return value
      (db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            uuid: 'new-session-uuid',
            token_count: 8000,
            summary: 'Test session',
            created_at: new Date()
          }])
        })
      });

      const sessionId = await service.createSession(sessionData);

      expect(db.insert).toHaveBeenCalled();
      expect(sessionId).toBe('new-session-uuid');
    });

    it('should handle database errors when creating session', async () => {
      const sessionData = {
        tokenCount: 8000,
        summary: 'Test session'
      };

      // Configure mock to throw error
      (db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(service.createSession(sessionData)).rejects.toThrow('Database error');
    });
  });

  describe('trackResource', () => {
    it('should create a new resource if it does not exist', async () => {
      const resourceData = {
        path: '/path/to/file.ts',
        type: ResourceType.CODE,
        size: 1024,
        lastAccessed: new Date(),
        accessCount: 1,
        modifiedDuringSession: false
      };

      // Configure select to return empty (resource not found)
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([])
          })
        })
      });

      // Configure insert to return new resource
      (db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            uuid: 'new-resource-uuid',
            path: '/path/to/file.ts',
            type: 'CODE',
            size: 1024,
            last_accessed: new Date(),
            access_count: 1,
            modified_during_session: false,
            created_at: new Date()
          }])
        })
      });

      const resourceId = await service.trackResource(resourceData);

      expect(db.select).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
      expect(resourceId).toBe('new-resource-uuid');
    });

    it('should update existing resource if it already exists', async () => {
      const resourceData = {
        path: '/path/to/file.ts',
        type: ResourceType.CODE,
        size: 1024,
        lastAccessed: new Date(),
        accessCount: 1,
        modifiedDuringSession: false
      };

      // Configure select to return existing resource
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([{
              uuid: 'existing-resource-uuid',
              path: '/path/to/file.ts',
              type: 'CODE',
              size: 512,  // Old size
              last_accessed: new Date(Date.now() - 3600000),  // Old timestamp
              access_count: 2,  // Old count
              modified_during_session: false,
              created_at: new Date(Date.now() - 86400000)
            }])
          })
        })
      });

      // Configure update to return updated resource
      (db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              uuid: 'existing-resource-uuid',
              path: '/path/to/file.ts',
              type: 'CODE',
              size: 1024,  // Updated size
              last_accessed: resourceData.lastAccessed,  // Updated timestamp
              access_count: 3,  // Incremented count
              modified_during_session: false,
              created_at: new Date(Date.now() - 86400000)
            }])
          })
        })
      });

      const resourceId = await service.trackResource(resourceData);

      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
      expect(resourceId).toBe('existing-resource-uuid');
    });

    it('should handle database errors when tracking resources', async () => {
      const resourceData = {
        path: '/path/to/file.ts',
        type: ResourceType.CODE,
        size: 1024,
        lastAccessed: new Date(),
        accessCount: 1,
        modifiedDuringSession: false
      };

      // Configure select to throw error
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      });

      await expect(service.trackResource(resourceData)).rejects.toThrow('Database error');
    });
  });

  describe('logAccess', () => {
    it('should log resource access to the database', async () => {
      const accessData = {
        resourceUuid: 'resource-uuid',
        sessionUuid: 'session-uuid',
        accessType: AccessType.VIEW
      };

      // Configure insert to return new access log
      (db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            uuid: 'access-log-uuid',
            resource_uuid: 'resource-uuid',
            session_uuid: 'session-uuid',
            access_type: 'VIEW',
            timestamp: new Date()
          }])
        })
      });

      await service.logAccess(accessData);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle database errors when logging access', async () => {
      const accessData = {
        resourceUuid: 'resource-uuid',
        sessionUuid: 'session-uuid',
        accessType: AccessType.VIEW
      };

      // Configure insert to throw error
      (db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(service.logAccess(accessData)).rejects.toThrow('Database error');
    });
  });

  describe('updateResourceImportance', () => {
    it('should update resource importance in the database', async () => {
      const importanceData = {
        sessionUuid: 'session-uuid',
        resourceUuid: 'resource-uuid',
        importanceScore: 75
      };

      // Configure select to return no existing record
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([])
          })
        })
      });

      // Configure insert to return new session resource record
      (db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            uuid: 'session-resource-uuid',
            session_uuid: 'session-uuid',
            resource_uuid: 'resource-uuid',
            importance_score: 75,
            included_in_context: false
          }])
        })
      });

      await service.updateResourceImportance(importanceData);

      expect(db.select).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    it('should update existing session resource record if it exists', async () => {
      const importanceData = {
        sessionUuid: 'session-uuid',
        resourceUuid: 'resource-uuid',
        importanceScore: 75
      };

      // Configure select to return existing record
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([{
              uuid: 'session-resource-uuid',
              session_uuid: 'session-uuid',
              resource_uuid: 'resource-uuid',
              importance_score: 50,  // Old score
              included_in_context: false
            }])
          })
        })
      });

      // Configure update to return updated record
      (db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              uuid: 'session-resource-uuid',
              session_uuid: 'session-uuid',
              resource_uuid: 'resource-uuid',
              importance_score: 75,  // Updated score
              included_in_context: false
            }])
          })
        })
      });

      await service.updateResourceImportance(importanceData);

      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('setResourceIncludedInContext', () => {
    it('should update included_in_context flag in the database', async () => {
      const contextData = {
        sessionUuid: 'session-uuid',
        resourceUuid: 'resource-uuid',
        included: true
      };

      // Configure select to return no existing record
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([])
          })
        })
      });

      // Configure insert to return new session resource record
      (db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            uuid: 'session-resource-uuid',
            session_uuid: 'session-uuid',
            resource_uuid: 'resource-uuid',
            importance_score: 0,
            included_in_context: true
          }])
        })
      });

      await service.setResourceIncludedInContext(contextData);

      expect(db.select).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('getResourceByPath', () => {
    it('should retrieve a resource by path', async () => {
      const path = '/path/to/file.ts';
      
      // Configure select to return a resource
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([{
              uuid: 'resource-uuid',
              path: '/path/to/file.ts',
              type: 'CODE',
              size: 1024,
              last_accessed: new Date(),
              access_count: 3,
              modified_during_session: false,
              created_at: new Date()
            }])
          })
        })
      });

      const resource = await service.getResourceByPath(path);

      expect(db.select).toHaveBeenCalled();
      expect(resource).toBeDefined();
      expect(resource?.uuid).toBe('resource-uuid');
      expect(resource?.path).toBe('/path/to/file.ts');
    });

    it('should return null if resource not found', async () => {
      const path = '/path/to/nonexistent.ts';
      
      // Configure select to return empty
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([])
          })
        })
      });

      const resource = await service.getResourceByPath(path);

      expect(db.select).toHaveBeenCalled();
      expect(resource).toBeNull();
    });
  });

  describe('getSessionResources', () => {
    it('should retrieve all resources for a session', async () => {
      const sessionId = 'session-uuid';
      
      // Configure select to return session resources
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              all: jest.fn().mockResolvedValue([
                {
                  uuid: 'resource-uuid-1',
                  path: '/path/to/file1.ts',
                  type: 'CODE',
                  size: 1024,
                  token_count: 500,
                  last_accessed: new Date(),
                  access_count: 5,
                  modified_during_session: true,
                  created_at: new Date(),
                  importance_score: 80,
                  included_in_context: true
                },
                {
                  uuid: 'resource-uuid-2',
                  path: '/path/to/file2.md',
                  type: 'DOCUMENTATION',
                  size: 2048,
                  token_count: 1000,
                  last_accessed: new Date(),
                  access_count: 3,
                  modified_during_session: false,
                  created_at: new Date(),
                  importance_score: 60,
                  included_in_context: true
                }
              ])
            })
          })
        })
      });

      const resources = await service.getSessionResources(sessionId);

      expect(db.select).toHaveBeenCalled();
      expect(resources).toHaveLength(2);
      expect(resources[0].path).toBe('/path/to/file1.ts');
      expect(resources[0].importanceScore).toBe(80);
      expect(resources[1].path).toBe('/path/to/file2.md');
      expect(resources[1].tokenCount).toBe(1000);
    });

    it('should return empty array if no resources for session', async () => {
      const sessionId = 'empty-session-uuid';
      
      // Configure select to return empty
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              all: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      const resources = await service.getSessionResources(sessionId);

      expect(db.select).toHaveBeenCalled();
      expect(resources).toHaveLength(0);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session and related records', async () => {
      const sessionId = 'session-uuid';
      
      // Mock delete operations
      const mockDelete = {
        where: jest.fn().mockResolvedValue({ rowCount: 1 })
      };
      
      (db.delete as jest.Mock) = jest.fn().mockReturnValue(mockDelete);

      await service.deleteSession(sessionId);

      // Should delete from session_resources and sessions tables
      expect(db.delete).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors when deleting session', async () => {
      const sessionId = 'session-uuid';
      
      // Mock delete operation with error
      const mockDelete = {
        where: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      
      (db.delete as jest.Mock) = jest.fn().mockReturnValue(mockDelete);

      await expect(service.deleteSession(sessionId)).rejects.toThrow('Database error');
    });
  });
});
