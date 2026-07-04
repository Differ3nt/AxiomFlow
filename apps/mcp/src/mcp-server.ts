import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTrizTools } from './tools';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'axiomflow-triz-mcp',
    version: '0.1.0',
  });

  registerTrizTools(server);

  return server;
}
