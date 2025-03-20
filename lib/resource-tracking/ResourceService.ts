/**
 * Resource Service
 * 
 * Provides database operations for resource-aware token management.
 * This service handles persistence of resources, access logs, and session metadata.
 */

import { db } from '../../db';
import { eq, desc } from 'drizzle-orm';
import { resourcesTable, resourceAccessLogsTable, sessionResourcesTable, sessionsTable } from '../../db/schema';
import { ResourceType, AccessType } from './ResourceTracker';

export interface Resource {
  uuid: string;
  path: string;
  type: ResourceType;
  size?: number;
  tokenCount?: number;
  lastAccessed: Date;
  accessCount: number;
  modifiedDuringSession: boolean;
  contentHash?: string;
  createdAt: Date;
}

export interface Session {
  uuid: string;
  profileUuid?: string;
  tokenCount: number;
  summary?: string;
  createdAt: Date;
  parentSessionUuid?: string;
}

export interface ResourceAccessLog {
  uuid: string;
  resourceUuid: string;
  sessionUuid: string;
  accessType: AccessType;
  timestamp: Date;
}

export interface SessionResource {
  sessionUuid: string;
  resourceUuid: string;
  importanceScore: number;
  includedInContext: boolean;
  createdAt: Date;
}

/**
 * Service for managing resources and their persistence.
 */
export class ResourceService {
  /**
   * Adds or updates a resource in the database.
   * 
   * @param resource The resource to track
   * @returns The UUID of the tracked resource
   */
  async trackResource(resource: Omit<Resource, 'uuid' | 'createdAt'>): Promise<string> {
    // Find existing resource by path or create new
    const existingResource = await db.query.resourcesTable.findFirst({
      where: eq(resourcesTable.path, resource.path)
    });
    
    if (existingResource) {
      // Update existing resource
      await db.update(resourcesTable)
        .set({
          access_count: existingResource.access_count + 1,
          last_accessed: new Date(),
          modified_during_session: resource.modifiedDuringSession || existingResource.modified_during_session,
          size: resource.size || existingResource.size,
          token_count: resource.tokenCount || existingResource.token_count,
          content_hash: resource.contentHash || existingResource.content_hash
        })
        .where(eq(resourcesTable.uuid, existingResource.uuid));
        
      return existingResource.uuid;
    } else {
      // Insert new resource
      const [newResource] = await db.insert(resourcesTable)
        .values({
          path: resource.path,
          type: resource.type,
          size: resource.size,
          token_count: resource.tokenCount,
          last_accessed: new Date(),
          access_count: 1,
          modified_during_session: resource.modifiedDuringSession || false,
          content_hash: resource.contentHash
        })
        .returning();
        
      return newResource.uuid;
    }
  }
  
  /**
   * Logs a resource access event.
   * 
   * @param resourceUuid UUID of the accessed resource
   * @param sessionUuid UUID of the current session
   * @param accessType Type of access (view, edit, etc.)
   */
  async logAccess({
    resourceUuid,
    sessionUuid,
    accessType
  }: {
    resourceUuid: string;
    sessionUuid: string;
    accessType: AccessType;
  }): Promise<void> {
    await db.insert(resourceAccessLogsTable)
      .values({
        resource_uuid: resourceUuid,
        session_uuid: sessionUuid,
        access_type: accessType
      });
  }
  
  /**
   * Creates a new session.
   * 
   * @param session Session details
   * @returns UUID of the created session
   */
  async createSession(session: Omit<Session, 'uuid' | 'createdAt'>): Promise<string> {
    const [newSession] = await db.insert(sessionsTable)
      .values({
        profile_uuid: session.profileUuid,
        token_count: session.tokenCount,
        summary: session.summary,
        parent_session_uuid: session.parentSessionUuid
      })
      .returning();
      
    return newSession.uuid;
  }
  
