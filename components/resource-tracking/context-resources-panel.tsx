/**
 * Context Resources Panel
 * 
 * Panel that displays resources included in the LLM context, along with their importance scores.
 * Helps users visualize which resources are included in context and which are not.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ResourceImportanceIndicator } from './resource-importance-indicator';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

export interface Resource {
  path: string;
  type: string;
  importance: number;
  tokenCount: number;
  included: boolean;
}

interface ContextResourcesPanelProps {
  sessionId: string;
  tokenBudget: number;
  resources: Resource[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

/**
 * Panel displaying resources included in the LLM context
 */
export const ContextResourcesPanel = ({ 
  sessionId,
  tokenBudget,
  resources,
  isLoading = false,
  onRefresh
}: ContextResourcesPanelProps) => {
  const [totalTokens, setTotalTokens] = useState(0);
  const [includedResources, setIncludedResources] = useState<Resource[]>([]);
  
  // Calculate token usage and find included resources
  useEffect(() => {
    const included = resources.filter(r => r.included);
    setIncludedResources(included);
    
    const total = included.reduce((sum, r) => sum + (r.tokenCount || 0), 0);
    setTotalTokens(total);
  }, [resources]);
  
  // Calculate utilization percentage
  const utilizationPercentage = Math.min(100, Math.round((totalTokens / tokenBudget) * 100));
  
  // Get filename from path
  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };
  
  // Get icon based on resource type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CODE': return '💻';
      case 'DOCUMENTATION': return '📄';
      case 'DATA': return '📊';
      case 'RESEARCH': return '🔍';
      default: return '📁';
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-medium">Context Resources</CardTitle>
        {onRefresh && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
          <span>Token usage:</span>
          <span>{totalTokens.toLocaleString()} / {tokenBudget.toLocaleString()} ({utilizationPercentage}%)</span>
        </div>
        
        <Progress value={utilizationPercentage} className="h-2 mb-4" />
        
        <div className="text-xs text-gray-500 mb-2">
          {isLoading ? (
            <p>Loading resources...</p>
          ) : resources.length === 0 ? (
            <p>No resources tracked in this session yet.</p>
          ) : (
            <p>{includedResources.length} of {resources.length} resources included in context</p>
          )}
        </div>
        
        <div className="max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-gray-100 rounded"></div>
              ))}
            </div>
          ) : (
            resources
              .sort((a, b) => b.importance - a.importance)
              .map(resource => (
                <div 
                  key={resource.path} 
                  className={`flex items-center justify-between py-2 border-b ${
                    resource.included ? 'opacity-100' : 'opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <ResourceImportanceIndicator importance={resource.importance} />
                    <span className="mr-1">{getTypeIcon(resource.type)}</span>
                    <span className="truncate" title={resource.path}>
                      {getFileName(resource.path)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {resource.tokenCount?.toLocaleString() || '?'} tokens
                  </div>
                </div>
              ))
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-2 pb-2 text-xs text-gray-500">
        <p>Session ID: {sessionId.substring(0, 8)}...</p>
      </CardFooter>
    </Card>
  );
};

export default ContextResourcesPanel;
