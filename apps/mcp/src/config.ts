export interface McpConfig {
  host: string;
  port: number;
}

/** Cloud Run injects PORT; MCP_PORT/MCP_HOST override for local/manual runs. */
export function loadConfig(): McpConfig {
  return {
    host: process.env.MCP_HOST ?? '0.0.0.0',
    port: Number(process.env.MCP_PORT ?? process.env.PORT ?? 8080),
  };
}
