import type { AdaptationSignal } from "@/lib/adaptation-engine";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning";
import type { AthleteMemoryProfile } from "@/lib/athlete-memory/types";
import { selectRelevantBeliefs } from "@/lib/athlete-memory";

export function buildAdaptivePlanningNotes(params: {
  memory: AthleteMemoryProfile;
  adaptationSignals: AdaptationSignal[];
  outcomes: TrackedRecommendationOutcome[];
  raceWeek?: boolean;
}): string[] {
  const notes: string[] = [];
  const { beliefs } = selectRelevantBeliefs(params.memory, {
    forPlanning: true,
    maxBeliefs: 6,
  });

  for (const b of beliefs) {
    if (b.category === "fatigue" && /stack|density|hard/i.test(b.statement)) {
      notes.push(`Adaptive: ${b.recommendedUse}`);
    }
    if (b.category === "taper" && params.raceWeek) {
      notes.push(`Adaptive taper: ${b.recommendedUse}`);
    }
    if (b.category === "modality" && /interference/i.test(b.statement)) {
      notes.push("Adaptive: separate hard cross-training from key runs");
    }
  }

  for (const s of params.adaptationSignals) {
    if (s.category === "freshness" && s.confidence !== "low") {
      if (/sensitive|stack|density/i.test(s.statement)) {
        notes.push(`Adaptation: ${s.statement} — avoid stacking hard sessions`);
      }
    }
    if (s.category === "threshold" && /responds well|improve/i.test(s.statement)) {
      notes.push(`Adaptation: ${s.statement} — maintain threshold support`);
    }
    if (s.category === "recovery" && params.raceWeek && /taper|fresh/i.test(s.statement)) {
      notes.push(`Adaptation: ${s.statement} — preserve taper pattern`);
    }
  }

  const contradicted = params.outcomes.filter((o) => o.evaluation === "contradicted");
  if (contradicted.length >= 2) {
    notes.push(
      "Recent recommendations were contradicted — bias conservative until patterns clarify"
    );
  }

  return [...new Set(notes)].slice(0, 8);
}
