/**
 * Resource Tracking Hook
 * 
 * React hook for managing resource tracking and context prioritization.
 * Provides an easy way to integrate resource tracking into React components.
 */

'use client';

import { useState, useEffect } from 'react';
import {
  createTrackingSession,
  trackResourceAccess,
  prioritizeResourcesForContext,
  generateMetricsReport,
  cleanupTrackingSession
} from '../app/actions/resource-tracking';

export interface Resource {
  path: string;
  type: string;
  importance: number;
  tokenCount: number;
  included: boolean;
}

export interface ResourceTrackingOptions {
  tokenBudget?: number;
  sessionSummary?: string;
  autoCleanup?: boolean;
}

export interface ResourceTrackingContextInfo {
  sessionId: string | null;
  resources: Resource[];
  tokenBudget: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing resource tracking and context prioritization.
 */
export function useResourceTracking(options: ResourceTrackingOptions = {}) {
  const {
    tokenBudget = 8000,
    sessionSummary = 'Resource tracking session',
    autoCleanup = true
  } = options;
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize session
  useEffect(() => {
    let mounted = true;
    
    const initSession = async () => {
      try {
        setIsLoading(true);
        const newSessionId = await createTrackingSession(tokenBudget, sessionSummary);
        
        if (mounted) {
          setSessionId(newSessionId);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(`Failed to create session: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    initSession();
    
    // Cleanup on unmount
    return () => {
      mounted = false;
      
      if (autoCleanup && sessionId) {
        cleanupTrackingSession(sessionId).catch(console.error);
      }
    };
  }, [tokenBudget, sessionSummary, autoCleanup]);
  
  /**
   * Track a resource access
   */
  const trackAccess = async (
    path: string,
    accessType: 'view' | 'edit' | 'execute' | 'reference',
    metadata: { size?: number; modified?: boolean } = {}
  ) => {
    if (!sessionId) {
      setError('No active session');
      return;
    }
    
    try {
      await trackResourceAccess(sessionId, path, accessType, metadata);
    } catch (err) {
      setError(`Failed to track resource: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  /**
   * Prioritize resources for context
   */
  const prioritizeResources = async () => {
    if (!sessionId) {
      setError('No active session');
      return [];
    }
    
    try {
      setIsLoading(true);
      
      // Get prioritized resources
      const prioritizedPaths = await prioritizeResourcesForContext(sessionId, tokenBudget);
      
      // Generate report to get full resource details
      const report = await generateMetricsReport(sessionId);
      
      // Parse resources from report (simple parsing for demonstration)
      // In a real implementation, we'd want a separate API to get resource details
      const reportResources: Resource[] = [];
      try {
        // This is a naive implementation for demo purposes
        // In a real app, we'd want a proper API to get resource details
        const topResourcesMatch = report.match(/## Top Resources by Importance\n\n([\s\S]*?)(?:\n\n|$)/);
        if (topResourcesMatch && topResourcesMatch[1]) {
          const resourceLines = topResourcesMatch[1].split('\n');
          
          for (const line of resourceLines) {
            const resourceMatch = line.match(/- (.+?) \(Importance: (\d+), Tokens: (.+?)\)/);
            if (resourceMatch) {
              const [, path, importance, tokenCount] = resourceMatch;
              reportResources.push({
                path,
                type: path.endsWith('.ts') || path.endsWith('.js') ? 'CODE' : 
                      path.endsWith('.md') || path.endsWith('.txt') ? 'DOCUMENTATION' : 'DATA',
                importance: parseInt(importance, 10),
                tokenCount: tokenCount === 'Unknown' ? 0 : parseInt(tokenCount, 10),
                included: prioritizedPaths.includes(path)
              });
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing resource report:', parseError);
      }
      
      setResources(reportResources);
      return prioritizedPaths;
    } catch (err) {
      setError(`Failed to prioritize resources: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Get the current context info
   */
  const getContextInfo = (): ResourceTrackingContextInfo => ({
    sessionId,
    resources,
    tokenBudget,
    isLoading,
    error
  });
  
  return {
    sessionId,
    resources,
    isLoading,
    error,
    trackAccess,
    prioritizeResources,
    getContextInfo
  };
}

export default useResourceTracking;
