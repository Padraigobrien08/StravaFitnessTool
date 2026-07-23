import type { AthleteBelief, AthleteMemoryProfile, BeliefConfidence } from "./types";

/**
 * Persistence merge for AthleteMemory.
 *
 * Beliefs are recomputed fresh from current analytics each session, but their
 * *history* should accumulate: a belief re-observed across many sessions is
 * more trustworthy than one seen once, and its first-observed date should not
 * reset. This pure merge folds stored history into a freshly-built profile,
 * keyed by the belief's stable id.
 */

export interface StoredBeliefMeta {
  beliefId: string;
  firstObserved: string;
  timesConfirmed: number;
  lastConfirmed: string;
}

const RANK: Record<BeliefConfidence, number> = { low: 0, medium: 1, high: 2 };
const BY_RANK: BeliefConfidence[] = ["low", "medium", "high"];

/**
 * A belief confirmed across many sessions earns a confidence floor, so a thin
 * evidence run in one session can't collapse a well-established belief.
 */
function reinforcedConfidence(fresh: BeliefConfidence, timesConfirmed: number): BeliefConfidence {
  const floor: BeliefConfidence =
    timesConfirmed >= 6 ? "high" : timesConfirmed >= 3 ? "medium" : "low";
  return BY_RANK[Math.max(RANK[fresh], RANK[floor])];
}

export function mergeBeliefWithStored(
  fresh: AthleteBelief,
  stored: StoredBeliefMeta | undefined,
  nowIso: string,
): AthleteBelief {
  if (!stored) {
    return {
      ...fresh,
      firstObserved: fresh.firstObserved ?? nowIso,
      timesConfirmed: 1,
      lastConfirmed: nowIso,
    };
  }
  const timesConfirmed = stored.timesConfirmed + 1;
  return {
    ...fresh,
    firstObserved: stored.firstObserved,
    timesConfirmed,
    lastConfirmed: nowIso,
    confidence: reinforcedConfidence(fresh.confidence, timesConfirmed),
    stability: timesConfirmed >= 3 ? "stable" : fresh.stability,
  };
}

const BELIEF_ARRAYS = [
  "adaptationPatterns",
  "fatiguePatterns",
  "pacingPatterns",
  "taperResponses",
  "modalityInteractions",
  "durabilitySignals",
] as const;

/**
 * Merge a freshly-built profile with stored belief history. Returns the enriched
 * profile plus the flat list of beliefs to persist back.
 */
export function mergeProfileWithStored(
  fresh: AthleteMemoryProfile,
  storedById: Map<string, StoredBeliefMeta>,
  nowIso: string,
): { profile: AthleteMemoryProfile; toPersist: AthleteBelief[] } {
  const profile: AthleteMemoryProfile = { ...fresh };
  const toPersist: AthleteBelief[] = [];

  for (const key of BELIEF_ARRAYS) {
    profile[key] = fresh[key].map((b) => {
      const merged = mergeBeliefWithStored(b, storedById.get(b.id), nowIso);
      toPersist.push(merged);
      return merged;
    });
  }

  return { profile, toPersist };
}
