import type {
  AthleteBelief,
  AthleteMemoryProfile,
  BeliefCategory,
  BeliefConfidence,
  BeliefStability,
} from "./types";

const ISO = () => new Date().toISOString();

export function createBelief(params: {
  id: string;
  category: BeliefCategory;
  statement: string;
  evidence: string[];
  confidence?: BeliefConfidence;
  counterEvidence?: string[];
  recommendedUse: string;
  stability?: BeliefStability;
  firstObserved?: string;
}): AthleteBelief {
  const evidenceCount = params.evidence.length;
  let confidence = params.confidence;
  if (!confidence) {
    confidence = evidenceCount >= 3 ? "medium" : evidenceCount >= 2 ? "low" : "low";
  }
  if (evidenceCount < 2 && confidence === "high") {
    confidence = "medium";
  }
  if (evidenceCount < 1) {
    confidence = "low";
  }

  return {
    id: params.id,
    category: params.category,
    statement: params.statement,
    confidence,
    evidence: params.evidence,
    counterEvidence: params.counterEvidence ?? [],
    firstObserved: params.firstObserved ?? ISO(),
    lastUpdated: ISO(),
    stability: params.stability ?? (evidenceCount >= 3 ? "stable" : "emerging"),
    recommendedUse: params.recommendedUse,
  };
}

export function allBeliefs(profile: AthleteMemoryProfile): AthleteBelief[] {
  return [
    ...profile.adaptationPatterns,
    ...profile.fatiguePatterns,
    ...profile.pacingPatterns,
    ...profile.taperResponses,
    ...profile.modalityInteractions,
    ...profile.durabilitySignals,
  ];
}

export function bumpConfidence(current: BeliefConfidence, supportCount: number): BeliefConfidence {
  if (supportCount >= 4) return "high";
  if (supportCount >= 2) return current === "low" ? "medium" : current;
  return "low";
}

export function lowerConfidence(current: BeliefConfidence): BeliefConfidence {
  if (current === "high") return "medium";
  if (current === "medium") return "low";
  return "low";
}

export function uniqueEvidence(items: string[], max = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

export function emptyProfile(athleteId?: string): AthleteMemoryProfile {
  return {
    generatedAt: ISO(),
    athleteId,
    adaptationPatterns: [],
    fatiguePatterns: [],
    pacingPatterns: [],
    taperResponses: [],
    modalityInteractions: [],
    durabilitySignals: [],
    recommendationOutcomes: [],
  };
}
