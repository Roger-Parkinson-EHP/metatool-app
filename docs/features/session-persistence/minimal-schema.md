# Minimal Session Persistence Schema

## Overview

This document outlines the minimal database schema changes required to support resource-aware token management in MetaMCP. These updates take a pragmatic approach, focusing on essential functionality while enabling future expansion.

## Core Tables

### Resources Table

The resources table tracks files and other content referenced during sessions:

```typescript
export const resourcesTable = pgTable('resources', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  path: text('path').notNull(),
  type: text('type').notNull(), // CODE, DOCUMENTATION, DATA, etc.
  size: integer('size'),
  token_count: integer('token_count'),
  last_accessed: timestamp('last_accessed', { withTimezone: true })
    .notNull()
    .defaultNow(),
  access_count: integer('access_count').notNull().default(0),
  modified_during_session: boolean('modified_during_session').notNull().default(false),
  content_hash: text('content_hash'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
},
(table) => [index('resources_path_idx').on(table.path)])
```

### Sessions Table

The sessions table tracks token-limited interaction sessions with the AI:

```typescript
export const sessionsTable = pgTable('sessions', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  profile_uuid: uuid('profile_uuid')
    .references(() => profilesTable.uuid),
  token_count: integer('token_count').notNull(),
  summary: text('summary'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  parent_session_uuid: uuid('parent_session_uuid')
    .references((): AnyPgColumn => sessionsTable.uuid),
})
```

### Resource Access Logs Table

Tracks resource access events for analysis:

```typescript
export const resourceAccessLogsTable = pgTable('resource_access_logs', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  resource_uuid: uuid('resource_uuid')
    .notNull()
    .references(() => resourcesTable.uuid),
  session_uuid: uuid('session_uuid')
    .notNull()
    .references(() => sessionsTable.uuid),
  access_type: text('access_type').notNull(), // VIEW, EDIT, EXECUTE, REFERENCE
  timestamp: timestamp('timestamp', { withTimezone: true })
    .notNull()
    .defaultNow(),
},
(table) => [index('resource_access_logs_resource_uuid_idx').on(table.resource_uuid)])
```

### Session Resources Table

Links sessions to their relevant resources:

```typescript
export const sessionResourcesTable = pgTable('session_resources', {
  session_uuid: uuid('session_uuid')
    .notNull()
    .references(() => sessionsTable.uuid),
  resource_uuid: uuid('resource_uuid')
    .notNull()
    .references(() => resourcesTable.uuid),
  importance_score: integer('importance_score').notNull().default(0),
  included_in_context: boolean('included_in_context').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  primary key(session_uuid, resource_uuid),
},
(table) => [index('session_resources_resource_uuid_idx').on(table.resource_uuid)])
```

## Migration Strategy

The migration will be implemented in a single, atomic Drizzle migration:

```typescript
import { sql } from 'drizzle-orm';
import { pgTable, text, uuid, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export async function up(db) {
  // Create resources table
  await db.schema
    .createTable('resources')
    .addColumn('uuid', 'uuid', (col) => col.primaryKey().defaultRandom())
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('size', 'integer')
    .addColumn('token_count', 'integer')
    .addColumn('last_accessed', 'timestamp with time zone', (col) => 
      col.notNull().defaultNow())
    .addColumn('access_count', 'integer', (col) => col.notNull().default(0))
    .addColumn('modified_during_session', 'boolean', (col) => 
      col.notNull().default(false))
    .addColumn('content_hash', 'text')
    .addColumn('created_at', 'timestamp with time zone', (col) => 
      col.notNull().defaultNow())
    .execute();

  // Create index on path
  await db.schema
    .createIndex('resources_path_idx')
    .on('resources')
    .column('path')
    .execute();

  // Create sessions table
  await db.schema
    .createTable('sessions')
    .addColumn('uuid', 'uuid', (col) => col.primaryKey().defaultRandom())
    .addColumn('profile_uuid', 'uuid', (col) => 
      col.references('profiles.uuid'))
    .addColumn('token_count', 'integer', (col) => col.notNull())
    .addColumn('summary', 'text')
    .addColumn('created_at', 'timestamp with time zone', (col) => 
      col.notNull().defaultNow())
    .addColumn('parent_session_uuid', 'uuid', (col) => 
      col.references('sessions.uuid'))
    .execute();

  // Create resource_access_logs table
  await db.schema
    .createTable('resource_access_logs')
    .addColumn('uuid', 'uuid', (col) => col.primaryKey().defaultRandom())
    .addColumn('resource_uuid', 'uuid', (col) => 
      col.notNull().references('resources.uuid'))
    .addColumn('session_uuid', 'uuid', (col) => 
      col.notNull().references('sessions.uuid'))
    .addColumn('access_type', 'text', (col) => col.notNull())
    .addColumn('timestamp', 'timestamp with time zone', (col) => 
      col.notNull().defaultNow())
    .execute();

  // Create index on resource_uuid
  await db.schema
    .createIndex('resource_access_logs_resource_uuid_idx')
    .on('resource_access_logs')
    .column('resource_uuid')
    .execute();

  // Create session_resources table
  await db.schema
    .createTable('session_resources')
    .addColumn('session_uuid', 'uuid', (col) => 
      col.notNull().references('sessions.uuid'))
    .addColumn('resource_uuid', 'uuid', (col) => 
      col.notNull().references('resources.uuid'))
    .addColumn('importance_score', 'integer', (col) => col.notNull().default(0))
    .addColumn('included_in_context', 'boolean', (col) => col.notNull().default(false))
    .addColumn('created_at', 'timestamp with time zone', (col) => 
      col.notNull().defaultNow())
    .addPrimaryKeyConstraint('session_resources_pkey', ['session_uuid', 'resource_uuid'])
    .execute();

  // Create index on resource_uuid
  await db.schema
    .createIndex('session_resources_resource_uuid_idx')
    .on('session_resources')
    .column('resource_uuid')
    .execute();
}

export async function down(db) {
  await db.schema.dropTable('session_resources').execute();
  await db.schema.dropTable('resource_access_logs').execute();
  await db.schema.dropTable('sessions').execute();
  await db.schema.dropTable('resources').execute();
}
```

