/**
 * RogerThat Highcharts Dashboard
 * 
 * Advanced dashboard component that visualizes token budget usage and resource importance
 * using interactive Highcharts visualizations.
 */

import React, { useState, useEffect } from 'react';
import { useResourceTracking } from '../../hooks/use-resource-tracking';
import { TokenBudgetIndicator } from './token-budget-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Clipboard, RefreshCw, Download } from 'lucide-react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// Import Highcharts modules
import HighchartsMore from 'highcharts/highcharts-more';
import HighchartsSolidGauge from 'highcharts/modules/solid-gauge';
import HighchartsTreemap from 'highcharts/modules/treemap';
import HighchartsExporting from 'highcharts/modules/exporting';

// Initialize Highcharts modules
if (typeof Highcharts === 'object') {
  HighchartsMore(Highcharts);
  HighchartsSolidGauge(Highcharts);
  HighchartsTreemap(Highcharts);
  HighchartsExporting(Highcharts);
}

interface HighchartsDashboardProps {
  tokenBudget?: number;
  autoRefresh?: boolean;
  onExportReport?: (report: string) => void;
  onChangeTokenBudget?: (budget: number) => void;
}

/**
 * RogerThat Dashboard using Highcharts for data visualization
 */
export const HighchartsDashboard: React.FC<HighchartsDashboardProps> = ({ 
  tokenBudget = 8000, 
  autoRefresh = false,
  onExportReport,
  onChangeTokenBudget
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTypes, setSelectedTypes] = useState(['CODE', 'DOCUMENTATION', 'DATA']);
  const [sortBy, setSortBy] = useState('importance');
  
  // Use the resource tracking hook
  const {
    sessionId,
    resources,
    isLoading,
    error,
    trackAccess,
    prioritizeResources,
    getContextInfo
  } = useResourceTracking({
    tokenBudget,
    sessionSummary: 'RogerThat resource tracking session',
    autoCleanup: true
  });
  
  // Calculate token usage statistics
  const tokenUsage = resources
    .filter(resource => resource.included)
    .reduce((sum, resource) => sum + resource.tokenCount, 0);
  
  const tokenUsageByType = resources.reduce((acc, resource) => {
    if (resource.included) {
      acc[resource.type] = (acc[resource.type] || 0) + resource.tokenCount;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Auto-refresh resources
  useEffect(() => {
    if (autoRefresh && sessionId) {
      const interval = setInterval(() => {
        prioritizeResources().catch(console.error);
      }, 30000); // Every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, sessionId, prioritizeResources]);
  
  // Filter and sort resources for display
  const filteredResources = resources.filter(resource => 
    selectedTypes.includes(resource.type)
  );
  
  const sortedResources = [...filteredResources].sort((a, b) => {
    if (sortBy === 'importance') {
      return b.importance - a.importance;
    } else if (sortBy === 'recent') {
      return b.importance - a.importance;
    } else {
      return a.path.localeCompare(b.path);
    }
  });
  
  // Prepare data for Highcharts
  
  // 1. Token Budget Gauge Chart Options
  const tokenGaugeOptions = {
    chart: {
      type: 'solidgauge',
      height: '200px',
    },
    title: {
      text: 'Token Budget Usage',
      style: { fontSize: '16px' }
    },
    tooltip: {
      enabled: false
    },
    pane: {
      startAngle: -90,
      endAngle: 90,
      background: {
        backgroundColor: '#EEE',
        innerRadius: '60%',
        outerRadius: '100%',
        shape: 'arc'
      }
    },
    yAxis: {
      min: 0,
      max: tokenBudget,
      stops: [
        [0.1, '#55BF3B'], // green
        [0.5, '#DDDF0D'], // yellow
        [0.9, '#DF5353']  // red
      ],
      lineWidth: 0,
      minorTickInterval: null,
      tickAmount: 2,
      labels: {
        y: 16
      }
    },
    plotOptions: {
      solidgauge: {
        dataLabels: {
          y: -25,
          borderWidth: 0,
          useHTML: true
        }
      }
    },
    credits: {
      enabled: false
    },
    series: [{
      name: 'Tokens Used',
      data: [tokenUsage],
      dataLabels: {
        format: '<div style="text-align:center"><span style="font-size:1.25rem">{y}</span><br/>' +
          '<span style="font-size:0.75rem;opacity:0.6">of {max} tokens</span></div>'
      }
    }]
  };
  
  // 2. Token Allocation Pie Chart Options
  const tokenAllocationOptions = {
    chart: {
      type: 'pie',
      height: '300px'
    },
    title: {
      text: 'Token Allocation by Resource Type',
      style: { fontSize: '16px' }
    },
    tooltip: {
      pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b><br>Tokens: <b>{point.y}</b>'
    },
    accessibility: {
      point: {
        valueSuffix: '%'
      }
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f}%'
        }
      }
    },
    credits: {
      enabled: false
    },
    series: [{
      name: 'Token Allocation',
      colorByPoint: true,
      data: Object.entries(tokenUsageByType).map(([type, tokens]) => ({
        name: type,
        y: tokens,
        sliced: type === 'CODE',
        selected: type === 'CODE'
      }))
    }]
  };

  // 3. Resource Importance Treemap Options
  const resourceTreemapOptions = {
    chart: {
      type: 'treemap',
      height: '350px'
    },
    title: {
      text: 'Resource Importance Visualization',
      style: { fontSize: '16px' }
    },
    tooltip: {
      pointFormat: '<b>{point.name}</b><br>Importance: <b>{point.value}</b><br>Tokens: <b>{point.tokens}</b>'
    },
    series: [{
      layoutAlgorithm: 'squarified',
      data: resources.filter(r => r.included).map(resource => ({
        name: resource.path.split('/').pop() || resource.path,
        value: resource.importance,
        tokens: resource.tokenCount,
        colorValue: resource.importance,
      })),
      dataLabels: {
        enabled: true,
        format: '{point.name}',
        style: {
          textOverflow: 'ellipsis',
          color: 'white'
        }
      }
    }],
    colorAxis: {
      minColor: '#EEEEFF',
      maxColor: '#0066FF'
    },
    credits: {
      enabled: false
    }
  };
  
  // 4. Resource Type Distribution Bar Chart Options
  const resourceTypesOptions = {
    chart: {
      type: 'column',
      height: '300px'
    },
    title: {
      text: 'Resources by Type and Context Inclusion',
      style: { fontSize: '16px' }
    },
    xAxis: {
      categories: ['CODE', 'DOCUMENTATION', 'DATA', 'OTHER'],
      title: {
        text: 'Resource Type'
      }
    },
    yAxis: {
      min: 0,
      title: {
        text: 'Count'
      }
    },
    tooltip: {
      pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b><br/>'
    },
    plotOptions: {
      column: {
        stacking: 'normal',
        dataLabels: {
          enabled: false
        }
      }
    },
    credits: {
      enabled: false
    },
    series: [{
      name: 'Included in Context',
      data: [
        resources.filter(r => r.type === 'CODE' && r.included).length,
        resources.filter(r => r.type === 'DOCUMENTATION' && r.included).length,
        resources.filter(r => r.type === 'DATA' && r.included).length,
        resources.filter(r => !['CODE', 'DOCUMENTATION', 'DATA'].includes(r.type) && r.included).length
      ]
    }, {
      name: 'Excluded from Context',
      data: [
        resources.filter(r => r.type === 'CODE' && !r.included).length,
        resources.filter(r => r.type === 'DOCUMENTATION' && !r.included).length,
        resources.filter(r => r.type === 'DATA' && !r.included).length,
        resources.filter(r => !['CODE', 'DOCUMENTATION', 'DATA'].includes(r.type) && !r.included).length
      ]
    }]
  };
  
  // 5. Top Resources Bar Chart Options
  const topResourcesOptions = {
    chart: {
      type: 'bar',
      height: '400px'
    },
    title: {
      text: 'Top Resources by Importance',
      style: { fontSize: '16px' }
    },
    xAxis: {
      categories: resources
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10)
        .map(r => r.path.split('/').pop() || r.path),
      title: {
        text: null
      }
    },
    yAxis: {
      min: 0,
      max: 100,
      title: {
        text: 'Importance Score',
        align: 'high'
      }
    },
    tooltip: {
      pointFormat: '<b>{point.y}</b> importance score'
    },
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: true
        }
      }
    },
    legend: {
      enabled: false
    },
    credits: {
      enabled: false
    },
    series: [{
      name: 'Importance',
      data: resources
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10)
        .map(r => r.importance),
      color: '#4285F4'
    }]
  };
  
  // Generate a report
  const generateReport = () => {
    const report = `# RogerThat Resource Context Report
    
## Overview
- Session ID: ${sessionId || 'Not available'}
- Token Budget: ${tokenBudget.toLocaleString()}
- Token Usage: ${tokenUsage.toLocaleString()} (${Math.round((tokenUsage / tokenBudget) * 100)}%)
- Resources Tracked: ${resources.length}
- Resources In Context: ${resources.filter(r => r.included).length}

## Token Allocation by Type
${Object.entries(tokenUsageByType).map(([type, tokens]) => 
  `- ${type}: ${tokens.toLocaleString()} tokens (${Math.round((tokens / tokenBudget) * 100)}%)`
).join('\n')}

## Top Resources by Importance
${sortedResources.slice(0, 10).map((resource, index) => 
  `${index + 1}. ${resource.path} (Importance: ${resource.importance}, Tokens: ${resource.tokenCount})`
).join('\n')}
`;
    
    if (onExportReport) {
      onExportReport(report);
    } else {
      // Fallback to download if no export handler provided
      const blob = new Blob([report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rogerthat-report-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  
  // Handle errors
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="w-full space-y-4">
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>RogerThat Token Management</CardTitle>
              <CardDescription>
                Mission-critical context management for AI interactions
              </CardDescription>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => prioritizeResources()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1">
              <HighchartsReact highcharts={Highcharts} options={tokenGaugeOptions} />
            </div>
            
            <div className="col-span-2">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm font-medium">Resources Tracked</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-2xl font-bold">{resources.length}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm font-medium">In Context</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-2xl font-bold">{resources.filter(r => r.included).length}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm font-medium">Session ID</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 flex items-center space-x-2">
                    <p className="text-sm font-mono truncate">{sessionId ? sessionId.slice(0, 8) : '—'}</p>
                    {sessionId && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => navigator.clipboard.writeText(sessionId || '')}>
                        <Clipboard className="h-3 w-3" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              <Button variant="outline" size="sm" onClick={generateReport}>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          <TabsContent value="dashboard" className="m-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <HighchartsReact highcharts={Highcharts} options={tokenAllocationOptions} />
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <HighchartsReact highcharts={Highcharts} options={resourceTypesOptions} />
                </CardContent>
              </Card>
              
              <Card className="md:col-span-2">
                <CardContent className="p-4">
                  <HighchartsReact highcharts={Highcharts} options={resourceTreemapOptions} />
                </CardContent>
              </Card>
              
              <Card className="md:col-span-2">
                <CardContent className="p-4">
                  <HighchartsReact highcharts={Highcharts} options={topResourcesOptions} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="resources" className="m-0">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <Button 
                  variant={selectedTypes.includes('CODE') ? "default" : "outline"} 
                  size="sm"
                  onClick={() => {
                    if (selectedTypes.includes('CODE')) {
                      setSelectedTypes(selectedTypes.filter(t => t !== 'CODE'));
                    } else {
                      setSelectedTypes([...selectedTypes, 'CODE']);
                    }
                  }}
                >
                  Code
                </Button>
                <Button 
                  variant={selectedTypes.includes('DOCUMENTATION') ? "default" : "outline"} 
                  size="sm"
                  onClick={() => {
                    if (selectedTypes.includes('DOCUMENTATION')) {
                      setSelectedTypes(selectedTypes.filter(t => t !== 'DOCUMENTATION'));
                    } else {
                      setSelectedTypes([...selectedTypes, 'DOCUMENTATION']);
                    }
                  }}
                >
                  Documentation
                </Button>
                <Button 
                  variant={selectedTypes.includes('DATA') ? "default" : "outline"} 
                  size="sm"
                  onClick={() => {
                    if (selectedTypes.includes('DATA')) {
                      setSelectedTypes(selectedTypes.filter(t => t !== 'DATA'));
                    } else {
                      setSelectedTypes([...selectedTypes, 'DATA']);
                    }
                  }}
                >
                  Data
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                <select 
                  className="text-sm border rounded p-1"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="importance">Importance</option>
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Importance</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResources.length > 0 ? (
                  sortedResources.map((resource) => (
                    <TableRow key={resource.path}>
                      <TableCell className="font-medium truncate max-w-[200px]">
                        {resource.path.split('/').pop()}
                        <div className="text-xs text-gray-500 truncate">
                          {resource.path}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{resource.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {resource.tokenCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span>{resource.importance}</span>
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div 
                              className="h-2 bg-blue-500 rounded-full" 
                              style={{ width: `${resource.importance}%` }} 
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {resource.included ? (
                          <Badge className="bg-green-500">Included</Badge>
                        ) : (
                          <Badge variant="outline">Excluded</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                      No resources tracked yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
          
          <TabsContent value="settings" className="m-0">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Token Budget</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Configure the token budget for your AI context window. Larger budgets allow more resources
                  to be included but may increase API costs.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[4000, 8000, 16000].map((budget) => (
                    <Card 
                      key={budget} 
                      className={`cursor-pointer hover:border-blue-500 ${tokenBudget === budget ? 'border-blue-500 bg-blue-50' : ''}`}
                      onClick={() => onChangeTokenBudget && onChangeTokenBudget(budget)}
                    >
                      <CardContent className="p-4">
                        <h4 className="font-semibold">{budget.toLocaleString()} tokens</h4>
                        <p className="text-sm text-gray-500">
                          {budget === 4000 && 'Economy - Good for simple interactions'}
                          {budget === 8000 && 'Standard - Balanced performance'}
                          {budget === 16000 && 'Premium - Rich context for complex tasks'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Auto-Refresh</h3>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="autoRefresh"
                    checked={autoRefresh}
                    onChange={() => {/* Handle autoRefresh toggle */}}
                    className="rounded"
                  />
                  <label htmlFor="autoRefresh" className="text-sm">
                    Automatically refresh resource prioritization every 30 seconds
                  </label>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Session Management</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Create New Session
                  </Button>
                  <Button variant="destructive" size="sm">
                    Clear Session Data
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </CardContent>
      </Card>
    </div>
  );
};

export default HighchartsDashboard;
