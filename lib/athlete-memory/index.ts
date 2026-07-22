export type {
  AthleteBelief,
  AthleteMemoryProfile,
  BeliefCategory,
  BeliefConfidence,
  BeliefStability,
  MemoryUpdateEvidence,
  RecommendationOutcome,
  RelevantMemorySelection,
} from "./types";

export { buildAthleteMemoryProfile } from "./buildAthleteMemoryProfile";
export { updateAthleteMemoryProfile } from "./updateAthleteMemoryProfile";
export { selectRelevantBeliefs, highestValueBeliefs } from "./selectRelevantBeliefs";
export {
  serializeAthleteMemoryForLLM,
  serializeMemoryForCoachAnswer,
  profileToJson,
} from "./memorySerialization";
export { inferAdaptationPatterns } from "./inferAdaptationPatterns";
export { inferFatiguePatterns } from "./inferFatiguePatterns";
export { inferPacingPatterns } from "./inferPacingPatterns";
export { inferTaperResponses } from "./inferTaperResponses";
export { inferModalityInteractions } from "./inferModalityInteractions";
export { inferDurabilitySignals } from "./inferDurabilitySignals";
export { inferRecommendationOutcomes } from "./inferRecommendationOutcomes";
export { allBeliefs, createBelief } from "./beliefUtils";
export { classifyMemoryQuestion } from "./memoryIntent";

/** Display adapter for Intelligence tiles (legacy MemorySnippet shape). */
export function beliefsToMemoryDisplay(
  beliefs: import("./types").AthleteBelief[],
): import("@/lib/coach/memorySnippets").MemorySnippet[] {
  return beliefs.map((b) => ({
    id: b.id,
    label: b.category.charAt(0).toUpperCase() + b.category.slice(1),
    text: b.statement,
    confidence: b.confidence,
    stability: b.stability,
  }));
}
