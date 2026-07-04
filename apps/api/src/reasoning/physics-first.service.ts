import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../llm/claude.service';
import { Candidate, TechnicalContradiction } from './dto/reasoning.types';

interface RawPhysicsCandidate {
  fundamental: string;
  mechanism: string;
  title: string;
  description: string;
}

/**
 * Step 4: the second concept-generation method (first principles / physics), independent of the TRIZ
 * matrix path. Forces the model to name a real physical fundamental per
 * candidate so the reasoning trail stays inspectable rather than a vague claim.
 */
@Injectable()
export class PhysicsFirstService {
  constructor(private readonly claude: ClaudeService) {}

  async generate(contradiction: TechnicalContradiction, temperature = 0.7): Promise<Candidate[]> {
    const raw = await this.claude.generateJson<{ candidates: RawPhysicsCandidate[] }>({
      systemInstruction:
        'You are a first-principles physics consultant. Propose exactly 3 distinct, physically plausible solution ' +
        'concepts inspired by decomposing the problem into fundamental physics (e.g. thermodynamics, fluid dynamics, electromagnetism), for the given technical ' +
        'contradiction and constraints. Each candidate must name a real physical fundamental and ' +
        'explain the mechanism being applied. Do not propose perpetual-motion or energy-conservation-violating ideas.',
      prompt:
        `Technical system: ${contradiction.technicalSystem}\n` +
        `Contradiction: ${contradiction.statement}\n` +
        `Constraints: ${contradiction.constraints.join('; ') || 'none stated'}`,
      schema: {
        type: 'object',
        properties: {
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fundamental: { type: 'string', description: 'Real physical fundamental the idea is based on.' },
                mechanism: { type: 'string', description: 'The specific mechanism being applied, 1 sentence.' },
                title: { type: 'string' },
                description: { type: 'string', description: 'Concrete application to this problem, 2-4 sentences.' },
              },
              required: ['fundamental', 'mechanism', 'title', 'description'],
            },
          },
        },
        required: ['candidates'],
      },
      temperature,
    });

    return raw.candidates.map((c, index) => ({
      id: `phys-${index + 1}`,
      method: 'physics' as any,
      title: c.title,
      description: c.description,
      basis: `Physics First: ${c.fundamental} — ${c.mechanism}`,
    }));
  }
}
