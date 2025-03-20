# Architecture Diagrams

## System Architecture

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

### Component Interactions

```mermaid
flowchart TD
    subgraph Client_Layer["Client Layer"]
        MCP_Client["MCP Client"] 
    end
    
    subgraph Server_Layer["Server Layer"]
        MMCP_Server["MetaMCP MCP Server"] 
    end
    
    subgraph Application_Layer["Application Layer"]
        MMCP_App["MetaMCP App"]
        Sessions["Session Manager"]
        Metadata["Metadata System"]
        CI_CD["CI/CD Pipeline"]
        Workspace["Workspace Manager"]
    end
    
    subgraph Service_Layer["Service Layer"]
        MCP_Registry["MCP Registry"]
        Event_System["Event System"]
        Auth["Authentication"]  
    end
    
    subgraph Integration_Layer["Integration Layer"]
        TextEditor["Text Editor MCP"]
        Fetch["Fetch MCP"]
        Python["Python REPL MCP"]
        Memory["Memory MCP"]
        Git["Git MCP"]
    end
    
    subgraph Storage_Layer["Storage Layer"]
        File_System["File System"]
        DB["Database (Future)"] 
    end
    
    MCP_Client <--> MMCP_Server
    MMCP_Server <--> MMCP_App
    MMCP_Server <--> MCP_Registry
    
    MMCP_App <--> Sessions
    MMCP_App <--> Metadata
    MMCP_App <--> CI_CD
    MMCP_App <--> Workspace
    
    Sessions <--> Event_System
    Metadata <--> Event_System
    CI_CD <--> Event_System
    Workspace <--> Event_System
    
    MMCP_Server <--> TextEditor
    MMCP_Server <--> Fetch
    MMCP_Server <--> Python
    MMCP_Server <--> Memory
    MMCP_Server <--> Git
    
    Sessions <--> Memory
    Metadata <--> File_System
    Workspace <--> File_System
    Memory <--> File_System
    
    MCP_Registry <--> Auth
    MMCP_App <--> Auth
```

## Session Persistence Architecture

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

### Session Data Model

```mermaid
erDiagram
    SESSION {
        string id PK
        timestamp created_at
        string workspace_id FK
        int token_count
        string summary
    }
    
    CONVERSATION {
        string id PK
        string session_id FK
        string context
        int token_count
    }
    
    CONTEXT_ITEM {
        string id PK
        string category
        string content
        int importance
        int token_count
    }
    
    FILE_REFERENCE {
        string id PK
        string path
        string hash
        timestamp last_modified
    }
    
    WORKSPACE_STATE {
        string id PK
        string workspace_id FK
        string active_project
        string[] enabled_mcps
        string settings
    }
    
    SESSION ||--|| CONVERSATION : "has"
    SESSION ||--o{ CONTEXT_ITEM : "contains"
    SESSION ||--o{ FILE_REFERENCE : "references"
    SESSION ||--|| WORKSPACE_STATE : "has"
    SESSION ||--o{ SESSION : "continues"
```

## Metadata Extraction Architecture

### Metadata Extraction Flow

```mermaid
sequenceDiagram
    participant Editor as Text Editor MCP
    participant MMCP as MetaMCP MCP Server
    participant MS as Metadata System
    participant Extractors as File Type Extractors
    participant Store as Metadata Store
    participant CI as CI/CD Pipeline
    
    Editor->>MMCP: File changed (hash change)
    MMCP->>MS: Trigger metadata extraction
    MS->>Extractors: Process file
    
    alt JavaScript/TypeScript File
        Extractors->>Extractors: Extract functions, classes, imports
    else Python File
        Extractors->>Extractors: Extract functions, classes, imports
    else Markdown File
        Extractors->>Extractors: Extract structure, links
    else Configuration File
        Extractors->>Extractors: Extract schema, parameters
    else Other File
        Extractors->>Extractors: Extract basic metadata
    end
    
    Extractors-->>MS: Return extracted metadata
    MS->>Store: Store metadata
    Store-->>MS: Confirm storage
    MS-->>MMCP: Metadata extraction complete
    MS->>CI: Notify about metadata change
    CI->>MS: Request metadata
    MS-->>CI: Return metadata
    CI->>CI: Generate tests based on metadata
```

### Metadata Schema

