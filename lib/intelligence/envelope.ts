import type { ImportQualityReport } from "@/lib/quality/assessImport";
import type { IntelligenceConfidence, IntelligenceEnvelope } from "./types";

export function wrapIntelligence<T>(
  payload: T,
  quality: ImportQualityReport,
  extraEvidence: string[] = [],
  extraLimitations: string[] = [],
): IntelligenceEnvelope<T> {
  const hr = quality.fieldCoverage.find((f) => f.label === "Heart rate");
  const evidence = [
    `${quality.runCount} runs in dataset`,
    quality.fitParsed > 0
      ? `${quality.fitParsed} runs with FIT stream data`
      : "No FIT streams parsed yet",
    hr && hr.total > 0 ? `HR on ${hr.count}/${hr.total} runs` : "Limited heart rate coverage",
    ...extraEvidence,
  ];

  return {
    dataAsOf: new Date().toISOString(),
    confidence: quality.overallConfidence,
    evidence: evidence.slice(0, 6),
    limitations: [
      ...quality.warnings,
      ...extraLimitations,
      "StrideIQ estimates are not medical advice.",
    ].slice(0, 6),
    payload,
  };
}

export function confidenceFromRuns(runCount: number): IntelligenceConfidence {
  if (runCount >= 40) return "high";
  if (runCount >= 20) return "medium";
  return "low";
}

/** Merge deterministic reasoning output into the standard intelligence envelope. */
export function wrapReasoning<T>(
  result: {
    payload: T;
    evidence: string[];
    assumptions: string[];
    limitations: string[];
    confidence: IntelligenceConfidence;
  },
  quality: ImportQualityReport,
): IntelligenceEnvelope<T & { assumptions: string[] }> {
  const base = wrapIntelligence(
    { ...result.payload, assumptions: result.assumptions },
    quality,
    result.evidence,
    result.limitations,
  );
  return {
    ...base,
    confidence: result.confidence,
    evidence: [...result.evidence, ...base.evidence].slice(0, 8),
    limitations: [...result.limitations, ...base.limitations].slice(0, 8),
  };
}
