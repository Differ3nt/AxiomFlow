import { Injectable, Logger } from '@nestjs/common';
import { TrizDataService } from '../triz/triz-data.service';
import { ParameterExtractionService } from './parameter-extraction.service';
import { ContradictionService } from './contradiction.service';
import { TrizCandidateService } from './triz-candidate.service';
import { BiomimicryCandidateService } from './biomimicry-candidate.service';
import { PhysicalLimitValidatorService } from './physical-limit-validator.service';
import { EvaluationService } from './evaluation.service';
import { ReportService } from './report.service';
import { ReasoningReport } from './dto/reasoning.types';

/**
 * Orchestrates the full reasoning trail required by the hackathon brief:
 * problem -> contradiction -> candidates (TRIZ + biomimicry) -> evaluation -> choice.
 * Each step below is a separate, independently testable service; this class only wires
 * them together in order.
 */
@Injectable()
export class ReasoningPipeline {
  private readonly logger = new Logger(ReasoningPipeline.name);

  constructor(
    private readonly trizData: TrizDataService,
    private readonly extraction: ParameterExtractionService,
    private readonly contradictionBuilder: ContradictionService,
    private readonly trizCandidates: TrizCandidateService,
    private readonly biomimicryCandidates: BiomimicryCandidateService,
    private readonly limitValidator: PhysicalLimitValidatorService,
    private readonly evaluator: EvaluationService,
    private readonly report: ReportService,
  ) {}

  async solve(problem: string): Promise<ReasoningReport> {
    this.logger.log('Step 1/6: extracting TRIZ parameters from the problem statement...');
    const extracted = await this.extraction.extract(problem);

    this.logger.log('Step 2/6: building the technical contradiction...');
    const contradiction = this.contradictionBuilder.build(problem, extracted);

    this.logger.log('Step 3/6: hard-lookup in the TRIZ contradiction matrix...');
    const matrixResult = this.trizData.lookup(extracted.improvingParameterId, extracted.worseningParameterId);

    this.logger.log('Step 3/6: generating TRIZ candidates from the matched principles...');
    const trizCandidates = await this.trizCandidates.generate(contradiction, matrixResult.principles);

    this.logger.log('Step 4/6: generating biomimicry candidates (second method)...');
    const biomimicryCandidates = await this.biomimicryCandidates.generate(contradiction);

    const allCandidates = [...trizCandidates, ...biomimicryCandidates];

    this.logger.log('Step 5/6: checking physical-limit guardrail...');
    const limitChecks = this.limitValidator.checkAll(allCandidates);

    this.logger.log('Step 5/6: evaluating candidates...');
    const evaluations = await this.evaluator.evaluate(contradiction, allCandidates, limitChecks);

    this.logger.log('Step 6/6: building the report...');
    return this.report.build({
      contradiction,
      matchedInMatrix: matrixResult.matched,
      trizPrinciplesUsed: matrixResult.principles,
      candidates: allCandidates,
      physicalLimitChecks: limitChecks,
      evaluations,
    });
  }
}
