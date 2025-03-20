# Quick Start Guide

## Overview

This guide will help you quickly set up and start using the MetaMCP extension with session persistence, MCP integration, and CI/CD capabilities. Follow these steps to get up and running.

## Prerequisites

Before you begin, ensure you have:

- MetaMCP base environment installed (Docker for self-hosted version)
- Node.js 14+ installed
- Python 3.8+ installed
- Access to Claude Desktop or another MCP-compatible client
- Git installed (for version control features)

## Installation Steps

### 1. Install MetaMCP Base Environment

If you haven't already installed MetaMCP, clone the repository and set it up using Docker Compose:

```bash
git clone https://github.com/metatool-ai/metatool-app.git
cd metatool-app
cp example.env .env
docker compose up --build -d
```

Access the web interface at http://localhost:12005.

### 2. Install Required MCPs

Install the core MCP servers that the extension relies on:

```bash
# Memory MCP for session persistence
npm install -g @memory/mcp-server

# Text Editor MCP for file operations
pip install mcp-text-editor

# Fetch MCP for web content
npm install -g fetch-mcp

# Python REPL MCP for code execution
pip install python-repl-mcp
```

### 3. Configure MetaMCP API Key

1. Open the MetaMCP web interface (http://localhost:12005)
2. Navigate to API Keys
3. Create a new API key
4. Copy the API key for use in the next step

### 4. Configure MCP Client

If using Claude Desktop, update your configuration file:

```json
{
  "mcpServers": {
    "MetaMCP": {
      "command": "npx",
      "args": ["-y", "@metamcp/mcp-server-metamcp@latest"],
      "env": {
        "METAMCP_API_KEY": "<your api key>",
        "METAMCP_API_BASE_URL": "http://localhost:12005"
      }
    }
  }
}
```

For other MCP clients, follow their specific configuration instructions.

## Basic Usage

### Create Your First Workspace

1. Open the MetaMCP web interface
2. Navigate to Workspaces
3. Click "Create New Workspace"
4. Enter a name and description
5. Select the MCPs to enable (Memory, Text Editor, Fetch, and Python REPL recommended for start)
6. Click "Create"

### Enable Session Persistence

1. In your workspace settings, locate the Memory MCP configuration
2. Enable session persistence
3. Configure the session storage location
4. Set the token limit threshold (when to trigger persistence)

### Test Session Persistence

1. Start a conversation with Claude or your preferred MCP client
2. Begin working on a task that would typically exceed token limits
3. When approaching the token limit, you'll see a notification
4. Confirm to continue in a new session
5. The session will be restored with the relevant context preserved

### Use Text Editor MCP

1. In your Claude conversation, try editing a file:

```
Please help me edit this file: /path/to/your/file.txt
```

2. Claude will use the Text Editor MCP to access and modify the file
3. When you save changes, the metadata extraction will automatically run

### Use Fetch MCP

1. Ask Claude to fetch some information from the web:

```
Please fetch information about Model Context Protocol from the internet
```

2. Claude will use the Fetch MCP to retrieve and display the information

### Use Python REPL MCP

1. Ask Claude to execute some Python code:

```
Please run this Python code to analyze a dataset:

import pandas as pd
import matplotlib.pyplot as plt

# Your code here
```

2. Claude will use the Python REPL MCP to execute the code and return the results

## Next Steps

After you've set up the basic environment and tested the core features, you can explore more advanced capabilities:

1. **Create Custom Workflows**: Define sequences of operations for common tasks
2. **Configure the CI/CD Pipeline**: Set up automated testing for your projects
3. **Add More MCP Servers**: Integrate additional MCPs for specialized functionality
4. **Customize Workspace Templates**: Create templates for different types of work

## Troubleshooting

### Common Issues

1. **MCP Server Connection Fails**:
   - Verify that the MCP server is running
   - Check API key configuration
   - Ensure correct host/port settings

2. **Session Persistence Not Working**:
   - Verify Memory MCP is properly configured
   - Check storage permissions
   - Review session persistence logs

3. **Metadata Extraction Issues**:
   - Check that file paths are correctly specified
   - Verify file permissions
   - Review extraction logs for errors

### Getting Help

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting Guide](../development/troubleshooting.md)
2. Review the [GitHub Issues](https://github.com/metatool-ai/metatool-app/issues)
3. Join the [Discord Community](https://discord.gg/mNsyat7mFX)

## Resources

- [Full Documentation](../README.md)
- [API Reference](../api/overview.md)
- [Configuration Guide](configuration.md)
- [Architecture Overview](../architecture/overview.md)
