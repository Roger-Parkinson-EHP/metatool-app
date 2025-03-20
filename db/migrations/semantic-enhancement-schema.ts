/**
 * Semantic Enhancement Schema Migration
 * 
 * This migration adds the necessary tables and columns to support semantic understanding:
 * - Adds semantic_score column to resources table
 * - Creates resource_relationships table to track semantic similarity between resources
 * - Creates semantic_embeddings table to store resource embeddings
 */

import { sql } from 'drizzle-orm';

export async function up(db) {
  // Add semantic_score column to resources table
  await db.schema
    .alterTable('resources')
    .addColumn('semantic_score', 'real', (col) => col.default(0))
    .execute();

  // Create resource_relationships table for semantic similarity
  await db.schema
    .createTable('resource_relationships')
    .addColumn('source_uuid', 'uuid', (col) => 
      col.notNull().references('resources.uuid', { onDelete: 'cascade' }))
    .addColumn('target_uuid', 'uuid', (col) => 
      col.notNull().references('resources.uuid', { onDelete: 'cascade' }))
    .addColumn('similarity_score', 'real', (col) => col.notNull())
    .addColumn('created_at', 'timestamp with time zone', (col) => 
      col.notNull().defaultNow())
    .addColumn('updated_at', 'timestamp with time zone', (col) => 
      col.notNull().defaultNow())
    .execute();

  // Add primary key constraint to resource_relationships
  await db.schema
    .alterTable('resource_relationships')
    .addPrimaryKeyConstraint('resource_relationships_pkey', ['source_uuid', 'target_uuid'])
    .execute();

  // Create semantic_embeddings table
  await db.schema
    .createTable('semantic_embeddings')
    .addColumn('resource_uuid', 'uuid', (col) => 
      col.primaryKey().references('resources.uuid', { onDelete: 'cascade' }))
    .addColumn('embedding', 'bytea', (col) => col.notNull())
    .addColumn('dimensions', 'integer', (col) => col.notNull())
    .addColumn('model_name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp with time zone', (col) => 
      col.notNull().defaultNow())
    .execute();

  // Create index on similarity score for fast retrieval of similar resources
  await db.schema
    .createIndex('resource_relationships_similarity_score_idx')
    .on('resource_relationships')
    .column('similarity_score')
    .execute();

  // Add semantic_algorithm column to sessions table
  await db.schema
    .alterTable('sessions')
    .addColumn('semantic_algorithm', 'text', (col) => col.default('hybrid'))
    .execute();

  // Add semantic_enabled column to sessions table
  await db.schema
    .alterTable('sessions')
    .addColumn('semantic_enabled', 'boolean', (col) => col.default(false))
    .execute();
}

export async function down(db) {
  // Remove semantic features from sessions table
  await db.schema
    .alterTable('sessions')
    .dropColumn('semantic_enabled')
    .execute();

  await db.schema
    .alterTable('sessions')
    .dropColumn('semantic_algorithm')
    .execute();

  // Drop tables in reverse order to handle dependencies
  await db.schema.dropTable('semantic_embeddings').execute();
  await db.schema.dropTable('resource_relationships').execute();
  
  // Remove semantic_score column from resources table
  await db.schema
    .alterTable('resources')
    .dropColumn('semantic_score')
    .execute();
}
