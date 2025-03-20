/**
 * Token Budget Indicator
 * 
 * Visual indicator for token budget usage in the UI.
 * Shows the current token usage as a progress bar with percentage.
 */

'use client';

import React from 'react';
import { Progress } from '../ui/progress';

interface TokenBudgetIndicatorProps {
  tokenUsage: number;
  tokenBudget: number;
  showLabel?: boolean;
  colorThresholds?: {
    warning: number;  // Percentage at which to show warning color (default: 70)
    danger: number;   // Percentage at which to show danger color (default: 90)
  };
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Progress bar indicator that shows token budget usage
 */
export const TokenBudgetIndicator = ({ 
  tokenUsage,
  tokenBudget,
  showLabel = true,
  colorThresholds = { warning: 70, danger: 90 }, 
  size = 'md'
}: TokenBudgetIndicatorProps) => {
  // Calculate percentage
  const percentage = Math.min(100, Math.round((tokenUsage / tokenBudget) * 100));
  
  // Determine color based on usage percentage
  const getColor = () => {
    if (percentage >= colorThresholds.danger) return 'bg-red-500';
    if (percentage >= colorThresholds.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  // Determine height based on size
  const getHeight = () => {
    if (size === 'sm') return 'h-1';
    if (size === 'lg') return 'h-3';
    return 'h-2';
  };
  
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Token usage:</span>
          <span>
            {tokenUsage.toLocaleString()} / {tokenBudget.toLocaleString()} 
            ({percentage}%)
          </span>
        </div>
      )}
      <Progress 
        value={percentage} 
        className={`${getHeight()} ${getColor()}`} 
        indicatorClassName={getColor()}
      />
    </div>
  );
};

export default TokenBudgetIndicator;
