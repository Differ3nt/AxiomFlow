import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../llm/claude.service';
import { Candidate, Evaluation, PhysicalLimitCheck, TechnicalContradiction } from './dto/reasoning.types';

interface RawScore {
  candidateId: string;
  feasibility: number;
  energyImpact: number;
  equipmentStrain: number;
  sideEffects: number;
  reasoning: string;
}

/** Weights are fixed, documented, and applied in code — not left to the model to decide. */
const WEIGHTS = { feasibility: 0.35, energyImpact: 0.3, equipmentStrain: 0.2, sideEffects: 0.15 } as const;

/**
 * Step 5: score every surviving candidate (TRIZ + biomimicry) against the original
 * problem and constraints. Candidates that already failed the physical-limit guardrail
 * are scored 0 without spending an LLM call. For the rest, the LLM rates 4 fixed
 * dimensions on a 0-10 "higher is better" scale; the final weighted score and the
 * ranking/selection are computed by plain code, not by the model.
 */
@Injectable()
export class EvaluationService {
  constructor(private readonly claude: ClaudeService) {}

  async evaluate(
    contradiction: TechnicalContradiction,
    candidates: Candidate[],
    limitChecks: PhysicalLimitCheck[],
  ): Promise<Evaluation[]> {
    const infeasibleIds = new Set(limitChecks.filter((c) => !c.feasible).map((c) => c.candidateId));
    const feasibleCandidates = candidates.filter((c) => !infeasibleIds.has(c.id));

    const rejected: Evaluation[] = candidates
      .filter((c) => infeasibleIds.has(c.id))
      .map((c) => ({
        candidateId: c.id,
        feasibility: 0,
        energyImpact: 0,
        equipmentStrain: 0,
        sideEffects: 0,
        score: 0,
        reasoning: limitChecks.find((l) => l.candidateId === c.id)?.reason ?? 'Rejected by physical-limit guardrail.',
      }));

    if (feasibleCandidates.length === 0) {
      return rejected;
    }

    const raw = await this.claude.generateJson<{ scores: RawScore[] }>({
      systemInstruction:
        'You are a skeptical R&D reviewer evaluating candidate solutions to an engineering ' +
        'contradiction. Score each candidate 0-100 on FOUR dimensions where 100 is always the BEST ' +
        'outcome: feasibility (physically/practically buildable with current or near-term tech), ' +
        'energyImpact (100 = does not increase energy demand, 0 = drastically increases it), ' +
        'equipmentStrain (100 = does not increase wear/strain on equipment, 0 = drastically increases it), ' +
        'sideEffects (100 = minimal harmful side effects, 0 = severe side effects). Be a harsh, honest critic.',
      prompt:
        `Original problem:\n"""\n${contradiction.problem}\n"""\n\n` +
        `Contradiction: ${contradiction.statement}\n` +
        `Constraints: ${contradiction.constraints.join('; ') || 'none stated'}\n\n` +
        `Candidates to score:\n` +
        feasibleCandidates
          .map((c) => `- id="${c.id}" [${c.basis}] ${c.title}: ${c.description}`)
          .join('\n'),
      schema: {
        type: 'object',
        properties: {
          scores: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                candidateId: { type: 'string', enum: feasibleCandidates.map((c) => c.id) },
                feasibility: { type: 'number' },
                energyImpact: { type: 'number' },
                equipmentStrain: { type: 'number' },
                sideEffects: { type: 'number' },
                reasoning: { type: 'string', description: '1-2 sentence justification for the scores.' },
              },
              required: ['candidateId', 'feasibility', 'energyImpact', 'equipmentStrain', 'sideEffects', 'reasoning'],
            },
          },
        },
        required: ['scores'],
      },
      temperature: 0.3,
    });

    const scored: Evaluation[] = raw.scores.map((s) => ({
      candidateId: s.candidateId,
      feasibility: s.feasibility,
      energyImpact: s.energyImpact,
      equipmentStrain: s.equipmentStrain,
      sideEffects: s.sideEffects,
      score:
        s.feasibility * WEIGHTS.feasibility +
        s.energyImpact * WEIGHTS.energyImpact +
        s.equipmentStrain * WEIGHTS.equipmentStrain +
        s.sideEffects * WEIGHTS.sideEffects,
      reasoning: s.reasoning,
    }));

    return [...scored, ...rejected];
  }

  choose(evaluations: Evaluation[]): Evaluation {
    return [...evaluations].sort((a, b) => b.score - a.score)[0];
  }
}