  /**
   * Links resources to a session with importance scores.
   * 
   * @param sessionUuid UUID of the session
   * @param resources Array of resources with importance scores
   */
  async linkResourcesToSession({
    sessionUuid,
    resources
  }: {
    sessionUuid: string;
    resources: Array<{
      resourceUuid: string;
      importanceScore: number;
      includedInContext: boolean;
    }>;
  }): Promise<void> {
    // Batch insert all session resources
    if (resources.length > 0) {
      await db.insert(sessionResourcesTable)
        .values(
          resources.map(resource => ({
            session_uuid: sessionUuid,
            resource_uuid: resource.resourceUuid,
            importance_score: resource.importanceScore,
            included_in_context: resource.includedInContext
          }))
        );
    }
  }
  
  /**
   * Gets most frequently accessed resources.
   * 
   * @param limit Maximum number of resources to return
   * @returns Array of resources sorted by access count
   */
  async getMostAccessedResources(limit: number = 10): Promise<Resource[]> {
    const resources = await db.query.resourcesTable.findMany({
      orderBy: [desc(resourcesTable.access_count)],
      limit
    });
    
    return resources.map(mapDbResourceToResource);
  }
  
  /**
   * Gets most recently accessed resources.
   * 
   * @param limit Maximum number of resources to return
   * @returns Array of resources sorted by last access time
   */
  async getMostRecentResources(limit: number = 10): Promise<Resource[]> {
    const resources = await db.query.resourcesTable.findMany({
      orderBy: [desc(resourcesTable.last_accessed)],
      limit
    });
    
    return resources.map(mapDbResourceToResource);
  }
  
  /**
   * Gets resources for a specific session.
   * 
   * @param sessionUuid Session UUID
   * @returns Resources linked to the session with importance scores
   */
  async getSessionResources(sessionUuid: string): Promise<Array<Resource & { importanceScore: number }>> {
    const sessionResources = await db.query.sessionResourcesTable.findMany({
      where: eq(sessionResourcesTable.session_uuid, sessionUuid),
      with: {
        resource: true
      }
    });
    
    return sessionResources.map(sr => ({
      ...mapDbResourceToResource(sr.resource),
      importanceScore: sr.importance_score
    }));
  }
  
  /**
   * Gets a session chain (ancestors) starting from the given session.
   * 
   * @param sessionUuid Starting session UUID
   * @returns Array of sessions in the chain, from most recent to oldest
   */
  async getSessionChain(sessionUuid: string): Promise<Session[]> {
    const sessions = [];
    let currentSessionUuid = sessionUuid;
    
    while (currentSessionUuid) {
      const session = await db.query.sessionsTable.findFirst({
        where: eq(sessionsTable.uuid, currentSessionUuid)
      });
      
      if (!session) break;
      
      sessions.push(mapDbSessionToSession(session));
      currentSessionUuid = session.parent_session_uuid || '';
    }
    
    return sessions;
  }
  
  /**
   * Gets session descendants (child sessions) of the given session.
   * 
   * @param sessionUuid Session UUID
   * @returns Array of child sessions
   */
  async getSessionDescendants(sessionUuid: string): Promise<Session[]> {
    const sessions = await db.query.sessionsTable.findMany({
      where: eq(sessionsTable.parent_session_uuid, sessionUuid),
      orderBy: [desc(sessionsTable.created_at)]
    });
    
    return sessions.map(mapDbSessionToSession);
  }
  
  /**
   * Gets resource access logs for a specific resource.
   * 
   * @param resourceUuid Resource UUID
   * @param limit Maximum number of logs to return
   * @returns Array of access logs, most recent first
   */
  async getResourceAccessLogs(resourceUuid: string, limit: number = 100): Promise<ResourceAccessLog[]> {
    const logs = await db.query.resourceAccessLogsTable.findMany({
      where: eq(resourceAccessLogsTable.resource_uuid, resourceUuid),
      orderBy: [desc(resourceAccessLogsTable.timestamp)],
      limit
    });
    
    return logs.map(log => ({
      uuid: log.uuid,
      resourceUuid: log.resource_uuid,
      sessionUuid: log.session_uuid,
      accessType: log.access_type as AccessType,
      timestamp: log.timestamp
    }));
  }
  
