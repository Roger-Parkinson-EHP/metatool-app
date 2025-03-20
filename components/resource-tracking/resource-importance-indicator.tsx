/**
 * Resource Importance Indicator
 * 
 * Visual indicator for resource importance in the UI.
 * Shows the importance level of a resource using a color-coded dot.
 */

'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface ResourceImportanceIndicatorProps {
  importance: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

/**
 * Indicator that shows resource importance using a color-coded dot
 */
export const ResourceImportanceIndicator = ({ 
  importance, 
  size = 'md',
  showTooltip = true
}: ResourceImportanceIndicatorProps) => {
  const getColor = () => {
    if (importance > 80) return 'bg-green-500';
    if (importance > 60) return 'bg-emerald-400';
    if (importance > 40) return 'bg-yellow-500';
    if (importance > 20) return 'bg-orange-500';
    return 'bg-gray-300';
  };
  
  const getSize = () => {
    if (size === 'sm') return 'w-2 h-2';
    if (size === 'lg') return 'w-4 h-4';
    return 'w-3 h-3';
  };
  
  const indicator = (
    <span 
      className={`inline-block rounded-full ${getSize()} ${getColor()}`}
      aria-label={`Resource importance: ${importance}/100`}
    />
  );
  
  if (!showTooltip) {
    return indicator;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">Importance: {importance}/100</p>
          <p className="text-xs text-gray-500">
            {importance > 80 ? 'Highly relevant' : 
             importance > 60 ? 'Very relevant' :
             importance > 40 ? 'Moderately relevant' :
             importance > 20 ? 'Somewhat relevant' : 'Low relevance'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ResourceImportanceIndicator;
