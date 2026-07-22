export type {
  AdaptationSignal,
  AdaptationCategory,
  AdaptationConfidence,
  AdaptationStability,
} from "./types";

export { inferAdaptationSignals } from "./inferAdaptationSignals";
export { inferFatigueResponses } from "./inferFatigueResponses";
export { inferTrainingSensitivity } from "./inferTrainingSensitivity";
export { inferDurabilityChanges } from "./inferDurabilityChanges";
export { inferTaperResponse } from "./inferTaperResponse";

import type { DashboardInsights } from "@/lib/analytics";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning";
import type { AdaptationSignal } from "./types";
import { inferAdaptationSignals } from "./inferAdaptationSignals";
import { inferFatigueResponses } from "./inferFatigueResponses";
import { inferTrainingSensitivity } from "./inferTrainingSensitivity";
import { inferDurabilityChanges } from "./inferDurabilityChanges";
import { inferTaperResponse } from "./inferTaperResponse";

export function buildAdaptationSignals(
  analytics: DashboardInsights,
  outcomes: TrackedRecommendationOutcome[] = [],
): AdaptationSignal[] {
  const merged = [
    ...inferAdaptationSignals(analytics, outcomes),
    ...inferFatigueResponses(analytics),
    ...inferTrainingSensitivity(analytics),
    ...inferDurabilityChanges(analytics),
    ...inferTaperResponse(analytics),
  ];
  const byId = new Map<string, AdaptationSignal>();
  for (const s of merged) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }
  return [...byId.values()];
}