## TypeScript Interfaces

These interfaces represent the core entities:

```typescript
export interface Resource {
  uuid: string;
  path: string;
  type: string;
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
  accessType: string; // 'VIEW' | 'EDIT' | 'EXECUTE' | 'REFERENCE'
  timestamp: Date;
}

export interface SessionResource {
  sessionUuid: string;
  resourceUuid: string;
  importanceScore: number;
  includedInContext: boolean;
  createdAt: Date;
}
```

## Initial API Methods

These core methods provide the essential functionality:

```typescript
// Resource tracking
const resourceService = {
  // Add or update a resource
  async trackResource(resource: Omit<Resource, 'uuid' | 'createdAt'>): Promise<string> {
    // Find existing resource by path or create new
    const existingResource = await db.query.resourcesTable.findFirst({
      where: eq(resourcesTable.path, resource.path)
    });
    
    if (existingResource) {
      // Update existing resource
      await db.update(resourcesTable)
        .set({
          accessCount: existingResource.access_count + 1,
          lastAccessed: new Date(),
          modifiedDuringSession: resource.modifiedDuringSession || existingResource.modified_during_session,
          size: resource.size || existingResource.size,
          tokenCount: resource.tokenCount || existingResource.token_count,
          contentHash: resource.contentHash || existingResource.content_hash
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
  },
  
  // Log resource access
  async logAccess({
    resourceUuid,
    sessionUuid,
    accessType
  }: {
    resourceUuid: string;
    sessionUuid: string;
    accessType: string;
  }): Promise<void> {
    await db.insert(resourceAccessLogsTable)
      .values({
        resource_uuid: resourceUuid,
        session_uuid: sessionUuid,
        access_type: accessType
      });
  },
  
  // Get most accessed resources
  async getMostAccessedResources(limit: number = 10): Promise<Resource[]> {
    const resources = await db.query.resourcesTable.findMany({
      orderBy: [desc(resourcesTable.access_count)],
      limit
    });
    
    return resources.map(mapDbResourceToResource);
  },
  
  // Get most recent resources
  async getMostRecentResources(limit: number = 10): Promise<Resource[]> {
    const resources = await db.query.resourcesTable.findMany({
      orderBy: [desc(resourcesTable.last_accessed)],
      limit
    });
    
    return resources.map(mapDbResourceToResource);
  }
};

// Session management
const sessionService = {
  // Create a new session
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
  },
  
  // Link resources to a session
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
    await db.insert(sessionResourcesTable)
      .values(
        resources.map(resource => ({
          session_uuid: sessionUuid,
          resource_uuid: resource.resourceUuid,
          importance_score: resource.importanceScore,
          included_in_context: resource.includedInContext
        }))
      );
  },
  
  // Get resources for a session
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
  },
  
  // Get session chain (parent sessions)
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
};

// Helper mapping functions
function mapDbResourceToResource(dbResource: any): Resource {
  return {
    uuid: dbResource.uuid,
    path: dbResource.path,
    type: dbResource.type,
    size: dbResource.size,
    tokenCount: dbResource.token_count,
    lastAccessed: dbResource.last_accessed,
    accessCount: dbResource.access_count,
    modifiedDuringSession: dbResource.modified_during_session,
    contentHash: dbResource.content_hash,
    createdAt: dbResource.created_at
  };
}

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
```

## Implementation Plan

The schema implementation will proceed in these steps:

1. **Create Migration Script**: Generate the Drizzle migration for the new tables
2. **Implement Core Services**: Build the resource tracking and session management services
3. **Add File Tracking Hooks**: Set up handlers to track file access in the application
4. **Create Basic Visualization**: Implement a simple UI to show tracked resources
5. **Add Token Counting**: Implement token counting for different resource types

## Future Expansion

This minimal schema provides the foundation for future enhancements:

- **Resource Content Storage**: Add capability to store compressed resource content
- **Dependency Tracking**: Add tables to track relationships between resources
- **Enhanced Prioritization**: Store additional metrics for better importance calculation
- **Workspace Context**: Add tables to store workspace state for context restoration

## Conclusion

This focused schema provides the essential structure needed to begin tracking resources and their usage patterns while keeping the implementation simple and maintainable. By starting with these core tables, we can immediately begin collecting valuable data about resource usage while setting the foundation for more advanced features in the future.
