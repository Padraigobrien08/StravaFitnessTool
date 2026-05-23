export interface LongitudinalComparison {
  id: string;
  title: string;
  summary: string;
  currentLabel: string;
  referenceLabel: string;
  evidence: string[];
  confidence: "low" | "medium" | "high";
}
