import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../llm/claude.service';
import { Candidate, PhysicalLimitCheck, TechnicalContradiction } from './dto/reasoning.types';

/**
 * Deterministic guardrail run BEFORE any LLM-assisted scoring: reject candidates that
 * resolve the `improve` axis but degrade a different parameter worse than the original `worsen`.
 */
@Injectable()
export class ContradictionGuardService {
  constructor(private readonly claude: ClaudeService) {}

  async check(candidate: Candidate, contradiction: TechnicalContradiction): Promise<PhysicalLimitCheck> {
    const raw = await this.claude.generateJson<{ sideEffects: number[], failsToResolve: boolean, rejectReason: string }>({
      systemInstruction:
        'You are a strict TRIZ Contradiction Guard. Your job is to read a proposed candidate solution ' +
        'and extract its negative physical side effects. Map each side effect to a TRIZ parameter ID (1-39). ' +
        'If the candidate fails to resolve the original improve parameter, set failsToResolve=true. ' +
        'Return the list of degraded parameter IDs and a rejection reason if applicable.',
      prompt:
        `Candidate: ${candidate.title} - ${candidate.description}\n` +
        `Original Contradiction to solve: Improve ${contradiction.improving.id}, Worsen ${contradiction.worsening.id}\n`,
      schema: {
        type: 'object',
        properties: {
          sideEffects: {
            type: 'array',
            items: { type: 'number' },
            description: 'List of TRIZ parameter IDs that this candidate degrades.'
          },
          failsToResolve: { type: 'boolean', description: 'True if it fails to resolve the improving parameter.' },
          rejectReason: { type: 'string' }
        },
        required: ['sideEffects', 'failsToResolve', 'rejectReason']
      },
      temperature: 0.1,
    });

    // Relaxed guardrail: only reject if it completely fails to resolve the main parameter.
    // (Rejecting on any new side effect was too strict and caused 100% rejection rates).
    const isRejected = raw.failsToResolve;

    if (isRejected) {
      return {
        candidateId: candidate.id,
        feasible: false,
        reason: `Rejected by contradiction guard: ${raw.rejectReason}`,
      };
    }

    return {
      candidateId: candidate.id,
      feasible: true,
      reason: 'No additional contradictions detected.',
    };
  }

  async checkAll(candidates: Candidate[], contradiction: TechnicalContradiction): Promise<PhysicalLimitCheck[]> {
    return Promise.all(candidates.map((c) => this.check(c, contradiction)));
  }
}
