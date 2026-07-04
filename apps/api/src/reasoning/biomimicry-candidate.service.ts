import { Injectable } from '@nestjs/common';
import { SchemaType } from '@google/generative-ai';
import { GeminiService } from '../llm/gemini.service';
import { Candidate, TechnicalContradiction } from './dto/reasoning.types';

interface RawBiomimicryCandidate {
  organism: string;
  mechanism: string;
  title: string;
  description: string;
}

/**
 * Step 4: the second concept-generation method (biomimicry), independent of the TRIZ
 * matrix path. Forces the model to name a real biological organism/mechanism per
 * candidate so the reasoning trail stays inspectable rather than a vague "nature-inspired" claim.
 */
@Injectable()
export class BiomimicryCandidateService {
  constructor(private readonly gemini: GeminiService) {}

  async generate(contradiction: TechnicalContradiction): Promise<Candidate[]> {
    const raw = await this.gemini.generateJson<{ candidates: RawBiomimicryCandidate[] }>({
      systemInstruction:
        'You are a biomimicry consultant. Propose exactly 3 distinct, physically plausible solution ' +
        'concepts inspired by real biological organisms or natural mechanisms, for the given technical ' +
        'contradiction and constraints. Each candidate must name a real organism/natural mechanism and ' +
        'explain the mechanism being borrowed. Do not propose perpetual-motion or energy-conservation-violating ideas.',
      prompt:
        `Technical system: ${contradiction.technicalSystem}\n` +
        `Contradiction: ${contradiction.statement}\n` +
        `Constraints: ${contradiction.constraints.join('; ') || 'none stated'}`,
      schema: {
        type: SchemaType.OBJECT,
        properties: {
          candidates: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                organism: { type: SchemaType.STRING, description: 'Real organism or natural mechanism the idea borrows from.' },
                mechanism: { type: SchemaType.STRING, description: 'The specific biological mechanism being applied, 1 sentence.' },
                title: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING, description: 'Concrete application to this problem, 2-4 sentences.' },
              },
              required: ['organism', 'mechanism', 'title', 'description'],
            },
          },
        },
        required: ['candidates'],
      },
      temperature: 0.7,
    });

    return raw.candidates.map((c, index) => ({
      id: `bio-${index + 1}`,
      method: 'biomimicry' as const,
      title: c.title,
      description: c.description,
      basis: `Biomimicry: ${c.organism} — ${c.mechanism}`,
    }));
  }
}