```mermaid
erDiagram
    FILE {
        string path PK
        string hash
        int size
        int line_count
        timestamp last_modified
    }
    
    EXTRACTION {
        string id PK
        string file_path FK
        timestamp timestamp
        string extractor_version
        string extractor_type
    }
    
    JS_METADATA {
        string id PK
        string extraction_id FK
        string[] functions
        string[] classes
        string[] imports
        string[] exports
    }
    
    PY_METADATA {
        string id PK
        string extraction_id FK
        string[] functions
        string[] classes
        string[] imports
        string[] decorators
    }
    
    MD_METADATA {
        string id PK
        string extraction_id FK
        string[] headings
        string[] links
        string[] code_blocks
        string[] tables
    }
    
    CONFIG_METADATA {
        string id PK
        string extraction_id FK
        string schema
        string[] parameters
        string[] env_vars
    }
    
    QUALITY_METRICS {
        string id PK
        string extraction_id FK
        float complexity
        float maintainability
        float test_coverage
        int issue_count
    }
    
    FILE ||--o{ EXTRACTION : "has"
    EXTRACTION ||--o| JS_METADATA : "produces"
    EXTRACTION ||--o| PY_METADATA : "produces"
    EXTRACTION ||--o| MD_METADATA : "produces"
    EXTRACTION ||--o| CONFIG_METADATA : "produces"
    EXTRACTION ||--|| QUALITY_METRICS : "has"
```

## CI/CD Pipeline Architecture

### CI/CD Process Flow

```mermaid
sequenceDiagram
    participant Editor as Text Editor MCP
    participant MS as Metadata System
    participant CI as CI/CD Pipeline
    participant TG as Test Generator
    participant Python as Python REPL MCP
    participant Reporter as Result Reporter
    
    Editor->>MS: File changed
    MS->>CI: Notify about metadata change
    CI->>MS: Request metadata
    MS-->>CI: Return metadata
    
    CI->>TG: Generate tests
    
    alt JavaScript File
        TG->>TG: Generate Jest tests
    else Python File
        TG->>TG: Generate pytest tests
    else Other File
        TG->>TG: Generate appropriate tests
    end
    
    TG-->>CI: Return test code
    CI->>Python: Execute tests
    Python-->>CI: Return test results
    CI->>Reporter: Generate report
    Reporter-->>CI: Return markdown report
    CI->>Editor: Update file with results
```

## Workspace Management Architecture

### Workspace Structure

```mermaid
flowchart TD
    subgraph Workspace["Workspace"]
        WS_Config["Workspace Configuration"]
        WS_State["Workspace State"]
        
        subgraph Projects["Projects"]
            Project_1["Project 1"]
            Project_2["Project 2"]
        end
        
        subgraph MCP_Config["MCP Configurations"]
            TextEditor_Config["Text Editor Config"]
            Fetch_Config["Fetch Config"]
            Python_Config["Python REPL Config"]
            Memory_Config["Memory Config"]
        end
        
        subgraph Sessions["Sessions"]
            Session_1["Session 1"]
            Session_2["Session 2"]
        end
    end
    
    WS_Config --> Projects
    WS_Config --> MCP_Config
    WS_State --> Sessions
    
    Project_1 --> Files_1["Files"]
    Project_1 --> Resources_1["Resources"]
    
    Project_2 --> Files_2["Files"]
    Project_2 --> Resources_2["Resources"]
    
    Session_1 --> Context_1["Context"]
    Session_2 --> Context_2["Context"]
```

### Workspace Interaction

```mermaid
sequenceDiagram
    participant User
    participant Client as MCP Client
    participant MMCP as MetaMCP MCP Server
    participant WM as Workspace Manager
    participant Store as Workspace Store
    
    User->>Client: Select workspace
    Client->>MMCP: Set active workspace
    MMCP->>WM: Activate workspace
    WM->>Store: Load workspace configuration
    Store-->>WM: Return configuration
    WM->>WM: Configure workspace environment
    WM-->>MMCP: Workspace activated
    MMCP-->>Client: Workspace context set
    Client-->>User: Workspace ready
    
    User->>Client: Perform operation
    Client->>MMCP: Execute operation
    MMCP->>WM: Get workspace context
    WM-->>MMCP: Return workspace context
    MMCP->>MMCP: Execute in workspace context
    MMCP-->>Client: Return result
    Client-->>User: Display result
```

## Phase 1 Implementation Focus

```mermaid
flowchart TD
    subgraph Phase_1["Phase 1: Foundation"]  
        Base["Base Setup"]
        Session["Session Persistence"]
        Core_MCP["Core MCP Integration"]
        Basic_WF["Basic Workflow"]
    end
    
    subgraph Components["Implemented Components"]  
        MMCP_Server["MetaMCP MCP Server"]
        MMCP_App["MetaMCP App"]
        Session_Manager["Session Manager"]
        Memory_MCP["Memory MCP"]
        Text_Editor["Text Editor MCP"]
        Fetch["Fetch MCP"]
        Python_REPL["Python REPL MCP"]
    end
    
    Base --> MMCP_Server
    Base --> MMCP_App
    
    Session --> Session_Manager
    Session --> Memory_MCP
    
    Core_MCP --> Text_Editor
    Core_MCP --> Fetch
    Core_MCP --> Python_REPL
    
    Basic_WF --> Session_Manager
    Basic_WF --> Text_Editor
    Basic_WF --> Fetch
    Basic_WF --> Python_REPL
```
