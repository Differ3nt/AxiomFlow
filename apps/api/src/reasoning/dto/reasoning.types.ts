import { TrizParameter, TrizPrinciple } from '../../triz/triz-data.service';

export interface ProblemExtraction {
  technicalSystem: string;
  improvingParameterId: number;
  worseningParameterId: number;
  constraints: string[];
}

export interface TechnicalContradiction {
  problem: string;
  technicalSystem: string;
  improving: TrizParameter;
  worsening: TrizParameter;
  constraints: string[];
  statement: string;
}

export type CandidateMethod = 'triz' | 'physics';

export interface Candidate {
  id: string;
  method: CandidateMethod;
  title: string;
  description: string;
  /** TRIZ candidates cite the principle they apply; biomimicry candidates cite the source organism/mechanism. */
  basis: string;
}

export interface PhysicalLimitCheck {
  candidateId: string;
  feasible: boolean;
  reason: string;
}

export interface Evaluation {
  candidateId: string;
  feasibility: number;
  energyImpact: number;
  equipmentStrain: number;
  sideEffects: number;
  score: number;
  reasoning: string;
}

export interface ReasoningReport {
  problem: string;
  contradiction: TechnicalContradiction;
  matchedInMatrix: boolean;
  trizPrinciplesUsed: TrizPrinciple[];
  candidates: Candidate[];
  physicalLimitChecks: PhysicalLimitCheck[];
  evaluations: Evaluation[];
  choice: {
    candidate: Candidate;
    evaluation: Evaluation;
    justification: string;
  };
}
