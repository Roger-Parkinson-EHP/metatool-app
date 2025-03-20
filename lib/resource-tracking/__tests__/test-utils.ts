/**
 * Test utilities for resource tracking components
 * 
 * Provides mock implementations, fixtures, and helper functions for testing
 * resource tracking and prioritization components.
 */

import { ResourceType, AccessType } from '../ResourceTracker';

/**
 * Creates a mock file system with test resources
 */
export function createMockFileSystem() {
  const mockFiles: Record<string, { content: string; size: number; type: ResourceType }> = {
    '/project/src/main.ts': {
      content: 'export function main() { console.log("Hello, world!"); }',
      size: 1024,
      type: ResourceType.CODE
    },
    '/project/src/utils.ts': {
      content: 'export function formatDate(date: Date) { return date.toISOString(); }',
      size: 2048, 
      type: ResourceType.CODE
    },
    '/project/docs/api.md': {
      content: '# API Documentation\n\nThis document describes the API.',
      size: 5120,
      type: ResourceType.DOCUMENTATION
    },
    '/project/src/components/Button.tsx': {
      content: 'export const Button = ({ onClick, label }) => <button onClick={onClick}>{label}</button>;',
      size: 3072,
      type: ResourceType.CODE
    },
    '/project/data/config.json': {
      content: '{ "apiUrl": "https://api.example.com", "timeout": 5000 }',
      size: 512,
      type: ResourceType.DATA
    }
  };

  // Mock fs implementation
  const mockFs = {
    readFile: jest.fn().mockImplementation((path: string) => {
      const file = mockFiles[path];
      if (!file) {
        return Promise.reject(new Error(`File not found: ${path}`));
      }
      return Promise.resolve(Buffer.from(file.content));
    }),
    stat: jest.fn().mockImplementation((path: string) => {
      const file = mockFiles[path];
      if (!file) {
        return Promise.reject(new Error(`File not found: ${path}`));
      }
      return Promise.resolve({
        size: file.size,
        isFile: () => true,
        isDirectory: () => false
      });
    })
  };

  return { mockFiles, mockFs };
}

/**
 * Creates a test resource access sequence that simulates realistic user behavior
 */
export function createTestAccessSequence() {
  return [
    { path: '/project/src/main.ts', type: ResourceType.CODE, accessType: AccessType.VIEW, metadata: { size: 1024 }, timestamp: new Date(Date.now() - 60 * 60 * 1000) }, // 1 hour ago
    { path: '/project/docs/api.md', type: ResourceType.DOCUMENTATION, accessType: AccessType.VIEW, metadata: { size: 5120 }, timestamp: new Date(Date.now() - 55 * 60 * 1000) },
    { path: '/project/src/utils.ts', type: ResourceType.CODE, accessType: AccessType.VIEW, metadata: { size: 2048 }, timestamp: new Date(Date.now() - 50 * 60 * 1000) },
    { path: '/project/src/main.ts', type: ResourceType.CODE, accessType: AccessType.EDIT, metadata: { size: 1100, modified: true }, timestamp: new Date(Date.now() - 40 * 60 * 1000) },
    { path: '/project/src/components/Button.tsx', type: ResourceType.CODE, accessType: AccessType.VIEW, metadata: { size: 3072 }, timestamp: new Date(Date.now() - 30 * 60 * 1000) },
    { path: '/project/data/config.json', type: ResourceType.DATA, accessType: AccessType.VIEW, metadata: { size: 512 }, timestamp: new Date(Date.now() - 20 * 60 * 1000) },
    { path: '/project/src/main.ts', type: ResourceType.CODE, accessType: AccessType.EDIT, metadata: { size: 1200, modified: true }, timestamp: new Date(Date.now() - 10 * 60 * 1000) },
    { path: '/project/src/components/Button.tsx', type: ResourceType.CODE, accessType: AccessType.EDIT, metadata: { size: 3100, modified: true }, timestamp: new Date(Date.now() - 5 * 60 * 1000) }
  ];
}

/**
 * Creates mock database responses for testing
 */
export function createMockDatabaseResponses() {
  // Mock resource UUIDs
  const resourceUuids: Record<string, string> = {
    '/project/src/main.ts': 'uuid-main-ts',
    '/project/src/utils.ts': 'uuid-utils-ts',
    '/project/docs/api.md': 'uuid-api-md',
    '/project/src/components/Button.tsx': 'uuid-button-tsx',
    '/project/data/config.json': 'uuid-config-json'
  };

  // Mock resources with importance scores
  const mockResources = Object.entries(resourceUuids).map(([path, uuid]) => ({
    uuid,
    path,
    type: path.endsWith('.ts') || path.endsWith('.tsx') ? ResourceType.CODE : 
          path.endsWith('.md') ? ResourceType.DOCUMENTATION : ResourceType.DATA,
    size: path.includes('main.ts') ? 1200 : 
          path.includes('utils.ts') ? 2048 : 
          path.includes('api.md') ? 5120 : 
          path.includes('Button.tsx') ? 3100 : 512,
    tokenCount: path.includes('main.ts') ? 300 : 
                path.includes('utils.ts') ? 512 : 
                path.includes('api.md') ? 1280 : 
                path.includes('Button.tsx') ? 775 : 128,
    lastAccessed: new Date(),
    accessCount: path.includes('main.ts') ? 3 : 
                path.includes('utils.ts') ? 1 : 
                path.includes('api.md') ? 1 : 
                path.includes('Button.tsx') ? 2 : 1,
    modifiedDuringSession: path.includes('main.ts') || path.includes('Button.tsx'),
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    importanceScore: path.includes('main.ts') ? 85 : 
                    path.includes('utils.ts') ? 45 : 
                    path.includes('api.md') ? 40 : 
                    path.includes('Button.tsx') ? 70 : 30
  }));

  return { resourceUuids, mockResources };
}

/**
 * Adds a mock time implementation for testing time-sensitive functionality
 */
export function withMockTime(callback: () => void) {
  const originalDateNow = Date.now;
  const originalNewDate = global.Date;
  const mockNow = 1625097600000; // 2021-07-01T00:00:00.000Z

  try {
    // Mock Date.now
    global.Date.now = jest.fn(() => mockNow);
    
    // Mock new Date()
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockNow);
        } else {
          super(...args);
        }
      }
    } as any;

    // Run the test callback
    callback();
  } finally {
    // Restore original Date implementation
    global.Date.now = originalDateNow;
    global.Date = originalNewDate;
  }
}
