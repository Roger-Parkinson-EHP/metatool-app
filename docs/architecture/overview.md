# Architecture Overview

## System Architecture

The MetaMCP extension builds upon the existing MetaMCP architecture, enhancing it with session persistence, integrated DevOps processes, and improved workflow capabilities.

### High-Level Architecture

```mermaid
flowchart TD
    subgraph MCP_Clients["MCP Clients"]
        Claude["Claude Desktop"]  
        Cursor["Cursor"] 
        Other["Other MCP Clients"]
    end
    
    subgraph MetaMCP["MetaMCP System"]
        MMCP_Server["MetaMCP MCP Server"] 
        MMCP_App["MetaMCP App"] 
        Sessions["Session Manager"]
        Metadata["Metadata System"]
        CI_CD["CI/CD Pipeline"]
    end
    
    subgraph MCP_Servers["MCP Servers"]
        TextEditor["Text Editor MCP"] 
        Fetch["Fetch MCP"] 
        Python["Python REPL MCP"] 
        Memory["Memory MCP"]
        Git["Git MCP"]
        Other_MCPs["Other MCPs"]
    end
    
    subgraph Storage["Storage"]
        Session_Store["Session Store"] 
        Metadata_Store["Metadata Store"] 
        Workspace_Config["Workspace Configs"] 
    end
    
    MCP_Clients --> MMCP_Server
    MMCP_Server <--> MMCP_App
    MMCP_App <--> Sessions
    MMCP_App <--> Metadata
    MMCP_App <--> CI_CD
    Sessions <--> Session_Store
    Metadata <--> Metadata_Store
    MMCP_App <--> Workspace_Config
    MMCP_Server <--> MCP_Servers
    CI_CD --> TextEditor
    CI_CD --> Python
    Sessions --> Memory
```

### Core Components

#### MetaMCP MCP Server

The MetaMCP MCP Server acts as an intermediary between MCP clients (such as Claude Desktop, Cursor, etc.) and the various MCP servers. It aggregates all available tools from the configured MCP servers and routes tool calls to the appropriate target servers.

#### MetaMCP App

The MetaMCP App provides the user interface and management functionality for the system. It allows users to configure workspaces, manage MCP servers, and interact with the system's features.

#### Session Manager

The Session Manager is a new component that handles session persistence across token limits. It works with the Memory MCP to serialize and restore session state, enabling continuous work without context loss.

#### Metadata System

The Metadata System extracts and manages metadata from files and operations. It provides structured information that drives the CI/CD pipeline and supports intelligent context restoration.

#### CI/CD Pipeline

The CI/CD Pipeline component automates testing and validation based on file changes detected through the Text Editor MCP. It generates and runs tests, providing immediate feedback on code quality and functionality.

## Data Flow

### Tool Request Flow

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant MMCP as MetaMCP MCP Server
    participant App as MetaMCP App
    participant MCPs as MCP Servers
    
    Client->>MMCP: List tools request
    MMCP->>App: Get tools configuration
    App->>MMCP: Return configurations
    
    loop For each MCP Server
        MMCP->>MCPs: Request tools list
        MCPs->>MMCP: Return tools list
    end
    
    MMCP->>MMCP: Aggregate tools
    MMCP->>Client: Return aggregated tools
    
    Client->>MMCP: Tool call request
    MMCP->>MCPs: Forward to target MCP
    MCPs->>MMCP: Return tool response
    MMCP->>Client: Return response
```

### Session Persistence Flow

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant MMCP as MetaMCP MCP Server
    participant SM as Session Manager
    participant Memory as Memory MCP
    participant Store as Session Store
    
    Client->>MMCP: Approaching token limit
    MMCP->>SM: Serialize session
    SM->>Memory: Store session context
    Memory->>Store: Write to storage
    Store-->>Memory: Confirm storage
    Memory-->>SM: Confirm storage
    SM-->>MMCP: Session saved
    MMCP-->>Client: Continue in new session
    
    Client->>MMCP: Restore session request
    MMCP->>SM: Request session restoration
    SM->>Memory: Retrieve session context
    Memory->>Store: Read from storage
    Store-->>Memory: Return session data
    Memory-->>SM: Return context
    SM-->>MMCP: Session context
    MMCP-->>Client: Restored context
```

### CI/CD Process Flow

