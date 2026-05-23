export type CausalImpact = "small" | "moderate" | "large";
export type CausalConfidence = "low" | "medium" | "high";

export interface CausalDriver {
  driver: string;
  impact: CausalImpact;
  confidence: CausalConfidence;
  evidence: string[];
}

export interface CausalExplanation {
  phenomenon: string;
  likelyDrivers: CausalDriver[];
  uncertainties: string[];
  summary: string;
}

export type CausalPhenomenon =
  | "readiness"
  | "fatigue"
  | "forecast"
  | "efficiency"
  | "execution"
  | "pacing";
