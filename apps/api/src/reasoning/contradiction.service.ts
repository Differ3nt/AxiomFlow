import { Injectable } from '@nestjs/common';
import { TrizDataService } from '../triz/triz-data.service';
import { ProblemExtraction, TechnicalContradiction } from './dto/reasoning.types';

/**
 * Step 2: deterministically assemble the technical contradiction from the extracted
 * parameters. No LLM call here — this is plain code, so it's fully inspectable.
 */
@Injectable()
export class ContradictionService {
  constructor(private readonly trizData: TrizDataService) {}

  build(problem: string, extraction: ProblemExtraction): TechnicalContradiction {
    const improving = this.trizData.getParameterById(extraction.improvingParameterId);
    const worsening = this.trizData.getParameterById(extraction.worseningParameterId);

    return {
      problem,
      technicalSystem: extraction.technicalSystem,
      improving,
      worsening,
      constraints: extraction.constraints,
      statement: `Improving "${improving.name}" tends to worsen "${worsening.name}" in ${extraction.technicalSystem}.`,
    };
  }
}
