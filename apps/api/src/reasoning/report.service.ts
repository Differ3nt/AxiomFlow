import { Injectable } from '@nestjs/common';
import { TrizPrinciple } from '../triz/triz-data.service';
import {
  Candidate,
  Evaluation,
  PhysicalLimitCheck,
  ReasoningReport,
  TechnicalContradiction,
} from './dto/reasoning.types';

/** Step 6: assemble the 5 required sections (problem, contradiction, candidates, evaluation, choice) — pure code, no LLM. */
@Injectable()
export class ReportService {
  build(params: {
    contradiction: TechnicalContradiction;
    matchedInMatrix: boolean;
    trizPrinciplesUsed: TrizPrinciple[];
    candidates: Candidate[];
    physicalLimitChecks: PhysicalLimitCheck[];
    evaluations: Evaluation[];
  }): ReasoningReport {
    const winnerEval = [...params.evaluations].sort((a, b) => b.score - a.score)[0];
    const winnerCandidate = params.candidates.find((c) => c.id === winnerEval.candidateId);
    if (!winnerCandidate) {
      throw new Error(`Could not find candidate for winning evaluation id ${winnerEval.candidateId}`);
    }

    return {
      problem: params.contradiction.problem,
      contradiction: params.contradiction,
      matchedInMatrix: params.matchedInMatrix,
      trizPrinciplesUsed: params.trizPrinciplesUsed,
      candidates: params.candidates,
      physicalLimitChecks: params.physicalLimitChecks,
      evaluations: params.evaluations,
      choice: {
        candidate: winnerCandidate,
        evaluation: winnerEval,
        justification:
          `Selected "${winnerCandidate.title}" (${winnerCandidate.method.toUpperCase()}, ${winnerCandidate.basis}) ` +
          `with the highest weighted score (${winnerEval.score.toFixed(2)}/10) among ${params.evaluations.length} evaluated candidates.`,
      },
    };
  }

  print(report: ReasoningReport): void {
    const line = (char = '─') => char.repeat(78);

    console.log(line('='));
    console.log('1. PROBLEM');
    console.log(line('='));
    console.log(report.problem.trim());

    console.log('\n' + line('='));
    console.log('2. TECHNICAL CONTRADICTION');
    console.log(line('='));
    console.log(`System: ${report.contradiction.technicalSystem}`);
    console.log(`Improving: (${report.contradiction.improving.id}) ${report.contradiction.improving.name}`);
    console.log(`Worsening: (${report.contradiction.worsening.id}) ${report.contradiction.worsening.name}`);
    console.log(`Constraints: ${report.contradiction.constraints.join('; ') || 'none stated'}`);
    console.log(`Statement: ${report.contradiction.statement}`);
    console.log(
      `Matrix lookup: ${report.matchedInMatrix ? 'MATCHED a sourced contradiction-matrix row' : 'NOT matched — generic fallback principles used'}`,
    );
    console.log(`Principles used: ${report.trizPrinciplesUsed.map((p) => `(${p.id}) ${p.name}`).join(', ')}`);

    console.log('\n' + line('='));
    console.log(`3. CANDIDATES (${report.candidates.length})`);
    console.log(line('='));
    report.candidates.forEach((c, i) => {
      console.log(`\n[${i + 1}] ${c.title}  —  ${c.method.toUpperCase()}`);
      console.log(`    Basis: ${c.basis}`);
      console.log(`    ${c.description}`);
    });

    console.log('\n' + line('='));
    console.log('4. EVALUATION');
    console.log(line('='));
    report.evaluations
      .slice()
      .sort((a, b) => b.score - a.score)
      .forEach((e) => {
        const candidate = report.candidates.find((c) => c.id === e.candidateId);
        console.log(
          `\n${candidate?.title ?? e.candidateId}  ->  score ${e.score.toFixed(2)}/10  ` +
            `(feasibility ${e.feasibility}, energyImpact ${e.energyImpact}, equipmentStrain ${e.equipmentStrain}, sideEffects ${e.sideEffects})`,
        );
        console.log(`  ${e.reasoning}`);
      });

    console.log('\n' + line('='));
    console.log('5. CHOICE');
    console.log(line('='));
    console.log(report.choice.justification);

    console.log('\n' + line());
  }
}
