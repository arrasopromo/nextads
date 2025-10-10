// MCP Client for Browser
// This file provides a global function to call MCP tools from the browser

class MCPClient {
    constructor() {
        this.serverUrl = '/api/mcp'; // Endpoint to call MCP from server
    }

    async callMCP(serverName, toolName, args) {
        try {
            console.log(`🔧 MCP Call: ${serverName}.${toolName}`, args);
            
            // Make real API call to server MCP endpoint
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    server_name: serverName,
                    tool_name: toolName,
                    args
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log(`✅ MCP Result:`, result);
            
            // Return the actual data from MCP
            return result.data || result;
        } catch (error) {
            console.error(`❌ MCP Client Error:`, error);
            throw error;
        }
    }
}

// Create global instance
const mcpClient = new MCPClient();

// Global function for easy access
window.runMCP = (serverName, toolName, args) => {
    return mcpClient.callMCP(serverName, toolName, args);
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MCPClient;
}