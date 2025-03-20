@echo off 
echo ============================================== 
echo Roger-MetaMCP Launch Script 
echo ============================================== 
 
echo Creating required directories... 
if not exist ".sessions" mkdir .sessions 
if not exist ".workspaces" mkdir .workspaces 
if not exist ".embeddings-cache" mkdir .embeddings-cache 
if not exist "data" mkdir data 
 
echo Installing dependencies if not already installed... 
if not exist "node_modules" npm install --legacy-peer-deps 

echo Installing MCP SDK if needed...
npm list @modelcontextprotocol/sdk || npm install @modelcontextprotocol/sdk --legacy-peer-deps
 
echo Starting RogerThat and Semantic Analysis services... 
start cmd /k "title RogerThat && node scripts/simplified-rogerthat-server.js" 
start cmd /k "title Semantic && node scripts/simplified-semantic-server.js" 
 
echo ============================================== 
echo Services started successfully! 
echo ============================================== 
