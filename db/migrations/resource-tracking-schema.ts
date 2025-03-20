/**
 * Resource Tracking Schema Migration
 * 
 * This migration adds the minimal tables needed to support resource-aware token management:
 * - resources: Tracks information about files and other resources
 * - sessions: Tracks token-limited interaction sessions with the AI
 * - resource_access_logs: Records resource access events
 * - session_resources: Links sessions to their relevant resources
 */

import { sql } from 'drizzle-orm';

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
    .execute();

  // Add primary key constraint to session_resources
  await db.schema
    .alterTable('session_resources')
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
  // Drop tables in reverse order to handle dependencies
  await db.schema.dropTable('session_resources').execute();
  await db.schema.dropTable('resource_access_logs').execute();
  await db.schema.dropTable('sessions').execute();
  await db.schema.dropTable('resources').execute();
}
