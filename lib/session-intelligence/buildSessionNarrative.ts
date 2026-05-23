import type { SessionIntelligence } from "./types";

export function buildSessionNarrative(
  session: SessionIntelligence,
  runName?: string
): string {
  const parts: string[] = [];
  const label = runName ? `${runName}: ` : "";

  parts.push(
    `${label}Execution appears ${session.executionQuality} with ${session.fatigueCost} fatigue cost.`
  );

  if (session.likelyAdaptations[0]) {
    parts.push(session.likelyAdaptations[0]);
  }
  if (session.historicalComparison) {
    parts.push(session.historicalComparison);
  }
  if (session.hrAssessment) {
    parts.push(session.hrAssessment);
  }

  return parts.join(" ");
}
