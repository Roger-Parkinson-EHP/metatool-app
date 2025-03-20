# Installation Guide

## Overview

This guide provides detailed instructions for installing the MetaMCP extension with session persistence, MCP integration, and CI/CD capabilities. The installation process includes setting up the base MetaMCP environment, configuring essential MCP servers, and establishing the necessary connections.

## Prerequisites

Before beginning the installation, ensure your system meets the following requirements:

### System Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+ recommended)
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB+ recommended
- **Storage**: 1GB free space minimum, 5GB+ recommended for storing sessions and metadata
- **Network**: Broadband internet connection

### Required Software

- **Docker**: Version 20.10.0 or higher
- **Docker Compose**: Version 2.0.0 or higher
- **Node.js**: Version 14.0.0 or higher
- **npm**: Version 7.0.0 or higher
- **Python**: Version 3.8 or higher
- **pip**: Latest version
- **Git**: Latest version

## Installation Steps

### 1. Install MetaMCP Base Environment

#### Using Docker (Recommended)

1. Clone the MetaMCP repository:

```bash
git clone https://github.com/metatool-ai/metatool-app.git
cd metatool-app
```

2. Create environment configuration:

```bash
cp example.env .env
```

3. Edit the `.env` file to configure your installation. Key settings include:
   - `PORT`: The port the web interface will listen on (default: 12005)
   - `DATA_DIR`: Directory for persistent storage
   - `LOG_LEVEL`: Logging verbosity

4. Start the Docker containers:

```bash
docker compose up --build -d
```

5. Verify the installation by accessing the web interface at `http://localhost:12005` (or the port you specified).

#### Manual Installation (Advanced)

For users who prefer not to use Docker, manual installation is possible but more complex:

1. Clone the repository:

```bash
git clone https://github.com/metatool-ai/metatool-app.git
cd metatool-app
```

2. Install server dependencies:

```bash
cd server
npm install
```

3. Install client dependencies:

```bash
cd ../client
npm install
```

4. Build the client:

```bash
npm run build
```

5. Start the server:

```bash
cd ../server
npm start
```

6. Access the web interface at `http://localhost:12005`.

### 2. Install Required MCP Servers

#### Memory MCP

1. Install the Memory MCP server:

```bash
npm install -g @memory/mcp-server
```

2. Create a basic configuration in `~/.memory-mcp/config.json`:

```json
{
  "storage": {
    "type": "file",
    "directory": "~/.memory-mcp/data"
  },
  "server": {
    "port": 3000
  }
}
```

#### Text Editor MCP

1. Install the Text Editor MCP server:

```bash
pip install mcp-text-editor
```

2. Verify the installation:

```bash
python -m mcp_text_editor --version
```

#### Fetch MCP

1. Install the Fetch MCP server:

```bash
npm install -g fetch-mcp
```

2. Verify the installation:

```bash
fetch-mcp --version
```

#### Python REPL MCP

1. Install the Python REPL MCP server:

```bash
pip install python-repl-mcp
```

2. Verify the installation:

```bash
python -m python_repl_mcp --version
```

### 3. Configure MetaMCP API Access

1. Access the MetaMCP web interface at `http://localhost:12005`

2. Navigate to the "API Keys" section

3. Click "Create New API Key"

4. Provide a name for the key (e.g., "Local Development")

5. Set appropriate permissions
   - For development, select all permissions
   - For production, limit to necessary permissions

6. Click "Create" and copy the generated API key

7. Store this key securely; it will be required for MCP server configuration

### 4. Configure MCP Client

#### Claude Desktop Configuration

1. Locate your Claude Desktop configuration file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Edit the configuration to add MetaMCP:

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

3. Replace `<your api key>` with the API key you created in step 3

#### Cursor Configuration

1. Open Cursor's settings

2. Navigate to the "AI" section, then "MCP Servers"

3. Add a new MCP server with the following configuration:
   - Name: MetaMCP
   - Command: `npx`
   - Arguments: `-y @metamcp/mcp-server-metamcp@latest --metamcp-api-key <your-api-key> --metamcp-api-base-url http://localhost:12005`

4. Replace `<your-api-key>` with the API key you created in step 3

#### Other MCP Clients

For other MCP clients, follow their specific configuration instructions, using the MetaMCP server as the MCP provider with the appropriate API key and base URL.

### 5. Setup Session Persistence Extension

1. Create a directory for session storage:

```bash
mkdir -p ~/.metamcp/sessions
```

