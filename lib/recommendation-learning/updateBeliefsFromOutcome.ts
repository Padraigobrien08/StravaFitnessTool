import type { AthleteBelief, AthleteMemoryProfile } from "@/lib/athlete-memory/types";
import { updateAthleteMemoryProfile } from "@/lib/athlete-memory";
import type { TrackedRecommendationOutcome } from "./types";
import { confidenceLabel } from "./evaluateRecommendationOutcome";

function categoryFromRecommendation(text: string): AthleteBelief["category"] {
  const t = text.toLowerCase();
  if (/taper|race week/i.test(t)) return "taper";
  if (/intensity|hard|stack|fresh/i.test(t)) return "fatigue";
  if (/threshold|tempo|efficiency|aerobic/i.test(t)) return "adaptation";
  if (/long run|durability|pace/i.test(t)) return "pacing";
  if (/strength|modality|cross/i.test(t)) return "modality";
  return "adaptation";
}

export function updateBeliefsFromOutcome(
  profile: AthleteMemoryProfile,
  outcome: TrackedRecommendationOutcome,
): AthleteMemoryProfile {
  const category = categoryFromRecommendation(outcome.recommendation);
  const support =
    outcome.evaluation === "supported" || outcome.evaluation === "partially_supported";
  const contradict = outcome.evaluation === "contradicted";

  if (!support && !contradict) return profile;

  const evidenceUpdate = {
    observedAt: outcome.evaluatedAt ?? new Date().toISOString(),
    supporting: support ? { [category]: outcome.observedSignals.slice(0, 4) } : undefined,
    contradicting: contradict ? { [category]: outcome.observedSignals.slice(0, 4) } : undefined,
  };

  const updated = updateAthleteMemoryProfile(profile, evidenceUpdate);

  if (support && outcome.evaluation === "supported") {
    const list = getBeliefList(updated, category);
    const match = list.find((b) =>
      b.statement.toLowerCase().includes(outcome.recommendation.slice(0, 24).toLowerCase()),
    );
    if (!match && outcome.observedSignals.length >= 2) {
      list.push({
        id: `learned-${outcome.recommendationId}`,
        category,
        statement: `Historical evidence suggests: ${outcome.recommendation}`,
        confidence: confidenceLabel(outcome.confidenceAfter ?? 0.5),
        evidence: outcome.evidence,
        counterEvidence: [],
        lastUpdated: outcome.evaluatedAt ?? new Date().toISOString(),
        stability: "emerging",
        recommendedUse: "Consider when similar load patterns recur",
      });
      setBeliefList(updated, category, list);
    }
  }

  return updated;
}

function getBeliefList(
  profile: AthleteMemoryProfile,
  category: AthleteBelief["category"],
): AthleteBelief[] {
  switch (category) {
    case "adaptation":
      return profile.adaptationPatterns;
    case "fatigue":
      return profile.fatiguePatterns;
    case "pacing":
      return profile.pacingPatterns;
    case "taper":
      return profile.taperResponses;
    case "modality":
      return profile.modalityInteractions;
    case "durability":
      return profile.durabilitySignals;
    default:
      return profile.adaptationPatterns;
  }
}

function setBeliefList(
  profile: AthleteMemoryProfile,
  category: AthleteBelief["category"],
  beliefs: AthleteBelief[],
): void {
  switch (category) {
    case "adaptation":
      profile.adaptationPatterns = beliefs;
      break;
    case "fatigue":
      profile.fatiguePatterns = beliefs;
      break;
    case "pacing":
      profile.pacingPatterns = beliefs;
      break;
    case "taper":
      profile.taperResponses = beliefs;
      break;
    case "modality":
      profile.modalityInteractions = beliefs;
      break;
    case "durability":
      profile.durabilitySignals = beliefs;
      break;
    default:
      break;
  }
}

export function applyOutcomesToMemory(
  profile: AthleteMemoryProfile,
  outcomes: TrackedRecommendationOutcome[],
): AthleteMemoryProfile {
  let current = profile;
  for (const o of outcomes) {
    if (o.evaluation === "inconclusive" && !o.evaluatedAt) continue;
    current = updateBeliefsFromOutcome(current, o);
  }
  return current;
}
