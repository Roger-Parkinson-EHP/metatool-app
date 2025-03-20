# Session Persistence Schema Updates

## Overview

This document outlines the schema changes required to support the enhanced resource-aware context management capabilities in the MetaMCP session persistence system. These changes aim to provide better tracking, prioritization, and management of resources across sessions.

## Proposed Schema Updates

### Resource Management Tables

```typescript
// Add to schema.ts

import { sql } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  AnyPgColumn,
  index,
} from 'drizzle-orm/pg-core';

export enum ResourceType {
  CODE = 'CODE',
  DOCUMENTATION = 'DOCUMENTATION',
  DATA = 'DATA',
  RESEARCH = 'RESEARCH',
  GENERATED = 'GENERATED',
}

export const resourceTypeEnum = pgEnum(
  'resource_type',
  enumToPgEnum(ResourceType)
);

export const sessionsTable = pgTable('sessions', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  profile_uuid: uuid('profile_uuid')
    .notNull()
    .references(() => profilesTable.uuid),
  workspace_id: text('workspace_id').notNull(),
  token_count: integer('token_count').notNull(),
  summary: text('summary'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  parent_session_uuid: uuid('parent_session_uuid').references((): AnyPgColumn => sessionsTable.uuid),
},
(table) => [index('sessions_profile_uuid_idx').on(table.profile_uuid)]
);

export const conversationsTable = pgTable('conversations', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  session_uuid: uuid('session_uuid')
    .notNull()
    .references(() => sessionsTable.uuid),
  context: text('context').notNull(),
  token_count: integer('token_count').notNull(),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
},
(table) => [index('conversations_session_uuid_idx').on(table.session_uuid)]
);

export const resourcesTable = pgTable('resources', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  path: text('path').notNull(),
  type: resourceTypeEnum('type').notNull(),
  size: integer('size').notNull(),
  token_count: integer('token_count').notNull(),
  last_accessed: timestamp('last_accessed', { withTimezone: true })
    .notNull()
    .defaultNow(),
  access_count: integer('access_count').notNull().default(0),
  modified_during_session: boolean('modified_during_session').notNull().default(false),
  content: text('content'),
  embedding: jsonb('embedding').$type<number[]>(),
  importance_score: integer('importance_score').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  hash: text('hash'),
},
(table) => [index('resources_path_idx').on(table.path),
          index('resources_type_idx').on(table.type)]
);

export const sessionResourcesTable = pgTable('session_resources', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  session_uuid: uuid('session_uuid')
    .notNull()
    .references(() => sessionsTable.uuid),
  resource_uuid: uuid('resource_uuid')
    .notNull()
    .references(() => resourcesTable.uuid),
  relevance_score: integer('relevance_score').notNull().default(0),
  included_in_context: boolean('included_in_context').notNull().default(false),
  compressed_content: text('compressed_content'),
  compressed_token_count: integer('compressed_token_count'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
},
(table) => [index('session_resources_session_uuid_idx').on(table.session_uuid),
          index('session_resources_resource_uuid_idx').on(table.resource_uuid)]
);

export const resourceDependenciesTable = pgTable('resource_dependencies', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  source_resource_uuid: uuid('source_resource_uuid')
    .notNull()
    .references(() => resourcesTable.uuid),
  target_resource_uuid: uuid('target_resource_uuid')
    .notNull()
    .references(() => resourcesTable.uuid),
  dependency_type: text('dependency_type').notNull(),
  strength: integer('strength').notNull().default(1),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
},
(table) => [index('resource_dependencies_source_idx').on(table.source_resource_uuid),
          index('resource_dependencies_target_idx').on(table.target_resource_uuid)]
);

export const resourceAccessLogsTable = pgTable('resource_access_logs', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  resource_uuid: uuid('resource_uuid')
    .notNull()
    .references(() => resourcesTable.uuid),
  session_uuid: uuid('session_uuid')
    .notNull()
    .references(() => sessionsTable.uuid),
  access_type: text('access_type').notNull(), // VIEWED, EDITED, EXECUTED, REFERENCED
  timestamp: timestamp('timestamp', { withTimezone: true })
    .notNull()
    .defaultNow(),
},
(table) => [index('resource_access_logs_resource_uuid_idx').on(table.resource_uuid),
          index('resource_access_logs_session_uuid_idx').on(table.session_uuid)]
);

export const workspaceStateTable = pgTable('workspace_states', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  session_uuid: uuid('session_uuid')
    .notNull()
    .references(() => sessionsTable.uuid),
  workspace_id: text('workspace_id').notNull(),
  active_project: text('active_project'),
  enabled_mcps: jsonb('enabled_mcps').$type<string[]>(),
  settings: jsonb('settings').$type<Record<string, unknown>>(),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
},
(table) => [index('workspace_states_session_uuid_idx').on(table.session_uuid)]
);
```

## Data Models

