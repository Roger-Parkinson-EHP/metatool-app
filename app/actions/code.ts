'use server';

import { desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { codesTable } from '@/db/schema';
import { trackResourceAccess } from './resource-tracking';

// Optional session ID for resource tracking
let activeSessionId: string | null = null;

/**
 * Set the active session ID for resource tracking
 */
export async function setActiveSessionId(sessionId: string | null) {
  activeSessionId = sessionId;
}

export async function getCodes() {
  return await db
    .select()
    .from(codesTable)
    .orderBy(desc(codesTable.created_at));
}

export async function getCode(uuid: string) {
  const results = await db
    .select()
    .from(codesTable)
    .where(eq(codesTable.uuid, uuid));
    
  const code = results[0];
  
  // Track resource access if session is active
  if (activeSessionId && code) {
    await trackResourceAccess(
      activeSessionId,
      `/code/${code.uuid}/${code.fileName}`,
      'view',
      { size: code.code.length }
    );
  }
  
  return code;
}

export async function createCode(fileName: string, code: string) {
  const results = await db
    .insert(codesTable)
    .values({
      fileName,
      code,
    })
    .returning();
    
  // Track resource creation if session is active
  if (activeSessionId && results[0]) {
    await trackResourceAccess(
      activeSessionId,
      `/code/${results[0].uuid}/${fileName}`,
      'edit',
      { size: code.length, modified: true }
    );
  }
  
  return results[0];
}

export async function updateCode(uuid: string, fileName: string, code: string) {
  const results = await db
    .update(codesTable)
    .set({
      fileName,
      code,
    })
    .where(eq(codesTable.uuid, uuid))
    .returning();
    
  // Track resource update if session is active
  if (activeSessionId && results[0]) {
    await trackResourceAccess(
      activeSessionId,
      `/code/${results[0].uuid}/${fileName}`,
      'edit',
      { size: code.length, modified: true }
    );
  }
  
  return results[0];
}

export async function deleteCode(uuid: string) {
  // Get the code before deleting for tracking purposes
  const codeToDelete = await getCode(uuid);
  
  const results = await db
    .delete(codesTable)
    .where(eq(codesTable.uuid, uuid))
    .returning();
    
  // Track resource deletion if session is active
  if (activeSessionId && codeToDelete) {
    await trackResourceAccess(
      activeSessionId,
      `/code/${codeToDelete.uuid}/${codeToDelete.fileName}`,
      'reference', // Use reference type for deletion
      { size: codeToDelete.code.length }
    );
  }
  
  return results[0];
}