  /**
   * Gets a resource by its path.
   * 
   * @param path Resource path
   * @returns The resource or null if not found
   */
  async getResourceByPath(path: string): Promise<Resource | null> {
    const resource = await db.query.resourcesTable.findFirst({
      where: eq(resourcesTable.path, path)
    });
    
    return resource ? mapDbResourceToResource(resource) : null;
  }
  
  /**
   * Gets a resource by its UUID.
   * 
   * @param uuid Resource UUID
   * @returns The resource or null if not found
   */
  async getResourceById(uuid: string): Promise<Resource | null> {
    const resource = await db.query.resourcesTable.findFirst({
      where: eq(resourcesTable.uuid, uuid)
    });
    
    return resource ? mapDbResourceToResource(resource) : null;
  }
  
  /**
   * Gets a session by its UUID.
   * 
   * @param uuid Session UUID
   * @returns The session or null if not found
   */
  async getSessionById(uuid: string): Promise<Session | null> {
    const session = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.uuid, uuid)
    });
    
    return session ? mapDbSessionToSession(session) : null;
  }
  
  /**
   * Gets resources of a specific type.
   * 
   * @param type Resource type
   * @param limit Maximum number of resources to return
   * @returns Array of resources of the specified type
   */
  async getResourcesByType(type: ResourceType, limit: number = 100): Promise<Resource[]> {
    const resources = await db.query.resourcesTable.findMany({
      where: eq(resourcesTable.type, type),
      orderBy: [desc(resourcesTable.last_accessed)],
      limit
    });
    
    return resources.map(mapDbResourceToResource);
  }
  
  /**
   * Updates the importance score for a resource in a session.
   * 
   * @param sessionUuid Session UUID
   * @param resourceUuid Resource UUID
   * @param importanceScore New importance score
   */
  async updateResourceImportance({
    sessionUuid,
    resourceUuid,
    importanceScore
  }: {
    sessionUuid: string;
    resourceUuid: string;
    importanceScore: number;
  }): Promise<void> {
    await db.update(sessionResourcesTable)
      .set({ importance_score: importanceScore })
      .where(
        eq(sessionResourcesTable.session_uuid, sessionUuid) &&
        eq(sessionResourcesTable.resource_uuid, resourceUuid)
      );
  }
  
  /**
   * Marks a resource as included or excluded from the context.
   * 
   * @param sessionUuid Session UUID
   * @param resourceUuid Resource UUID
   * @param included Whether the resource is included in the context
   */
  async setResourceIncludedInContext({
    sessionUuid,
    resourceUuid,
    included
  }: {
    sessionUuid: string;
    resourceUuid: string;
    included: boolean;
  }): Promise<void> {
    await db.update(sessionResourcesTable)
      .set({ included_in_context: included })
      .where(
        eq(sessionResourcesTable.session_uuid, sessionUuid) &&
        eq(sessionResourcesTable.resource_uuid, resourceUuid)
      );
  }
}

/**
 * Maps a database resource record to a Resource object.
 */
function mapDbResourceToResource(dbResource: any): Resource {
  return {
    uuid: dbResource.uuid,
    path: dbResource.path,
    type: dbResource.type as ResourceType,
    size: dbResource.size,
    tokenCount: dbResource.token_count,
    lastAccessed: dbResource.last_accessed,
    accessCount: dbResource.access_count,
    modifiedDuringSession: dbResource.modified_during_session,
    contentHash: dbResource.content_hash,
    createdAt: dbResource.created_at
  };
}

/**
 * Maps a database session record to a Session object.
 */
function mapDbSessionToSession(dbSession: any): Session {
  return {
    uuid: dbSession.uuid,
    profileUuid: dbSession.profile_uuid,
    tokenCount: dbSession.token_count,
    summary: dbSession.summary,
    createdAt: dbSession.created_at,
    parentSessionUuid: dbSession.parent_session_uuid
  };
}
