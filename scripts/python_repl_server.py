#!/usr/bin/env python
"""
A simple Python REPL server for MCP integration.

This script provides a basic REPL environment that works with the Model Context Protocol.
"""

import sys
import json
import traceback
from io import StringIO
import contextlib

# Store the session state
state = {}

@contextlib.contextmanager
def capture_output():
    """Capture stdout and stderr."""
    new_out, new_err = StringIO(), StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    try:
        sys.stdout, sys.stderr = new_out, new_err
        yield new_out, new_err
    finally:
        sys.stdout, sys.stderr = old_out, old_err

def execute_python(code, global_vars):
    """Execute Python code and return the result."""
    with capture_output() as (stdout, stderr):
        try:
            # Try to execute as an expression first
            try:
                result = eval(code, global_vars)
                return {
                    "success": True,
                    "output": stdout.getvalue(),
                    "error": stderr.getvalue(),
                    "result": repr(result) if result is not None else None
                }
            except SyntaxError:
                # If it's not an expression, execute as a statement
                exec(code, global_vars)
                return {
                    "success": True,
                    "output": stdout.getvalue(),
                    "error": stderr.getvalue(),
                    "result": None
                }
        except Exception as e:
            # If execution fails, return the error
            return {
                "success": False,
                "output": stdout.getvalue(),
                "error": stderr.getvalue() + "\n" + traceback.format_exc(),
                "result": None
            }

def handle_message(message):
    """Handle an MCP message."""
    try:
        message_json = json.loads(message)
        method = message_json.get("method")
        params = message_json.get("params", {})
        message_id = message_json.get("id")

        if method == "initialize":
            response = {
                "jsonrpc": "2.0",
                "id": message_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "serverInfo": {
                        "name": "python-repl",
                        "version": "1.0.0"
                    }
                }
            }
        elif method == "tools/list":
            response = {
                "jsonrpc": "2.0",
                "id": message_id,
                "result": {
                    "tools": [
                        {
                            "name": "execute",
                            "description": "Execute Python code",
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "code": {
                                        "type": "string",
                                        "description": "The Python code to execute"
                                    }
                                },
                                "required": ["code"]
                            }
                        }
                    ]
                }
            }
        elif method == "tools/execute":
            tool_name = params.get("tool")
            args = params.get("arguments", {})

            if tool_name == "execute":
                code = args.get("code", "")
                result = execute_python(code, state)
                response = {
                    "jsonrpc": "2.0",
                    "id": message_id,
                    "result": result
                }
            else:
                response = {
                    "jsonrpc": "2.0",
                    "id": message_id,
                    "error": {
                        "code": -32601,
                        "message": f"Tool not found: {tool_name}"
                    }
                }
        else:
            # For other methods, just respond with an empty result
            response = {
                "jsonrpc": "2.0",
                "id": message_id,
                "result": {}
            }
        
        return json.dumps(response)
    except Exception as e:
        # If anything goes wrong, return an error
        error_response = {
            "jsonrpc": "2.0",
            "id": message_json.get("id") if "message_json" in locals() else None,
            "error": {
                "code": -32603,
                "message": str(e)
            }
        }
        return json.dumps(error_response)

def main():
    """Main function to run the REPL server."""
    # Initialize the global state
    global state
    state = {}

    # Process messages from stdin/stdout
    while True:
        # Read content length
        content_length_line = sys.stdin.readline().strip()
        if not content_length_line:
            break
            
        # Parse content length
        if not content_length_line.startswith("Content-Length:"):
            continue
            
        content_length = int(content_length_line.split(":")[1].strip())
        
        # Skip empty line
        sys.stdin.readline()
        
        # Read the message
        message = sys.stdin.read(content_length)
        
        # Process the message
        response = handle_message(message)
        
        # Send the response
        sys.stdout.write(f"Content-Length: {len(response)}\r\n\r\n")
        sys.stdout.write(response)
        sys.stdout.flush()

if __name__ == "__main__":
    main()
