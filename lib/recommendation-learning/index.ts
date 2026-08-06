export type {
  TrackedRecommendationOutcome,
  OutcomeEvaluation,
  OutcomeTrackingInput,
  EvaluateOutcomeInput,
} from "./types";

export { buildOutcomeEvidenceFromAnalytics, mergeOutcomeEvidence } from "./buildOutcomeEvidence";
export {
  evaluateRecommendationOutcome,
  confidenceLabel,
  confidenceToScore,
} from "./evaluateRecommendationOutcome";
export {
  trackRecommendationOutcome,
  isObservable,
  hydrateOutcomeStore,
  MIN_OBSERVATION_HOURS,
  getTrackedOutcomes,
  evaluatePendingOutcomes,
  clearOutcomeStore,
} from "./trackRecommendationOutcome";
export { updateBeliefsFromOutcome, applyOutcomesToMemory } from "./updateBeliefsFromOutcome";

// `./persistence` is deliberately NOT re-exported here. It imports the Postgres
// driver, and this barrel is reachable from the browser via
// buildAdaptiveIntelligence -> adaptiveState -> use-athlete-intelligence. Server
// callers import "@/lib/recommendation-learning/persistence" directly.
