/**
 * Resource Tracker
 * 
 * Tracks file access and usage patterns to support resource-aware token management.
 * This simple implementation focuses on tracking basic metadata and access patterns
 * as a foundation for more sophisticated prioritization.
 */

import { EventEmitter } from 'events';

export enum AccessType {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
  EXECUTE = 'EXECUTE',
  REFERENCE = 'REFERENCE'
}

export enum ResourceType {
  CODE = 'CODE',
  DOCUMENTATION = 'DOCUMENTATION',
  DATA = 'DATA',
  RESEARCH = 'RESEARCH',
  GENERATED = 'GENERATED'
}

export interface ResourceStats {
  path: string;
  type: ResourceType;
  accessCount: number;
  lastAccessed: Date;
  accessTypes: Set<AccessType>;
  modified: boolean;
  size?: number;
}

/**
 * Basic resource tracker that monitors file access and usage patterns.
 * Keeps an in-memory record of accessed resources and emits events when resources are accessed.
 */
export class ResourceTracker extends EventEmitter {
  private resources: Map<string, ResourceStats> = new Map();
  private currentSessionId?: string;
  
  /**
   * Creates a new ResourceTracker instance.
   */
  constructor() {
    super();
  }
  
  /**
   * Sets the current session ID for tracking purposes.
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }
  
  /**
   * Gets the current session ID, if set.
   */
  getSessionId(): string | undefined {
    return this.currentSessionId;
  }
  
  /**
   * Tracks a resource access event.
   * 
   * @param path The path to the resource being accessed
   * @param type The type of resource
   * @param accessType How the resource is being accessed (view, edit, etc.)
   * @param metadata Additional metadata about the resource
   */
  trackAccess(
    path: string,
    type: ResourceType,
    accessType: AccessType,
    metadata: { size?: number; modified?: boolean } = {}
  ): void {
    // Normalize path to ensure consistent keys
    const normalizedPath = this.normalizePath(path);
    
    // Get or create resource stats
    const stats = this.resources.get(normalizedPath) || {
      path: normalizedPath,
      type,
      accessCount: 0,
      lastAccessed: new Date(),
      accessTypes: new Set<AccessType>(),
      modified: false,
      size: metadata.size
    };
    
    // Update stats
    stats.accessCount += 1;
    stats.lastAccessed = new Date();
    stats.accessTypes.add(accessType);
    
    if (metadata.modified) {
      stats.modified = true;
    }
    
    if (metadata.size !== undefined) {
      stats.size = metadata.size;
    }
    
    // Store updated stats
    this.resources.set(normalizedPath, stats);
    
    // Emit access event
    this.emit('resourceAccess', {
      path: normalizedPath,
      type,
      accessType,
      sessionId: this.currentSessionId,
      timestamp: new Date(),
      metadata
    });
  }
  
  /**
   * Gets statistics for a specific resource.
   * 
   * @param path The path to the resource
   * @returns The resource statistics or undefined if not tracked
   */
  getResourceStats(path: string): ResourceStats | undefined {
    const normalizedPath = this.normalizePath(path);
    return this.resources.get(normalizedPath);
  }
  
  /**
   * Gets statistics for all tracked resources.
   * 
   * @returns Array of resource statistics
   */
  getAllResources(): ResourceStats[] {
    return Array.from(this.resources.values());
  }
  
  /**
   * Gets the most frequently accessed resources.
   * 
   * @param limit Maximum number of resources to return
   * @returns Array of resource statistics sorted by access count
   */
  getMostFrequentResources(limit: number = 10): ResourceStats[] {
    return Array.from(this.resources.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }
  
  /**
   * Gets the most recently accessed resources.
   * 
   * @param limit Maximum number of resources to return
   * @returns Array of resource statistics sorted by last access time
   */
  getMostRecentResources(limit: number = 10): ResourceStats[] {
    return Array.from(this.resources.values())
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
      .slice(0, limit);
  }
  
  /**
   * Gets resources that have been modified.
   * 
   * @returns Array of resource statistics for modified resources
   */
  getModifiedResources(): ResourceStats[] {
    return Array.from(this.resources.values())
      .filter(resource => resource.modified);
  }
  
  /**
   * Gets resources of a specific type.
   * 
   * @param type The resource type to filter by
   * @returns Array of resource statistics for the specified type
   */
  getResourcesByType(type: ResourceType): ResourceStats[] {
    return Array.from(this.resources.values())
      .filter(resource => resource.type === type);
  }
  
  /**
   * Calculates a simple importance score for a resource based on access patterns.
   * This is a starting point that can be refined with more sophisticated algorithms.
   * 
   * @param path The path to the resource
   * @returns An importance score between 0-100, or 0 if resource not found
   */
  getResourceImportance(path: string): number {
    const stats = this.getResourceStats(path);
    if (!stats) return 0;
    
    // Simple importance calculation:  
    // - Recency: 0-50 points based on how recently accessed (within last hour = 50, decreases over time)
    // - Frequency: 0-30 points based on access count (capped at 15 accesses)
    // - Modification: 20 points if modified during session
    
    // Recency score - decreases with time since last access
    const hoursSinceAccess = (Date.now() - stats.lastAccessed.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 50 - (hoursSinceAccess * 10)); // Subtract 10 points per hour
    
    // Frequency score - increases with more accesses
    const frequencyScore = Math.min(30, stats.accessCount * 2); // 2 points per access, max 30
    
    // Modification score - bonus if modified
    const modificationScore = stats.modified ? 20 : 0;
    
    // Total score (0-100)
    return Math.round(recencyScore + frequencyScore + modificationScore);
  }
  
  /**
   * Gets the resource paths sorted by importance.
   * 
   * @param limit Maximum number of resources to return
   * @returns Array of resource paths sorted by importance score
   */
  getImportantResourcePaths(limit: number = 10): string[] {
    return this.getAllResources()
      .map(stats => ({
        path: stats.path,
        importance: this.getResourceImportance(stats.path)
      }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit)
      .map(item => item.path);
  }
  
  /**
   * Clears all tracking data.
   */
  clear(): void {
    this.resources.clear();
    this.emit('clear');
  }
  
  /**
   * Normalizes a file path for consistent tracking.
   * 
   * @param path The path to normalize
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    // Replace backslashes with forward slashes for consistency
    return path.replace(/\\/g, '/');
  }
}