```mermaid
sequenceDiagram
    participant Editor as Text Editor MCP
    participant MMCP as MetaMCP MCP Server
    participant CI as CI/CD Pipeline
    participant Meta as Metadata System
    participant Python as Python REPL MCP
    participant Store as Metadata Store
    
    Editor->>MMCP: File changed (hash change)
    MMCP->>CI: Trigger CI process
    CI->>Meta: Extract metadata
    Meta->>Store: Store metadata
    Store-->>Meta: Metadata stored
    CI->>Python: Generate & run tests
    Python->>CI: Test results
    CI->>Store: Store test results
    CI->>Editor: Generate markdown report
    Editor->>MMCP: Updated file with feedback
    MMCP->>Editor: Confirm update
```

## Component Interactions

### Workspace and Session Integration

Workspaces provide isolated environments for different activities. The session persistence feature operates within the context of a workspace, ensuring that when sessions are saved and restored, they maintain the appropriate isolation between different contexts.

```mermaid
graph TD
    subgraph Workspace_1
        Session_1A["Session 1"]  
        Session_1B["Session 2"] 
        Memory_1["Workspace Memory"] 
    end
    
    subgraph Workspace_2
        Session_2A["Session 1"]  
        Session_2B["Session 2"] 
        Memory_2["Workspace Memory"] 
    end
    
    Session_1A --> Memory_1
    Session_1B --> Memory_1
    Session_2A --> Memory_2
    Session_2B --> Memory_2
    
    Memory_1 -.-> Session_Store
    Memory_2 -.-> Session_Store
```

### MCP Server Integration

The system integrates various MCP servers to provide comprehensive capabilities. Each MCP server provides specific functionality that can be combined with others to create powerful workflows.

```mermaid
graph TD
    MMCP_Server["MetaMCP MCP Server"] --> TextEditor["Text Editor MCP"]
    MMCP_Server --> Fetch["Fetch MCP"]
    MMCP_Server --> Python["Python REPL MCP"]
    MMCP_Server --> Memory["Memory MCP"]
    MMCP_Server --> Git["Git MCP"]
    MMCP_Server --> RAG["RAG Kit"]
    MMCP_Server --> Google["Google Kit"]
    MMCP_Server --> Prompts["Claude Prompts MCP"]
    
    subgraph Development
        TextEditor
        Python
        Git
    end
    
    subgraph Research
        Fetch
        RAG
    end
    
    subgraph Productivity
        Google
        Prompts
    end
    
    subgraph Core
        Memory
    end
```

## Key Design Principles

1. **Leverage Existing Infrastructure**: Build upon the current MetaMCP architecture rather than creating new systems from scratch.

2. **Separation of Concerns**: Keep components focused on specific responsibilities to maintain modularity and flexibility.

3. **Progressive Enhancement**: Add features incrementally, ensuring that each stage provides immediate value.

4. **Contextual Isolation**: Maintain clear boundaries between different workspaces to prevent context pollution.

5. **Automation**: Automate repetitive tasks through metadata extraction and testing to accelerate development.

6. **Composability**: Design components that can be easily combined to create powerful workflows.

7. **User Experience**: Focus on seamless experiences that minimize disruption when hitting token limits or switching contexts.

## Technology Stack

- **Backend**: Node.js, TypeScript
- **Frontend**: React, TypeScript
- **Storage**: File-based storage with future database options
- **Integration**: MCP protocol for communication between components
- **Testing**: Language-specific testing frameworks via Python REPL MCP
- **Metadata**: JSON-based schemas with extensibility

## Security Considerations

- **API Key Management**: Secure storage and transmission of API keys
- **File Access Controls**: Appropriate permissions for file operations
- **Workspace Isolation**: Prevention of unauthorized cross-workspace access
- **Session Data Protection**: Secure storage of session state
- **MCP Server Security**: Validation of MCP server operations

## Next Steps

The architecture will be implemented in phases, starting with the core components and expanding to more advanced features. The initial focus will be on:

1. Setting up the base environment
2. Implementing session persistence
3. Integrating core MCP servers (Text Editor, Fetch, Python REPL)
4. Creating the metadata extraction system

For more detailed information on specific components, see:

- [Components](components.md)
- [Data Flow](data-flow.md)
- [Integration Patterns](integration-patterns.md)
