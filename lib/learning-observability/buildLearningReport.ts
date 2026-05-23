import { allBeliefs } from "@/lib/athlete-memory";
import type { AthleteMemoryProfile } from "@/lib/athlete-memory/types";
import type { AdaptationSignal } from "@/lib/adaptation-engine";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning";
import type { CausalExplanation } from "@/lib/causal-reasoning";
import type {
  LearningObservabilityReport,
  LearningTimelineEntry,
} from "./types";

export function buildLearningObservabilityReport(params: {
  memory: AthleteMemoryProfile;
  adaptationSignals: AdaptationSignal[];
  outcomes: TrackedRecommendationOutcome[];
  causalSnapshots?: CausalExplanation[];
}): LearningObservabilityReport {
  const beliefs = allBeliefs(params.memory);
  const contradictions: string[] = [];
  const uncertainties: string[] = [];

  for (const b of beliefs) {
    if (b.counterEvidence.length > 0) {
      contradictions.push(
        `${b.statement.slice(0, 60)}… — counter: ${b.counterEvidence[0]}`
      );
    }
    if (b.confidence === "low" || b.stability === "emerging") {
      uncertainties.push(`Emerging/low-confidence: ${b.statement.slice(0, 72)}…`);
    }
  }

  const timeline: LearningTimelineEntry[] = [];

  for (const o of params.outcomes.slice(0, 8)) {
    timeline.push({
      at: o.evaluatedAt ?? o.issuedAt,
      type: "outcome",
      summary: `${o.evaluation}: ${o.recommendation.slice(0, 80)}`,
      detail: o.observedSignals.slice(0, 2).join("; "),
    });
  }

  for (const s of params.adaptationSignals.filter((s) => s.stability === "emerging").slice(0, 5)) {
    timeline.push({
      at: params.memory.generatedAt,
      type: "adaptation",
      summary: s.statement,
      detail: `${s.confidence} confidence`,
    });
  }

  timeline.sort((a, b) => b.at.localeCompare(a.at));

  return {
    generatedAt: new Date().toISOString(),
    activeBeliefs: beliefs,
    adaptationSignals: params.adaptationSignals,
    recommendationOutcomes: params.outcomes,
    confidenceChanges: [],
    contradictions: contradictions.slice(0, 8),
    uncertainties: uncertainties.slice(0, 8),
    timeline: timeline.slice(0, 12),
    causalSnapshots: params.causalSnapshots ?? [],
  };
}
