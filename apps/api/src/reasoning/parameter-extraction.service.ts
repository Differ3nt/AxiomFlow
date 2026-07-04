import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../llm/claude.service';
import { TrizDataService } from '../triz/triz-data.service';
import { ProblemExtraction } from './dto/reasoning.types';

interface RawExtraction {
  technicalSystem: string;
  improvingParameterName: string;
  worseningParameterName: string;
  constraints: string[];
}

/**
 * Step 1 of the pipeline: turn a free-text problem statement into a structured
 * technical contradiction seed by mapping it onto TWO of the 39 standard TRIZ
 * engineering parameters. The LLM is only allowed to pick from the closed set of
 * 39 parameter names (enforced via schema enum) — it cannot invent a parameter,
 * so the result is always usable for the deterministic matrix lookup in step 2.
 */
@Injectable()
export class ParameterExtractionService {
  constructor(
    private readonly claude: ClaudeService,
    private readonly trizData: TrizDataService,
  ) {}

  async extract(problem: string, context?: string): Promise<ProblemExtraction> {
    const parameterNames = this.trizData.getParameters().map((p) => p.name);

    const raw = await this.claude.generateJson<RawExtraction>({
      systemInstruction:
        'You are a TRIZ analyst. Given a real-world engineering/product problem, identify the ' +
        'technical system and the ONE parameter the team wants to improve and the ONE parameter ' +
        'that worsens as a side effect, expressed strictly as two of the 39 standard TRIZ ' +
        'engineering parameters. Also list the hard real-world constraints mentioned in the problem ' +
        '(e.g. cost, energy access, material limits) as short phrases.',
      prompt: `Problem statement:\n"""\n${problem}\n"""\n${context ? `\nPrevious solution context to iterate on:\n"""\n${context}\n"""\n` : ''}\nPick the improving and worsening parameter from this exact list: ${parameterNames.join(', ')}.`,
      schema: {
        type: 'object',
        properties: {
          technicalSystem: { type: 'string', description: 'Short name of the technical system/process under discussion.' },
          improvingParameterName: { type: 'string', enum: parameterNames },
          worseningParameterName: { type: 'string', enum: parameterNames },
          constraints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Short phrases describing real-world constraints from the problem statement.',
          },
        },
        required: ['technicalSystem', 'improvingParameterName', 'worseningParameterName', 'constraints'],
      },
      temperature: 0.2,
    });

    const improving = this.trizData.findParameterByName(raw.improvingParameterName);
    const worsening = this.trizData.findParameterByName(raw.worseningParameterName);

    if (!improving || !worsening) {
      throw new Error(
        `Claude returned a parameter name outside the 39 TRIZ parameters: ` +
          `improving="${raw.improvingParameterName}" worsening="${raw.worseningParameterName}"`,
      );
    }

    return {
      technicalSystem: raw.technicalSystem,
      improvingParameterId: improving.id,
      worseningParameterId: worsening.id,
      constraints: raw.constraints ?? [],
    };
  }
}
