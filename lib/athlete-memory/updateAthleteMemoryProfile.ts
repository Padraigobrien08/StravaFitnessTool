import {
  allBeliefs,
  bumpConfidence,
  lowerConfidence,
  uniqueEvidence,
} from "./beliefUtils";
import { buildAthleteMemoryProfile } from "./buildAthleteMemoryProfile";
import type { DashboardInsights } from "@/lib/analytics";
import type {
  AthleteBelief,
  AthleteMemoryProfile,
  BeliefCategory,
  MemoryUpdateEvidence,
} from "./types";

function categoryKey(
  profile: AthleteMemoryProfile,
  category: BeliefCategory
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
    case "recovery":
      return profile.fatiguePatterns;
    default:
      return [];
  }
}

function setCategoryBeliefs(
  profile: AthleteMemoryProfile,
  category: BeliefCategory,
  beliefs: AthleteBelief[]
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
    case "recovery":
      profile.fatiguePatterns = beliefs;
      break;
    default:
      break;
  }
}

function updateBeliefList(
  existing: AthleteBelief[],
  category: BeliefCategory,
  evidence: MemoryUpdateEvidence
): AthleteBelief[] {
  const support = evidence.supporting?.[category] ?? [];
  const contradict = evidence.contradicting?.[category] ?? [];
  const now = evidence.observedAt;
  const byId = new Map(existing.map((b) => [b.id, b]));

  for (const belief of existing) {
    const updated = { ...belief };

    if (support.length) {
      updated.evidence = uniqueEvidence([...belief.evidence, ...support]);
      updated.lastUpdated = now;
      updated.confidence = bumpConfidence(
        belief.confidence,
        updated.evidence.length
      );
      if (updated.evidence.length >= 3 && updated.counterEvidence.length === 0) {
        updated.stability = "stable";
      } else if (updated.stability === "weakening") {
        updated.stability = "emerging";
      }
    }

    if (contradict.length) {
      updated.counterEvidence = uniqueEvidence([
        ...belief.counterEvidence,
        ...contradict,
      ]);
      updated.lastUpdated = now;
      updated.confidence = lowerConfidence(belief.confidence);
      if (updated.counterEvidence.length >= updated.evidence.length) {
        updated.stability = "weakening";
      }
      if (updated.confidence === "high" && updated.evidence.length < 3) {
        updated.confidence = "medium";
      }
    }

    byId.set(belief.id, updated);
  }

  for (const candidate of evidence.newBeliefCandidates ?? []) {
    if (candidate.category !== category) continue;
    if (byId.has(candidate.id)) continue;
    if (candidate.evidence.length < 1) continue;
    const conf =
      candidate.evidence.length >= 3 ? candidate.confidence : "low";
    byId.set(candidate.id, {
      ...candidate,
      confidence: conf === "high" && candidate.evidence.length < 3 ? "medium" : conf,
      stability: "emerging",
      lastUpdated: now,
    });
  }

  return [...byId.values()];
}

const CATEGORIES: BeliefCategory[] = [
  "adaptation",
  "fatigue",
  "pacing",
  "taper",
  "modality",
  "durability",
];

export function updateAthleteMemoryProfile(
  previousProfile: AthleteMemoryProfile | null,
  newEvidence: MemoryUpdateEvidence,
  freshAnalytics?: DashboardInsights | null
): AthleteMemoryProfile {
  const athleteId = previousProfile?.athleteId;
  const base =
    previousProfile ??
    (freshAnalytics
      ? buildAthleteMemoryProfile(freshAnalytics, athleteId)
      : {
          generatedAt: newEvidence.observedAt,
          adaptationPatterns: [],
          fatiguePatterns: [],
          pacingPatterns: [],
          taperResponses: [],
          modalityInteractions: [],
          durabilitySignals: [],
          recommendationOutcomes: [],
        });

  const profile: AthleteMemoryProfile = {
    ...base,
    generatedAt: newEvidence.observedAt,
    recommendationOutcomes: [...base.recommendationOutcomes],
  };

  for (const category of CATEGORIES) {
    const updated = updateBeliefList(
      categoryKey(profile, category),
      category,
      newEvidence
    );
    setCategoryBeliefs(profile, category, updated);
  }

  if (freshAnalytics) {
    const rebuilt = buildAthleteMemoryProfile(
      freshAnalytics,
      profile.athleteId
    );
    const mergedIds = new Set(allBeliefs(profile).map((b) => b.id));
    for (const belief of allBeliefs(rebuilt)) {
      if (mergedIds.has(belief.id)) continue;
      if (belief.confidence === "high" && belief.evidence.length < 2) {
        belief.confidence = "medium";
      }
      const list = categoryKey(profile, belief.category);
      list.push(belief);
      setCategoryBeliefs(profile, belief.category, list);
      mergedIds.add(belief.id);
    }
  }

  return profile;
}