2. Configure session persistence in the MetaMCP web interface:
   - Navigate to Settings > Extensions
   - Enable "Session Persistence"
   - Set the storage directory to your created folder
   - Configure token threshold (recommended: 75% of your client's token limit)

3. Verify session persistence configuration:
   - Check logs for successful initialization
   - Ensure Memory MCP is properly connected

### 6. Configure MCP Servers in MetaMCP

1. Access the MetaMCP web interface

2. Navigate to "MCP Servers" configuration

3. Add each of the installed MCP servers:

#### Text Editor MCP Configuration

- Name: `TextEditor`
- Command: `python`
- Arguments: `-m mcp_text_editor`
- Working Directory: Leave empty for default
- Environment Variables: Leave empty for default

#### Fetch MCP Configuration

- Name: `Fetch`
- Command: `fetch-mcp`
- Arguments: Leave empty for default
- Working Directory: Leave empty for default
- Environment Variables: Leave empty for default

#### Python REPL MCP Configuration

- Name: `PythonREPL`
- Command: `python`
- Arguments: `-m python_repl_mcp`
- Working Directory: Leave empty for default
- Environment Variables: Leave empty for default

#### Memory MCP Configuration

- Name: `Memory`
- Command: `memory-mcp-server`
- Arguments: `--config ~/.memory-mcp/config.json`
- Working Directory: Leave empty for default
- Environment Variables: Leave empty for default

4. Save the configuration

5. Test each MCP server by clicking "Test Connection"

### 7. Create a Workspace

1. In the MetaMCP web interface, navigate to "Workspaces"

2. Click "Create New Workspace"

3. Configure the workspace:
   - Name: Provide a descriptive name (e.g., "Development")
   - Description: Optional description of the workspace purpose
   - Enabled MCP Servers: Select all installed servers
   - Session Persistence: Enable and configure

4. Click "Create"

5. Verify workspace creation by navigating to the new workspace

## Verification

Follow these steps to verify your installation is working correctly:

### Testing MetaMCP Connection

1. Start your MCP client (Claude Desktop, Cursor, etc.)

2. Verify that the MetaMCP server is listed as an available MCP

3. Start a conversation and verify connection by asking: "What MCP tools do you have available?"

### Testing Session Persistence

1. Start a conversation in your MCP client

2. Create a context-rich conversation (work on code, research, etc.)

3. Wait for the session token limit notification

4. Confirm continuation in a new session

5. Verify that context is preserved appropriately

### Testing MCP Functionality

#### Text Editor MCP

Ask your MCP client to:

```
Please create a new file called test.txt with the content "Hello, World!"
```

Then ask it to read the file back:

```
Please read the contents of test.txt
```

#### Fetch MCP

Ask your MCP client to retrieve web content:

```
Please fetch the content from https://example.com
```

#### Python REPL MCP

Ask your MCP client to execute Python code:

```
Please run this Python code:

import platform
print(f"Python version: {platform.python_version()}")
print(f"System: {platform.system()} {platform.release()}")
```

## Troubleshooting

### Common Issues

#### MetaMCP Server Not Starting

**Symptoms**: Web interface not accessible, Docker containers failing

**Solutions**:
- Check Docker logs: `docker logs metatool-app-server-1`
- Verify port availability: Ensure port 12005 is not in use
- Check `.env` configuration: Verify settings are correct

#### MCP Connection Failures

**Symptoms**: MCP client cannot connect to MetaMCP

**Solutions**:
- Verify API key: Ensure the key is correctly configured
- Check network settings: Confirm localhost accessibility
- Inspect logs: Look for connection errors in MetaMCP logs

#### Session Persistence Issues

**Symptoms**: Context not being saved or restored

**Solutions**:
- Check Memory MCP: Ensure it's running and configured
- Verify storage permissions: Check access to session storage directory
- Review session logs: Look for serialization or deserialization errors

#### MCP Server Integration Problems

**Symptoms**: Specific MCP functionality not working

**Solutions**:
- Verify server installation: Confirm the MCP server is properly installed
- Check configuration: Ensure correct command and arguments
- Test individual server: Run the MCP server directly to verify functionality

### Getting Help

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting Guide](../development/troubleshooting.md)
2. Review the [GitHub Issues](https://github.com/metatool-ai/metatool-app/issues)
3. Join the [Discord Community](https://discord.gg/mNsyat7mFX)

## Next Steps

After successful installation:

1. Configure your workspace settings and preferences
2. Set up additional MCP servers for specialized functionality
3. Create workspace templates for common activities
4. Explore advanced configuration options

See the [Configuration Guide](configuration.md) for detailed information on customizing your installation.
