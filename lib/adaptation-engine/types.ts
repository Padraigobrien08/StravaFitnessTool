export type AdaptationCategory =
  | "threshold"
  | "freshness"
  | "durability"
  | "volume"
  | "modality"
  | "pacing"
  | "recovery";

export type AdaptationConfidence = "low" | "medium" | "high";
export type AdaptationStability = "emerging" | "stable" | "weakening";

export interface AdaptationSignal {
  id: string;
  category: AdaptationCategory;
  statement: string;
  confidence: AdaptationConfidence;
  supportingEvidence: string[];
  contradictoryEvidence: string[];
  stability: AdaptationStability;
}
