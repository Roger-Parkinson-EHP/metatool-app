Context.tokenCounts.total}
- Unused: ${finalContext.tokenCounts.unused}
- Utilization Rate: ${(finalContext.tokenCounts.total / parseInt(options.tokenBudget, 10) * 100).toFixed(2)}%

### Resources by Type

${Object.entries(countResourcesByType(selectedResources)).map(([type, count]) => `- ${type}: ${count} (${(count / selectedResources.length * 100).toFixed(2)}%)`).join('\n')}

### Resources by Size

${Object.entries(countResourcesBySize(selectedResources)).map(([size, count]) => `- ${size}: ${count} (${(count / selectedResources.length * 100).toFixed(2)}%)`).join('\n')}

### Top 5 Selected Resources

${selectedResources.slice(0, 5).map((r, i) => `${i+1}. ${r.path} (${r.type}, ${r.originalTokenCount} tokens, compressed to ${r.tokenCount} tokens)`).join('\n')}

## Visualization

A visualization of these results can be generated using the analyze-resource-usage.js script.
`;
}

// Create a mock implementation if needed
class ResourceTracker {
  constructor() {
    this.resources = new Map();
  }
  
  trackResourceAccess(resourceId, accessType) {
    const stats = this.resources.get(resourceId) || { 
      accessCount: 0,
      accessTypes: new Set(),
      importance: 0
    };
    
    stats.accessCount++;
    stats.accessTypes.add(accessType);
    this.resources.set(resourceId, stats);
  }
}

class ResourceCatalog {
  constructor() {
    this.resources = [];
    this.resourcesById = new Map();
  }
  
  addResource(resource) {
    this.resources.push(resource);
    this.resourcesById.set(resource.id, resource);
  }
  
  getResourceById(id) {
    return this.resourcesById.get(id);
  }
}

class DependencyAnalyzer {
  constructor() {
    this.dependencies = new Map();
    this.reverseDependencies = new Map();
  }
  
  addDependency(sourceId, targetId, type = 'REFERENCES') {
    // Add forward dependency
    if (!this.dependencies.has(sourceId)) {
      this.dependencies.set(sourceId, new Map());
    }
    this.dependencies.get(sourceId).set(targetId, type);
    
    // Add reverse dependency
    if (!this.reverseDependencies.has(targetId)) {
      this.reverseDependencies.set(targetId, new Map());
    }
    this.reverseDependencies.get(targetId).set(sourceId, type);
  }
  
  getDependencies(sourceId) {
    return Array.from(this.dependencies.get(sourceId)?.keys() || []);
  }
  
  getDependents(targetId) {
    return Array.from(this.reverseDependencies.get(targetId)?.keys() || []);
  }
}

// Define enum values if needed
const ResourceType = {
  CODE: 'CODE',
  DOCUMENTATION: 'DOCUMENTATION',
  DATA: 'DATA',
  RESEARCH: 'RESEARCH',
  GENERATED: 'GENERATED'
};

const AccessType = {
  VIEWED: 'VIEWED',
  EDITED: 'EDITED',
  EXECUTED: 'EXECUTED',
  REFERENCED: 'REFERENCED'
};

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
