# MetaMCP Server Catalog

This document catalogs various Model Context Protocol (MCP) servers that can be integrated with MetaMCP. The catalog organizes servers by category, making it easy to select and configure the right tools for different operational modes.

## Table of Contents

- [How to Use This Catalog](#how-to-use-this-catalog)
- [Performance Benchmarking](#performance-benchmarking)
- [Memory Management](#memory-management)
- [Server Categories](#server-categories)
  - [Development & Code Tools](#development--code-tools)
  - [Knowledge Management & Documentation](#knowledge-management--documentation)
  - [Visual & Multimedia Tools](#visual--multimedia-tools)
  - [Data & Research Tools](#data--research-tools)
  - [Productivity & Communication](#productivity--communication)
  - [Finance & Business](#finance--business)
  - [System & Integration](#system--integration)
- [Mode-Based Configurations](#mode-based-configurations)
- [Appendix: MCP Server Technical Details](#appendix-mcp-server-technical-details)

## How to Use This Catalog

### Adding an MCP Server to MetaMCP

1. Select an MCP server from the catalog
2. Follow the installation instructions in the server's repository
3. Add the server configuration to your MetaMCP setup
4. Test the integration and adjust configurations as needed

### Configuration Template

```json
{
  "serverName": {
    "command": "command-to-run",
    "args": ["arg1", "arg2"],
    "env": {
      "ENV_VAR1": "value1",
      "ENV_VAR2": "value2"
    }
  }
}
```

### MCP Server Entry Format

Each MCP server in this catalog includes:

- **Name & Repository**: Direct link to source code
- **Description**: Brief overview of capabilities
- **Key Features**: Highlighted functionality
- **Configuration Example**: Ready-to-use configuration
- **Performance Notes**: Known limitations or considerations
- **Compatibility**: Tested MCP clients
- **Mode Suitability**: Recommended operational modes

## Performance Benchmarking

We use the following metrics to evaluate MCP servers:

- **Response Time**: Average time to complete tool operations
- **Stability**: Error rate and handling capabilities
- **Resource Usage**: CPU, memory, and network demands
- **Scalability**: Performance with large datasets
- **Feature Completeness**: Tool coverage vs. API capabilities

Performance benchmarks are maintained in a separate document for each category.

## Memory Management

MetaMCP supports persistent memory across different AI sessions:

- MCP servers can share memory contexts through dedicated memory servers
- Memory files can be saved to disk for long-term persistence
- Cross-session memory enhances continuity between different tools
- Memory contexts can be mode-specific or global

Recommended memory integration configurations are provided for each operational mode.

## Server Categories

### Development & Code Tools

#### [Git MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/git)
**Description**: Git repository interaction and management.
**Key Features**: 
- Repository status, diff, commit operations
- Branch and checkout management
- History and log retrieval

```json
{
  "git": {
    "command": "uvx",
    "args": ["mcp-server-git"]
  }
}
```

#### [GitHub Pera1](https://github.com/kazuph/mcp-github-pera1)
**Description**: Extracts code from GitHub repositories.
**Key Features**: 
- Filter by directories and extensions
- Branch selection
- Repository structure visualization

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@kazuph/mcp-github-pera1"]
  }
}
```

#### [GitHub Kanban MCP](https://github.com/Sunwood-ai-labs/github-kanban-mcp-server)
**Description**: Manage GitHub issues as kanban boards.
**Key Features**: 
- Issue creation and management
- Kanban-style visualization
- Task tracking and organization

```json
{
  "github-kanban": {
    "command": "github-kanban-mcp-server"
  }
}
```

#### [Python MCP](https://github.com/Alec2435/python_mcp)
**Description**: Interactive Python REPL environment.
**Key Features**: 
- Run Python code directly
- Maintain session state
- Capture stdout/stderr

```json
{
  "python_repl": {
    "command": "uv",
    "args": ["--directory", "/path/to/python_mcp", "run", "python-local"]
  }
}
```

#### [React MCP](https://github.com/Streen9/react-mcp)
**Description**: Create and modify React applications.
**Key Features**: 
- Project creation and management
- Development server handling
- Component editing

```json
{
  "react-mcp": {
    "command": "node",
    "args": ["/path/to/react-mcp/index.js"]
  }
}
```

#### [Source Sage MCP](https://github.com/Sunwood-ai-labs/source-sage-mcp-server)
**Description**: Directory structure visualization and documentation.
**Key Features**: 
- Project structure analysis
- Automatic documentation
- File exclusion patterns

```json
{
  "source-sage": {
    "command": "node",
    "args": ["/path/to/source-sage/build/index.js"]
  }
}
```

#### [WSL Exec MCP](https://github.com/spences10/mcp-wsl-exec)
**Description**: Execute commands in Windows Subsystem for Linux.
**Key Features**: 
- Secure command execution
- Working directory control
- Timeout functionality

```json
{
  "wsl-exec": {
    "command": "npx",
    "args": ["-y", "mcp-wsl-exec"]
  }
}
```

#### [Dev Memory MCP](https://github.com/TrackerXXX23/dev_memory_mcp)
**Description**: Persistent development context across projects.
**Key Features**: 
- Context tracking
- Code change monitoring
- User interaction history

```json
{
  "dev-memory": {
    "command": "node",
    "args": ["/path/to/dev_memory_mcp/build/index.js"]
  }
}
```

#### [BigQuery MCP](https://github.com/ergut/mcp-bigquery-server)
**Description**: Google BigQuery database interaction.
**Key Features**: 
- SQL query execution
- Schema inspection
- Data analysis

```json
{
  "bigquery": {
    "command": "uvx",
    "args": [
      "mcp-server-bigquery",
      "--project-id", "your-project-id",
      "--location", "us-central1"
    ]
  }
}
```

### Knowledge Management & Documentation

#### [DevDocs MCP](https://github.com/llmian-space/devdocs-mcp)
**Description**: Documentation management inspired by devdocs.io.
**Key Features**: 
- Technical documentation organization
- API reference access
- Code examples

```json
{
  "devdocs": {
    "command": "python",
    "args": ["-m", "devdocs_mcp"]
  }
}
```

#### [MCP-RTFM](https://github.com/ryanjoachim/mcp-rtfm)
**Description**: Documentation creation and enhancement.
**Key Features**: 
- Documentation analysis
- Metadata generation
- Template customization

```json
{
  "mcp-rtfm": {
    "command": "node",
    "args": ["/path/to/mcp-rtfm/build/index.js"]
  }
}
```

#### [Markdownify MCP](https://github.com/zcaceres/markdownify-mcp)
**Description**: Convert various file formats to Markdown.
**Key Features**: 
- PDF to Markdown
- Image to text with OCR
- Document format conversion

```json
{
  "markdownify": {
    "command": "node",
    "args": ["/path/to/markdownify-mcp/dist/index.js"]
  }
}
```

#### [Claude Prompts MCP](https://github.com/minipuft/claude-prompts-mcp)
**Description**: Custom prompt templates for Claude.
**Key Features**: 
- Template management
- Prompt arguments
- Prompt chaining

```json
{
  "claude-prompts": {
    "command": "node",
    "args": ["/path/to/claude-prompts-mcp/server/dist/index.js"],
    "env": {
      "WORKING_DIR": "/path/to/prompts/directory"
    }
  }
}
```

#### [OpenMetadata MCP](https://github.com/yangkyeongmo/mcp-server-openmetadata)
**Description**: Metadata management for data assets.
**Key Features**: 
- Table management
- Metadata organization
- Data cataloging

```json
{
  "openmetadata": {
    "command": "python",
    "args": ["-m", "mcp_server_openmetadata"]
  }
}
```

#### [Memory MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
**Description**: Knowledge graph-based persistent memory.
**Key Features**: 
- Entity and relation management
- Observation storage
- Graph querying

```json
{
  "memory": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-memory"]
  }
}
```

#### [Qdrant Memory MCP](https://github.com/delorenj/mcp-qdrant-memory)
**Description**: Vector-based knowledge graph with semantic search.
**Key Features**: 
- OpenAI embeddings integration
- Semantic search
- Persistent storage

```json
{
  "qdrant-memory": {
    "command": "node",
    "args": ["/path/to/mcp-qdrant-memory/build/index.js"],
    "env": {
      "OPENAI_API_KEY": "your-openai-api-key",
      "QDRANT_URL": "http://localhost:6333",
      "QDRANT_COLLECTION_NAME": "your-collection-name"
    }
  }
}
```

### Visual & Multimedia Tools

#### [MCP Webcam](https://github.com/evalstate/mcp-webcam)
**Description**: Capture live images from webcam.
**Key Features**: 
- Live webcam access
- Screenshot capability
- Image freezing

```json
{
  "webcam": {
    "command": "npx",
    "args": ["-y", "@llmindset/mcp-webcam"]
  }
}
```

#### [YouTube MCP](https://github.com/anaisbetts/mcp-youtube)
**Description**: YouTube video transcript retrieval.
**Key Features**: 
- Video transcript extraction
- Subtitle processing
- Content summarization

```json
{
  "youtube": {
    "command": "npx",
    "args": ["@anaisbetts/mcp-youtube"]
  }
}
```

#### [YouTube Transcript MCP](https://github.com/kimtaeyoon83/mcp-server-youtube-transcript)
**Description**: YouTube transcript extraction with language options.
**Key Features**: 
- Multiple language support
- Transcript formatting
- URL processing

```json
{
  "youtube-transcript": {
    "command": "npx",
    "args": ["-y", "@kimtaeyoon83/mcp-server-youtube-transcript"]
  }
}
```

#### [Spotify MCP](https://github.com/superseoworld/mcp-spotify)
**Description**: Spotify music service integration.
**Key Features**: 
- Music search and recommendations
- Playlist management
- Audiobook support

```json
{
  "spotify": {
    "command": "npx",
    "args": ["-y", "@thomaswawra/artistlens"]
  }
}
```

### Data & Research Tools

#### [Research Kit](https://github.com/nguyenvanduocit/research-kit)
**Description**: Research task management with development tool integration.
**Key Features**: 
- Integration with Jira, Confluence, GitLab
- Advanced reasoning with Deepseek
- Sequential thinking support

```json
{
  "research_kit": {
    "command": "research-kit",
    "args": ["-env", "/path/to/.env"]
  }
}
```

#### [Fetch Kit](https://github.com/nguyenvanduocit/fetch-kit)
**Description**: Web content retrieval and search.
**Key Features**: 
- Web content fetching
- Search functionality
- YouTube transcript extraction

```json
{
  "fetch_kit": {
    "command": "fetch-kit",
    "args": ["-env", "/path/to/.env"]
  }
}
```

#### [RAG Kit](https://github.com/nguyenvanduocit/rag-kit)
**Description**: Retrieval-Augmented Generation with vector databases.
**Key Features**: 
- Qdrant vector DB integration
- Document indexing
- Semantic search

```json
{
  "rag_kit": {
    "command": "rag-kit",
    "args": ["-env", "/path/to/.env"]
  }
}
```

#### [RagDocs](https://github.com/heltonteixeira/ragdocs)
**Description**: RAG-based document search and management.
**Key Features**: 
- Document metadata management
- Semantic search
- Multiple embedding providers

```json
{
  "ragdocs": {
    "command": "node",
    "args": ["@mcpservers/ragdocs"],
    "env": {
      "QDRANT_URL": "http://127.0.0.1:6333",
      "EMBEDDING_PROVIDER": "ollama"
    }
  }
}
```

#### [Higress AI Search](https://github.com/cr7258/higress-ai-search-mcp-server)
**Description**: AI search enhancement for LLM responses.
**Key Features**: 
- Multiple search engine integration
- Academic search
- Internal knowledge search

```json
{
  "higress-ai-search": {
    "command": "uvx",
    "args": ["higress-ai-search-mcp-server"],
    "env": {
      "HIGRESS_URL": "http://localhost:8080/v1/chat/completions",
      "MODEL": "qwen-turbo"
    }
  }
}
```

#### [Everything Search MCP](https://github.com/mamertofabian/mcp-everything-search)
**Description**: Fast file searching across operating systems.
**Key Features**: 
- Windows Everything SDK integration
- macOS Spotlight integration
- Linux locate/plocate support

```json
{
  "everything-search": {
    "command": "uvx",
    "args": ["mcp-server-everything-search"]
  }
}
```

### Productivity & Communication

#### [Google Kit](https://github.com/nguyenvanduocit/google-kit)
**Description**: Google services integration.
**Key Features**: 
- Google Calendar tools
- Gmail tools
- Google Chat integration

```json
{
  "google_kit": {
    "command": "google-kit",
    "args": ["-env", "/path/to/.env"]
  }
}
```

#### [Gmail MCP](https://github.com/vinayak-mehta/gmail-mcp)
**Description**: Gmail search and retrieval.
**Key Features**: 
- Email search
- Message content retrieval
- Recent message listing

```json
{
  "gmail": {
    "command": "uvx",
    "args": ["--from", "git+https://github.com/vinayak-mehta/gmail-mcp", "gmail-mcp"],
    "env": {
      "GMAIL_CREDS_PATH": "/path/to/credentials.json",
      "GMAIL_TOKEN_PATH": "/path/to/token.json"
    }
  }
}
```

#### [X (Twitter) MCP](https://github.com/vidhupv/x-mcp)
**Description**: X (Twitter) integration.
**Key Features**: 
- Tweet creation and publishing
- Post management
- Social media engagement

```json
{
  "x_mcp": {
    "command": "uvx",
    "args": ["x-mcp"],
    "env": {
      "TWITTER_API_KEY": "your_api_key",
      "TWITTER_API_SECRET": "your_api_secret",
      "TWITTER_ACCESS_TOKEN": "your_access_token",
      "TWITTER_ACCESS_TOKEN_SECRET": "your_access_token_secret"
    }
  }
}
```

#### [MCP Webhook](https://github.com/kevinwatt/mcp-webhook)
**Description**: Send messages to webhook endpoints.
**Key Features**: 
- Message sending with custom username
- Avatar customization
- Generic webhook support

```json
{
  "webhook": {
    "command": "npx",
    "args": ["-y", "@kevinwatt/mcp-webhook"],
    "env": {
      "WEBHOOK_URL": "your-webhook-url"
    }
  }
}
```

#### [Anki MCP](https://github.com/samefarrar/mcp-ankiconnect)
**Description**: Anki flashcard management.
**Key Features**: 
- Card due counting
- Due card retrieval
- Review submission

```json
{
  "anki": {
    "command": "uv",
    "args": ["run", "--with", "mcp-ankiconnect", "mcp-ankiconnect"]
  }
}
```

#### [LinkedIn MCP](https://github.com/Hritik003/linkedin-mcp)
**Description**: LinkedIn job search and application.
**Key Features**: 
- Job searching
- Resume analysis
- Feed post retrieval

```json
{
  "linkedin": {
    "command": "uv",
    "args": ["--directory", "/path/to/linkedin-mcp", "run", "linkedin.py"]
  }
}
```

#### [Ticketmaster MCP](https://github.com/delorenj/mcp-server-ticketmaster)
**Description**: Event search and discovery.
**Key Features**: 
- Event searching
- Venue information
- Attraction details

```json
{
  "ticketmaster": {
    "command": "npx",
    "args": ["-y", "@delorenj/mcp-server-ticketmaster"],
    "env": {
      "TICKETMASTER_API_KEY": "your-api-key-here"
    }
  }
}
```

### Finance & Business

#### [Financial Data MCP](https://github.com/xBlueCode/findata-mcp-server)
**Description**: Stock market data retrieval.
**Key Features**: 
- Current stock quotes
- Historical data analysis
- Alpha Vantage API integration

```json
{
  "alphaVantage": {
    "command": "npx",
    "args": ["-y", "findata-mcp-server"],
    "env": {
      "ALPHA_VANTAGE_API_KEY": "your-api-key"
    }
  }
}
```

#### [AWS Cost Explorer MCP](https://github.com/aarora79/aws-cost-explorer-mcp-server)
**Description**: AWS cost analysis.
**Key Features**: 
- EC2 spend analysis
- Bedrock spend analysis
- Service cost reports

```json
{
  "aws-cost-explorer": {
    "command": "python",
    "args": ["server.py"],
    "env": {
      "MCP_TRANSPORT": "stdio",
      "BEDROCK_LOG_GROUP_NAME": "your-log-group-name"
    }
  }
}
```

#### [Excel MCP](https://github.com/negokaz/excel-mcp-server)
**Description**: Excel spreadsheet interaction.
**Key Features**: 
- Read sheet data
- Write sheet data
- Sheet image capture

```json
{
  "excel": {
    "command": "npx",
    "args": ["--yes", "@negokaz/excel-mcp-server"],
    "env": {
      "EXCEL_MCP_PAGING_CELLS_LIMIT": "4000"
    }
  }
}
```

### System & Integration

#### [OpenAPI MCP](https://github.com/snaggle-ai/openapi-mcp-server)
**Description**: OpenAPI specification integration.
**Key Features**: 
- Automatic endpoint conversion
- Parameter validation
- File upload support

```json
{
  "openapi": {
    "command": "npx",
    "args": ["openapi-mcp-server", "/path/to/openapi.json"]
  }
}
```

#### [MCP Proxy Server](https://github.com/adamwattis/mcp-proxy-server)
**Description**: Aggregate multiple MCP servers.
**Key Features**: 
- Tool aggregation
- Resource management
- Central routing hub

```json
{
  "mcp-proxy": {
    "command": "/path/to/mcp-proxy-server/build/index.js",
    "env": {
      "MCP_CONFIG_PATH": "/path/to/config.json",
      "KEEP_SERVER_OPEN": "1"
    }
  }
}
```

#### [MCP Server Restart](https://github.com/non-dirty/mcp-server-restart)
**Description**: Restart Claude Desktop.
**Key Features**: 
- Safe application restart
- Status monitoring
- Process management

```json
{
  "mcp-server-restart": {
    "command": "uvx",
    "args": ["mcp-server-restart"]
  }
}
```

## Mode-Based Configurations

### Software Development Mode

```json
{
  "mcp-config": {
    "mode": "development",
    "enabledServers": [
      "git",
      "github",
      "github-kanban",
      "python_repl",
      "react-mcp",
      "source-sage",
      "dev-memory",
      "devdocs"
    ],
    "memoryIntegration": {
      "server": "qdrant-memory",
      "persistencePath": "/path/to/dev-memory.json",
      "entities": ["codebase", "project_structure", "development_plan"]
    }
  }
}
```

### Research & Analysis Mode

```json
{
  "mcp-config": {
    "mode": "research",
    "enabledServers": [
      "research_kit",
      "fetch_kit",
      "rag_kit",
      "ragdocs",
      "higress-ai-search",
      "markdownify"
    ],
    "memoryIntegration": {
      "server": "qdrant-memory",
      "persistencePath": "/path/to/research-memory.json",
      "entities": ["research_topic", "information_sources", "key_findings"]
    }
  }
}
```

### Content Creation Mode

```json
{
  "mcp-config": {
    "mode": "content",
    "enabledServers": [
      "webcam",
      "youtube",
      "youtube-transcript",
      "x_mcp",
      "markdownify",
      "spotify"
    ],
    "memoryIntegration": {
      "server": "memory",
      "persistencePath": "/path/to/content-memory.json",
      "entities": ["content_topics", "media_assets", "publishing_channels"]
    }
  }
}
```

### Productivity Mode

```json
{
  "mcp-config": {
    "mode": "productivity",
    "enabledServers": [
      "google_kit",
      "gmail",
      "excel",
      "anki",
      "webhook",
      "claude-prompts"
    ],
    "memoryIntegration": {
      "server": "memory",
      "persistencePath": "/path/to/productivity-memory.json",
      "entities": ["tasks", "communications", "schedule"]
    }
  }
}
```

### Finance & Business Mode

```json
{
  "mcp-config": {
    "mode": "finance",
    "enabledServers": [
      "alphaVantage",
      "aws-cost-explorer",
      "excel",
      "bigquery"
    ],
    "memoryIntegration": {
      "server": "memory",
      "persistencePath": "/path/to/finance-memory.json",
      "entities": ["financial_data", "cost_analysis", "reports"]
    }
  }
}
```

## Appendix: MCP Server Technical Details

### Memory Persistence Strategies

1. **File-Based Persistence**
   - Store memory as JSON files
   - Manually back up and restore memories
   - Suitable for simple deployments

2. **Vector Database Integration**
   - Use Qdrant or other vector stores
   - Enable semantic search capabilities
   - Better for large knowledge graphs

3. **Cross-Session Memory**
   - Memory sharing between AI sessions
   - Entity relationship tracking
   - Context preservation

### Testing Protocol

For consistent testing of MCP servers:

1. **Functionality Testing**
   - Verify all documented tools work
   - Test edge cases with unusual inputs
   - Ensure error handling is robust

2. **Integration Testing**
   - Test interaction with MetaMCP
   - Verify proper resource handling
   - Check memory persistence

3. **Performance Testing**
   - Measure response times
   - Monitor resource usage
   - Test with realistic workloads

### Maintenance Guidelines

To maintain a healthy MCP server ecosystem:

1. **Regular Updates**
   - Check for new versions monthly
   - Test updates in isolation before integration
   - Document any breaking changes

2. **Configuration Management**
   - Use version control for configurations
   - Document environment variables
   - Maintain backup configurations

3. **Troubleshooting**
   - Enable detailed logging when issues occur
   - Check server logs for errors
   - Verify network connectivity

### Custom Server Development

Guidelines for developing new MCP servers:

1. **Follow MCP Protocol Standards**
   - Implement standard initialization
   - Support proper error handling
   - Document all tools and schemas

2. **Provide Clear Documentation**
   - Tool descriptions and examples
   - Configuration requirements
   - Performance considerations

3. **Consider Security**
   - Implement proper authentication
   - Restrict dangerous operations
   - Document security considerations