import { Injectable, Logger } from '@nestjs/common';
import { TrizDataService } from '../triz/triz-data.service';
import { ParameterExtractionService } from './parameter-extraction.service';
import { ContradictionService } from './contradiction.service';
import { TrizCandidateService } from './triz-candidate.service';
import { PhysicsFirstService } from './physics-first.service';
import { ContradictionGuardService } from './contradiction-guard.service';
import { EvaluationService } from './evaluation.service';
import { ReportService } from './report.service';
import { ReasoningReport } from './dto/reasoning.types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrailService } from '@axiomflow/data-access-db';

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
    private readonly physicsFirst: PhysicsFirstService,
    private readonly limitValidator: ContradictionGuardService,
    private readonly evaluator: EvaluationService,
    private readonly report: ReportService,
    private readonly eventEmitter: EventEmitter2,
    private readonly trail: TrailService,
  ) {}

  async solve(problem: string, runId?: string, temperature?: number, methods?: string[], context?: string): Promise<ReasoningReport> {
    const emitEvent = (type: string, data: any = {}) => {
      if (runId) {
        this.eventEmitter.emit(`run.${runId}.event`, { type, ...data });
      }
    };
    const emitLog = (level: string, levelColor: string, text: string) => {
      emitEvent('log', { time: new Date().toLocaleTimeString(), level, levelColor, text });
    };

    if (runId) {
      await this.trail.createRun(runId, problem, temperature || 0.7);
    }

    emitEvent('step', { step: 0 });
    this.logger.log('Step 1/6: extracting TRIZ parameters from the problem statement...');
    emitLog('READ', 'var(--info)', 'Parsing problem statement...');
    const extracted = await this.extraction.extract(problem, context);
    if (runId) await this.trail.record(runId, 'ParameterExtraction', { input: { problem, context }, output: extracted });
    emitLog('INDEX', 'var(--info)', `Extracted constraints: ${extracted.constraints.length}`);

    emitEvent('step', { step: 1 });
    this.logger.log('Step 2/6: building the technical contradiction...');
    emitLog('TRIZ', 'var(--warning-strong)', `parameters -> improve: §${extracted.improvingParameterId}, worsen: §${extracted.worseningParameterId}`);
    const contradiction = this.contradictionBuilder.build(problem, extracted);
    if (runId) await this.trail.record(runId, 'TechnicalContradiction', { input: extracted, output: contradiction });

    emitEvent('step', { step: 2 });
    this.logger.log('Step 3/6: hard-lookup in the TRIZ contradiction matrix...');
    const matrixResult = this.trizData.lookup(extracted.improvingParameterId, extracted.worseningParameterId);
    if (runId) await this.trail.record(runId, 'MatrixLookup', { input: { improving: extracted.improvingParameterId, worsening: extracted.worseningParameterId }, output: matrixResult });
    emitLog('TRIZ', 'var(--warning-strong)', `matrix[${extracted.improvingParameterId},${extracted.worseningParameterId}] -> [${matrixResult.principles.map(p => p.id).join(', ')}]`);

    this.logger.log('Step 3/6: generating TRIZ candidates from the matched principles...');
    const trizCandidates = await this.trizCandidates.generate(contradiction, matrixResult.principles, temperature);
    if (runId) await this.trail.record(runId, 'TrizGenerator', { input: { contradiction, principles: matrixResult.principles }, output: trizCandidates });
    trizCandidates.forEach(c => emitLog('DRAFT', 'var(--accent-strong)', `triz -> ${c.title}`));

    emitEvent('step', { step: 3 });
    let physicsCandidates: any[] = [];
    if (!methods || methods.includes('First-principles')) {
      this.logger.log('Step 4/6: generating physics-first candidates (second method)...');
      emitLog('PHYS', 'var(--accent-strong)', 'second method generator...');
      physicsCandidates = await this.physicsFirst.generate(contradiction, temperature);
      if (runId) await this.trail.record(runId, 'PhysicsFirstGenerator', { input: contradiction, output: physicsCandidates });
      physicsCandidates.forEach(c => emitLog('DRAFT', 'var(--accent-strong)', `phys -> ${c.title}`));
    } else {
      emitLog('PHYS', 'var(--text-muted)', 'Skipping physics method (not selected)...');
      if (methods.length > 0) {
        emitLog('WARN', 'var(--warning-strong)', `Methods ${methods.join(', ')} are not fully implemented in the backend yet.`);
      }
    }

    const allCandidates = [...trizCandidates, ...physicsCandidates];

    emitEvent('step', { step: 4 });
    this.logger.log('Step 5/6: checking contradiction guardrail...');
    emitLog('SCORE', 'var(--violet)', 'Checking physical constraints...');
    const limitChecks = await this.limitValidator.checkAll(allCandidates, contradiction);
    if (runId) await this.trail.record(runId, 'ContradictionGuard', { input: { candidates: allCandidates.map(c => c.id) }, output: limitChecks });

    this.logger.log('Step 5/6: evaluating candidates...');
    emitLog('SCORE', 'var(--violet)', `cross-scoring ${allCandidates.length} × 4 axes`);
    const evaluations = await this.evaluator.evaluate(contradiction, allCandidates, limitChecks);
    if (runId) await this.trail.record(runId, 'Evaluation', { input: { candidates: allCandidates.map(c => c.id) }, output: evaluations });

    emitEvent('step', { step: 5 });
    this.logger.log('Step 6/6: building the report...');
    const finalReport = await this.report.build({
      contradiction,
      matchedInMatrix: matrixResult.matched,
      trizPrinciplesUsed: matrixResult.principles,
      candidates: allCandidates,
      physicalLimitChecks: limitChecks,
      evaluations,
    });
    if (runId) await this.trail.record(runId, 'Selector', { input: evaluations, output: finalReport.choice });
    
    emitLog('RANK', 'var(--violet)', `#1 ${finalReport.choice.candidate.title} · score=${finalReport.choice.evaluation.score}`);
    emitLog('SIGN', 'var(--text-muted)', 'reasoning trail signed.');
    
    emitEvent('completed', { report: finalReport });
    return finalReport;
  }
}
