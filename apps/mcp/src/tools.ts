import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrizCore } from '@axiomflow/triz-core';

function text(value: string) {
  return { content: [{ type: 'text' as const, text: value }] };
}

function formatParameter(p: { id: number; name: string; description: string; examples: string[] }): string {
  let out = `[${p.id}] ${p.name}\n\n${p.description}`;
  if (p.examples.length) {
    out += `\n\nExamples:\n${p.examples.map((e) => `• ${e}`).join('\n')}`;
  }
  return out;
}

function formatPrinciple(p: { id: number; name: string; description: string }): string {
  return `[${p.id}] ${p.name}\n\n${p.description}`;
}

/**
 * Registers the deterministic TRIZ knowledge (39 engineering parameters, 40 inventive
 * principles, and the sourced contradiction-matrix lookup) as MCP tools, backed by the
 * same @axiomflow/triz-core lookup used by the console pipeline's TrizDataService.
 */
export function registerTrizTools(server: McpServer): void {
  const core = new TrizCore();

  server.registerTool(
    'lookup_contradiction_matrix',
    {
      title: 'Look up TRIZ contradiction matrix',
      description:
        'Hard lookup (no LLM) of Inventive Principles for a pair of TRIZ engineering parameter IDs (1-39): one improving, one worsening.',
      inputSchema: {
        improvingParameterId: z.number().int().min(1).max(39),
        worseningParameterId: z.number().int().min(1).max(39),
      },
    },
    async ({ improvingParameterId, worseningParameterId }) => {
      const result = core.lookup(improvingParameterId, worseningParameterId);
      const header = result.matched
        ? `Matched a sourced contradiction-matrix row for "${result.improving.name}" vs "${result.worsening.name}".`
        : `No sourced matrix row for "${result.improving.name}" vs "${result.worsening.name}" — generic fallback principles used.`;
      const principles = result.principles.map((p) => formatPrinciple(p)).join('\n\n');
      return text(`${header}\n\n${principles}`);
    },
  );

  server.registerTool(
    'get_parameter_by_id',
    {
      title: 'Get TRIZ engineering parameter by ID',
      description: 'Retrieve one of the 39 TRIZ engineering parameters by its numeric ID.',
      inputSchema: { id: z.number().int().min(1).max(39) },
    },
    async ({ id }) => {
      try {
        return text(formatParameter(core.getParameterById(id)));
      } catch (e) {
        return text(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    'get_principle_by_id',
    {
      title: 'Get TRIZ inventive principle by ID',
      description: 'Retrieve one of the 40 TRIZ inventive principles by its numeric ID.',
      inputSchema: { id: z.number().int().min(1).max(40) },
    },
    async ({ id }) => {
      try {
        return text(formatPrinciple(core.getPrincipleById(id)));
      } catch (e) {
        return text(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    'list_parameters',
    {
      title: 'List all TRIZ engineering parameters',
      description: 'Return all 39 TRIZ engineering parameters (id and name only).',
      inputSchema: {},
    },
    async () => text(core.getParameters().map((p) => `[${p.id}] ${p.name}`).join('\n')),
  );

  server.registerTool(
    'list_principles',
    {
      title: 'List all TRIZ inventive principles',
      description: 'Return all 40 TRIZ inventive principles (id and name only).',
      inputSchema: {},
    },
    async () => text(core.getPrinciples().map((p) => `[${p.id}] ${p.name}`).join('\n')),
  );
}
