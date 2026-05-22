export type InsightQuestion =
  | "improving"
  | "training"
  | "ready"
  | "next"
  | "changed";

export type InsightSeverity = "positive" | "neutral" | "warning";

export type InsightConfidence = "low" | "medium" | "high";

export type Insight = {
  id: string;
  question: InsightQuestion;
  title: string;
  severity: InsightSeverity;
  evidence: string[];
  recommendation?: string;
  confidence: InsightConfidence;
};
