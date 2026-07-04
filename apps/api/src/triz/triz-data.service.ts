import { Injectable } from '@nestjs/common';
import { MatrixLookupResult, TrizCore, TrizParameter, TrizPrinciple } from '@axiomflow/triz-core';

export type { TrizParameter, TrizPrinciple, MatrixRow, MatrixLookupResult } from '@axiomflow/triz-core';

/**
 * NestJS-injectable wrapper around the framework-agnostic TRIZ lookup in
 * `@axiomflow/triz-core` (shared with the MCP server in apps/mcp).
 */
@Injectable()
export class TrizDataService {
  private readonly core = new TrizCore();

  getParameters(): TrizParameter[] {
    return this.core.getParameters();
  }

  getPrinciples(): TrizPrinciple[] {
    return this.core.getPrinciples();
  }

  getParameterById(id: number): TrizParameter {
    return this.core.getParameterById(id);
  }

  findParameterByName(name: string): TrizParameter | undefined {
    return this.core.findParameterByName(name);
  }

  getPrincipleById(id: number): TrizPrinciple {
    return this.core.getPrincipleById(id);
  }

  /** Hard lookup in the contradiction matrix. No LLM involved. */
  lookup(improvingId: number, worseningId: number): MatrixLookupResult {
    return this.core.lookup(improvingId, worseningId);
  }
}
