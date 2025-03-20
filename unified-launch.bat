@echo off
echo ============================================== 
echo Roger-MetaMCP Unified Launch Script 
echo ============================================== 

:: Create required directories
echo Creating required directories...
if not exist ".sessions" mkdir .sessions
if not exist ".workspaces" mkdir .workspaces
if not exist ".embeddings-cache" mkdir .embeddings-cache
if not exist "data" mkdir data

:: Check dependencies
echo Checking dependencies...
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if Node.js modules are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install --legacy-peer-deps
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Check and install MCP SDK
echo Ensuring MCP SDK is installed...
call npm list @modelcontextprotocol/sdk >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Installing MCP SDK...
    call npm install @modelcontextprotocol/sdk --legacy-peer-deps
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install MCP SDK.
        pause
        exit /b 1
    )
)

echo Setting up environment variables...
setlocal
set "EMBEDDING_CACHE_DIR=D:\UserRoger\Documents\GitHub\modelcontextprotocol\roger-metamcp\.embeddings-cache"
set "EMBEDDING_DIMENSIONS=384"
set "SIMILARITY_THRESHOLD=0.7"
set "TOKEN_BUDGET=8000"
set "DEFAULT_ALGORITHM=hybrid-semantic"
set "ENABLE_SEMANTIC=true"
set "LOG_LEVEL=info"
set "ENABLE_ALL_FEATURES=true"

:: Start services
echo Starting services...

:: Option to use Claude Desktop's configuration instead of separate processes
set USE_CLAUDE_CONFIG=1

if %USE_CLAUDE_CONFIG% equ 1 (
    echo Using Claude Desktop configuration for services.
    echo Please launch Claude Desktop to use the configured MCP services.
) else (
    echo Starting services as separate processes...
    start cmd /k "title RogerThat && node scripts/mcp-token-server.js"
    start cmd /k "title Semantic && node scripts/mcp-semantic-server.js"
)

:: Launch the application
echo Launching application...

:: Uncomment the appropriate line based on your application type:
:: start cmd /k "title App && npm run dev" 
:: For Next.js app
:: start cmd /k "title App && node app.js"
:: For Node.js app

echo ============================================== 
echo Setup complete! 
echo ============================================== 
echo.
echo Press any key to quit (services will continue running)
echo ============================================== 

pause
