import { parameters as parametersData } from './data/parameters';
import { principles as principlesData } from './data/principles';
import { matrix as matrixData } from './data/matrix';
import { MatrixLookupResult, TrizParameter, TrizPrinciple } from './types';

/**
 * Generic, high-leverage principles used when a parameter pair has no entry in the
 * sourced contradiction matrix. This keeps the lookup total (always returns something)
 * while making it obvious in the report that the result came from a fallback rule,
 * not from Altshuller's matrix.
 */
const FALLBACK_PRINCIPLE_IDS = [1, 35, 10, 28];

/**
 * Loads the 39 Engineering Parameters, 40 Inventive Principles, and a sourced subset of
 * the Contradiction Matrix (109 pairs, from the Heinrich open-source TRIZ knowledge base,
 * https://github.com/NickScherbakov/Heinrich-The-Inventing-Machine), and exposes a hard,
 * deterministic (non-LLM) lookup between them.
 *
 * Framework-agnostic (no NestJS dependency) so it can be shared between the console
 * pipeline (apps/api) and the MCP server (apps/mcp) without duplicating the TRIZ data.
 */
export class TrizCore {
  private readonly parameters: TrizParameter[] = parametersData;
  private readonly principles: TrizPrinciple[] = principlesData;
  private readonly matrix = matrixData;

  getParameters(): TrizParameter[] {
    return this.parameters;
  }

  getPrinciples(): TrizPrinciple[] {
    return this.principles;
  }

  getParameterById(id: number): TrizParameter {
    const param = this.parameters.find((p) => p.id === id);
    if (!param) {
      throw new Error(`Unknown TRIZ engineering parameter id: ${id}`);
    }
    return param;
  }

  findParameterByName(name: string): TrizParameter | undefined {
    const normalized = name.trim().toLowerCase();
    return this.parameters.find((p) => p.name.toLowerCase() === normalized);
  }

  getPrincipleById(id: number): TrizPrinciple {
    const principle = this.principles.find((p) => p.id === id);
    if (!principle) {
      throw new Error(`Unknown TRIZ inventive principle id: ${id}`);
    }
    return principle;
  }

  /** Hard lookup in the contradiction matrix. No LLM involved. */
  lookup(improvingId: number, worseningId: number): MatrixLookupResult {
    const improving = this.getParameterById(improvingId);
    const worsening = this.getParameterById(worseningId);

    const row =
      this.matrix.find((r) => r.improving === improvingId && r.worsening === worseningId) ??
      this.matrix.find((r) => r.improving === worseningId && r.worsening === improvingId);

    const principleIds = row ? row.principles : FALLBACK_PRINCIPLE_IDS;

    return {
      improving,
      worsening,
      principles: principleIds.map((id) => this.getPrincipleById(id)),
      matched: !!row,
    };
  }
}
