import { Injectable } from '@nestjs/common';
import { Candidate, PhysicalLimitCheck } from './dto/reasoning.types';

/**
 * Deterministic guardrail run BEFORE any LLM-assisted scoring: reject candidates that
 * claim to beat basic physical limits (perpetual motion, free energy, >100% conversion
 * efficiency, etc). Pure keyword/pattern matching — no model call, so it can't be talked
 * out of flagging an offending phrase.
 */
@Injectable()
export class PhysicalLimitValidatorService {
  private readonly bannedPatterns: RegExp[] = [
    /perpetual motion/i,
    /perpetuum mobile/i,
    /free energy/i,
    /over-?unity/i,
    /100%\s*(efficient|efficiency|conversion)/i,
    /violat(e|es|ing)\s+(the\s+)?(law of )?thermodynamics/i,
    /zero[- ]energy/i,
    /infinite energy/i,
  ];

  check(candidate: Candidate): PhysicalLimitCheck {
    const text = `${candidate.title} ${candidate.description}`;
    const match = this.bannedPatterns.find((pattern) => pattern.test(text));

    if (match) {
      return {
        candidateId: candidate.id,
        feasible: false,
        reason: `Rejected by physical-limit guardrail: matched pattern ${match}.`,
      };
    }

    return {
      candidateId: candidate.id,
      feasible: true,
      reason: 'No physical-limit violation detected.',
    };
  }

  checkAll(candidates: Candidate[]): PhysicalLimitCheck[] {
    return candidates.map((c) => this.check(c));
  }
}
