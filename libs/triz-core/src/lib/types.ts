export interface TrizParameter {
  id: number;
  name: string;
  description: string;
  examples: string[];
}

export interface TrizPrinciple {
  id: number;
  name: string;
  description: string;
}

export interface MatrixRow {
  improving: number;
  worsening: number;
  principles: number[];
}

export interface MatrixLookupResult {
  improving: TrizParameter;
  worsening: TrizParameter;
  principles: TrizPrinciple[];
  /** True when the pair was found directly in the sourced contradiction matrix, false when the generic fallback rule below was applied. */
  matched: boolean;
}
