import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config';
import { createMcpServer } from './mcp-server';

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Last-Event-ID');
}

function methodNotAllowed(res: ServerResponse): void {
  res.writeHead(405, { 'Content-Type': 'application/json' }).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    }),
  );
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const server = createMcpServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        }),
      );
    }
  }
}

const { host, port } = loadConfig();

const httpServer = createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (req.url !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Not found.' }, id: null }),
    );
    return;
  }

  if (req.method === 'POST') {
    void handleMcpRequest(req, res);
    return;
  }

  methodNotAllowed(res);
});

httpServer.listen(port, host, () => {
  console.log(`AxiomFlow TRIZ MCP server listening on http://${host}:${port}/mcp`);
});

process.on('SIGINT', () => {
  console.log('Shutting down MCP server...');
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});
