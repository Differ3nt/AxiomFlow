import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../llm/claude.service';
import { TrizPrinciple } from '../triz/triz-data.service';
import { Candidate, TechnicalContradiction } from './dto/reasoning.types';

interface RawTrizCandidate {
  principleId: string;
  title: string;
  description: string;
}

/**
 * Step 3: turn each TRIZ inventive principle recommended by the (deterministic, hard-lookup)
 * contradiction matrix into one concrete candidate solution for this specific problem.
 *
 * The principle selection itself already happened in TrizDataService.lookup() via the
 * matrix — the LLM's only job here is to phrase what applying a *given* principle looks
 * like in this domain. It cannot pick a different principle (enforced by the enum schema).
 */
@Injectable()
export class TrizCandidateService {
  constructor(private readonly claude: ClaudeService) {}

  async generate(contradiction: TechnicalContradiction, principles: TrizPrinciple[], temperature: number = 0.6): Promise<Candidate[]> {
    const chosen = principles.slice(0, 3);
    const principleIds = chosen.map((p) => p.id);

    const raw = await this.claude.generateJson<{ candidates: RawTrizCandidate[] }>({
      systemInstruction:
        'You are a TRIZ engineering consultant. For each given inventive principle, propose ONE ' +
        'concrete, physically plausible way to apply it to the specific technical system and ' +
        'contradiction described, respecting the stated constraints. Do not propose perpetual-motion ' +
        'or energy-conservation-violating ideas.',
      prompt:
        `Technical system: ${contradiction.technicalSystem}\n` +
        `Contradiction: ${contradiction.statement}\n` +
        `Constraints: ${contradiction.constraints.join('; ') || 'none stated'}\n\n` +
        `Apply exactly these TRIZ principles, one candidate each:\n` +
        chosen.map((p) => `- (${p.id}) ${p.name}: ${p.description}`).join('\n'),
      schema: {
        type: 'object',
        properties: {
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                principleId: { type: 'string', enum: principleIds.map(String) },
                title: { type: 'string' },
                description: { type: 'string', description: 'Concrete application of the principle to this problem, 2-4 sentences.' },
              },
              required: ['principleId', 'title', 'description'],
            },
          },
        },
        required: ['candidates'],
      },
      temperature,
    });

    return raw.candidates.map((c, index) => {
      const principle = chosen.find((p) => p.id === Number(c.principleId)) ?? chosen[index];
      return {
        id: `triz-${principle.id}`,
        method: 'triz' as const,
        title: c.title,
        description: c.description,
        basis: `TRIZ Principle ${principle.id}: ${principle.name}`,
      };
    });
  }
}