The new schema introduces several important data models for resource-aware context management:

### Sessions

The `sessionsTable` represents individual chat sessions with the LLM. It tracks:

- Basic metadata (profile, workspace, timestamps)
- Token usage information
- Parent-child relationships between sessions for continuity tracking
- A summary of the session content

### Conversations

The `conversationsTable` stores the actual conversation context for each session, including:

- The full text of the conversation
- Token count for the conversation
- Reference to the parent session

### Resources

The `resourcesTable` stores information about each resource that has been accessed or referenced:

- File path and content hash
- Resource type (code, documentation, data, etc.)
- Size and token count information
- Usage statistics (access count, last access time)
- Modification tracking during sessions
- Optional full content and vector embedding for semantic search
- Importance score calculated from various factors

### Session Resources

The `sessionResourcesTable` maps the relationship between sessions and resources:

- Links sessions to their relevant resources
- Tracks relevance scores for each resource in the context of the session
- Records whether the resource was included in the final context
- Stores compressed versions of resource content for token efficiency
- Tracks token count of compressed content

### Resource Dependencies

The `resourceDependenciesTable` captures relationships between resources:

- Maps dependencies between source and target resources
- Records the type of dependency (imports, references, etc.)
- Tracks the strength of the dependency relationship

### Resource Access Logs

The `resourceAccessLogsTable` provides detailed tracking of resource access patterns:

- Records every access to a resource
- Categorizes access by type (viewed, edited, executed, referenced)
- Links access events to specific sessions
- Timestamps each access for recency calculations

### Workspace States

The `workspaceStateTable` captures the state of the workspace during a session:

- Records active projects and settings
- Tracks enabled MCP servers
- Maintains workspace configuration for session restoration

## Relationships

The schema establishes several key relationships:

1. **Session Continuity**: Sessions link to parent sessions through `parent_session_uuid`
2. **Session Content**: Sessions link to conversations through `session_uuid` in the conversations table
3. **Resource Usage**: Sessions link to resources through the `session_resources` junction table
4. **Resource Dependencies**: Resources link to other resources through the `resource_dependencies` table
5. **Resource Access Patterns**: Resource access is tracked through the `resource_access_logs` table
6. **Workspace Context**: Sessions link to workspace states through the `workspace_states` table

## Implementation Notes

### Migrations

To implement these schema changes, we'll need to create a new migration script that adds these tables to the database. The migration should be carefully sequenced to maintain data integrity:

1. Create enum types first (`resourceTypeEnum`)
2. Create independent tables next (`sessionsTable`, `resourcesTable`)
3. Create dependent tables afterwards (all other tables)
4. Add indexes for performance optimization

### Entity Relationships

The relationships between entities should be enforced at both the database level (through foreign key constraints) and the application level (through the TypeScript interfaces).

### Performance Considerations

Several indexes are included in the schema to optimize common query patterns:

- Indexes on foreign keys for efficient joins
- Indexes on path and type fields for resource filtering
- Separate indexes for source and target resources in dependencies

### Security Considerations

Resource content should be handled securely, potentially with encryption for sensitive data. Access control should be implemented at the application level to ensure that resources are only accessible to authorized users.

## API Integration

The new schema will be integrated with the existing Session Management API, with additions to support resource-aware context management:

```typescript
interface SessionManager {
  // Existing methods
  saveSession(params: SaveSessionParams): Promise<{ sessionId: string }>;
  restoreSession(params: RestoreSessionParams): Promise<RestoreSessionResult>;
  listSessions(params: ListSessionsParams): Promise<ListSessionsResult>;
  getSession(params: GetSessionParams): Promise<SessionMetadata>;
  deleteSession(params: DeleteSessionParams): Promise<void>;
  
  // New methods for resource management
  trackResourceAccess(params: {
    resourcePath: string;
    accessType: AccessType;
    sessionId: string;
  }): Promise<void>;
  
  getResourcesForSession(params: {
    sessionId: string;
    limit?: number;
  }): Promise<Resource[]>;
  
  addResourceDependency(params: {
    sourcePath: string;
    targetPath: string;
    dependencyType: string;
  }): Promise<void>;
  
  getResourceDependencies(params: {
    resourcePath: string;
    direction: 'incoming' | 'outgoing' | 'both';
  }): Promise<ResourceDependency[]>;
  
  prioritizeResources(params: {
    sessionId: string;
    tokenBudget: number;
  }): Promise<PrioritizedResources>;
}
```

## Conclusion

These schema updates provide the foundation for enhanced resource-aware context management in the MetaMCP session persistence system. By tracking resources, their relationships, and usage patterns, the system can make intelligent decisions about which context to preserve across sessions, ensuring optimal token utilization while maintaining the most valuable information.

The next steps are to implement these schema changes, create the necessary migration scripts, and develop the application logic to leverage this enhanced data model for improved session persistence.
