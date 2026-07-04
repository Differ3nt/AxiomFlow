import { Module } from '@nestjs/common';
import { TrizModule } from '../triz/triz.module';
import { LlmModule } from '../llm/llm.module';
import { ParameterExtractionService } from './parameter-extraction.service';
import { ContradictionService } from './contradiction.service';
import { TrizCandidateService } from './triz-candidate.service';
import { BiomimicryCandidateService } from './biomimicry-candidate.service';
import { PhysicalLimitValidatorService } from './physical-limit-validator.service';
import { EvaluationService } from './evaluation.service';
import { ReportService } from './report.service';
import { ReasoningPipeline } from './reasoning.pipeline';

@Module({
  imports: [TrizModule, LlmModule],
  providers: [
    ParameterExtractionService,
    ContradictionService,
    TrizCandidateService,
    BiomimicryCandidateService,
    PhysicalLimitValidatorService,
    EvaluationService,
    ReportService,
    ReasoningPipeline,
  ],
  exports: [ReasoningPipeline],
})
export class ReasoningModule {}
