# Roger-MetaMCP Refactoring Guide

## Overview

This document outlines the refactoring performed on the Roger-MetaMCP codebase to improve the application architecture, streamline startup processes, and consolidate functionality. The goal was to reduce redundancy, improve maintainability, and ensure a more reliable user experience.

## Key Changes

### 1. Unified Server Implementation

A new unified server implementation has been created that combines the functionality of three separate servers:

- RogerThat Token Management
- Semantic Analysis
- MCP Server Management

The unified server is located at `scripts/unified-server.js` and reduces overhead by combining all functionality into a single Node.js process.

### 2. Simplified Launch Process

A new unified launch script (`unified-launch.bat`) has been created that provides:

- Dependency checking
- Automatic directory creation
- Environment variable setup
- Multiple startup options

The launch script presents users with three options:
1. Start the unified server (recommended)
2. Start individual services (legacy mode)
3. Use Claude Desktop Configuration

### 3. Claude Desktop Configuration

The Claude Desktop configuration has been updated to use a single MCP server with all environment variables properly configured:

```json
"MetaMCP": {
  "command": "node",
  "args": [
    "D:\\UserRoger\\Documents\\GitHub\\modelcontextprotocol\\roger-metamcp\\mcp-jsonrpc-server-fixed.js"
  ],
  "description": "Unified MCP server with token management, semantic analysis, and MCP server management",
  "type": "STDIO",
  "restart": {
    "maxRestarts": 3,
    "policy": "on-failure"
  },
  "env": {
    "METAMCP_API_KEY": "sk_mt_oXYmPVrS7WbIB7ITlKfVTcgZ93u6cNrm0uJE3UOxLR42BBM3wGWxn8K2EEgG9jhA",
    "EMBEDDING_CACHE_DIR": "D:\\UserRoger\\Documents\\GitHub\\modelcontextprotocol\\roger-metamcp\\.embeddings-cache",
    "EMBEDDING_DIMENSIONS": "384",
    "SIMILARITY_THRESHOLD": "0.7",
    "TOKEN_BUDGET": "8000",
    "DEFAULT_ALGORITHM": "hybrid-semantic",
    "ENABLE_SEMANTIC": "true",
    "LOG_LEVEL": "info",
    "ENABLE_ALL_FEATURES": "true"
  }
}
```

### 4. Added Tree-Sitter MCP Server

We've added the tree-sitter MCP server for code analysis capabilities to the configuration:

```json
"tree-sitter": {
  "command": "python",
  "args": [
    "-m",
    "mcp_server_tree_sitter.server"
  ],
  "description": "Code analysis capabilities using tree-sitter, providing intelligent access to codebases with context management.",
  "type": "STDIO"
}
```

## Benefits of Refactoring

1. **Reduced Resource Usage**: Instead of three separate Node.js processes, a single process handles all functionality
2. **Simplified Configuration**: Environment variables are consolidated in one place
3. **Improved Reliability**: Single process eliminates race conditions between services
4. **Better Maintainability**: Centralized codebase for easier updates and debugging
5. **Enhanced User Experience**: Simplified launch process with clear options

## Migration Guide

To migrate from the old architecture to the new one:

1. Run the `unified-launch.bat` script
2. Select option 1 to use the unified server approach
3. If you prefer to use Claude Desktop, select option 3 and restart Claude Desktop

## Legacy Support

The original individual server scripts and launch mechanisms have been preserved for backward compatibility:

- `simplified-rogerthat-server.js` - Original RogerThat server
- `simplified-semantic-server.js` - Original Semantic Analysis server
- `simplified-launch.bat` - Original launch script

These files will be maintained for a transition period but may be deprecated in future releases.

## Next Steps

Future refactoring steps will include:

1. Converting the codebase to TypeScript for better type safety
2. Implementing unit and integration tests
3. Improving error handling and logging
4. Adding more configuration options for advanced users
5. Streamlining the MCP server API for better consistency

