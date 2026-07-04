import { Module } from '@nestjs/common';
import { TrizModule } from '../triz/triz.module';
import { LlmModule } from '../llm/llm.module';
import { DbModule } from '@axiomflow/data-access-db';
import { ParameterExtractionService } from './parameter-extraction.service';
import { ContradictionService } from './contradiction.service';
import { TrizCandidateService } from './triz-candidate.service';
import { PhysicsFirstService } from './physics-first.service';
import { ContradictionGuardService } from './contradiction-guard.service';
import { EvaluationService } from './evaluation.service';
import { ReportService } from './report.service';
import { ReasoningPipeline } from './reasoning.pipeline';

@Module({
  imports: [TrizModule, LlmModule, DbModule],
  providers: [
    ParameterExtractionService,
    ContradictionService,
    TrizCandidateService,
    PhysicsFirstService,
    ContradictionGuardService,
    EvaluationService,
    ReportService,
    ReasoningPipeline,
  ],
  exports: [ReasoningPipeline],
})
export class ReasoningModule {}
