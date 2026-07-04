import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../llm/claude.service';
import { TrizPrinciple } from '../triz/triz-data.service';
import {
  Candidate,
  Evaluation,
  PhysicalLimitCheck,
  ReasoningReport,
  TechnicalContradiction,
} from './dto/reasoning.types';

/** Step 6: assemble the final report and generate a rich written justification via LLM. */
@Injectable()
export class ReportService {
  constructor(private readonly claude: ClaudeService) {}

  async build(params: {
    contradiction: TechnicalContradiction;
    matchedInMatrix: boolean;
    trizPrinciplesUsed: TrizPrinciple[];
    candidates: Candidate[];
    physicalLimitChecks: PhysicalLimitCheck[];
    evaluations: Evaluation[];
  }): Promise<ReasoningReport> {
    const sorted = [...params.evaluations].sort((a, b) => b.score - a.score);
    const winnerEval = sorted[0];
    const winnerCandidate = params.candidates.find((c) => c.id === winnerEval.candidateId);
    if (!winnerCandidate) {
      throw new Error(`Could not find candidate for winning evaluation id ${winnerEval.candidateId}`);
    }

    const runnerUp = params.candidates.find((c) => c.id === sorted[1]?.candidateId);
    const runnerUpEval = sorted[1];

    const justification = await this.claude.generateText({
      systemInstruction:
        'You are a senior R&D engineer writing a concise but substantive selection report. ' +
        'Write in clear, professional prose — no bullet points, no markdown. ' +
        'Three paragraphs of 3-4 sentences each.',
      prompt:
        `Problem: ${params.contradiction.problem}\n\n` +
        `Technical contradiction resolved: ${params.contradiction.statement}\n\n` +
        `Selected solution: "${winnerCandidate.title}"\n` +
        `Description: ${winnerCandidate.description}\n` +
        `Scores (0-100): feasibility ${winnerEval.feasibility}, energy impact ${winnerEval.energyImpact}, ` +
        `equipment strain ${winnerEval.equipmentStrain}, side effects ${winnerEval.sideEffects}, ` +
        `composite ${winnerEval.score.toFixed(1)}\n` +
        `Evaluation reasoning: ${winnerEval.reasoning}\n\n` +
        (runnerUp && runnerUpEval
          ? `Runner-up for comparison: "${runnerUp.title}" — composite score ${runnerUpEval.score.toFixed(1)}\n\n`
          : '') +
        `Write three paragraphs:\n` +
        `1. Why this solution was chosen over the alternatives — reference the scores and what they mean in engineering terms.\n` +
        `2. How it resolves the technical contradiction and what physical/engineering principles make it work.\n` +
        `3. Key practical strengths and any limitations or risks an implementation team should be aware of.`,
      temperature: 0.5,
    });

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
        justification,
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
