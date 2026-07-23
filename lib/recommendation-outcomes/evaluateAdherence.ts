import type { RunActivity } from "@/lib/strava/types";
import type { WorkoutType } from "@/lib/analytics/workoutType";
import type { Adherence, LoggedRecommendation } from "./types";

/**
 * Deterministic adherence evaluation: did the athlete follow a logged
 * recommendation? Compares the recommendation's target day, session kind, and
 * distance range against the actual run(s) on that day. Adherence is the
 * foundation of outcome tracking — you can't judge whether advice worked until
 * you know whether it was taken.
 */

export interface AdherenceResult {
  adherence: Adherence;
  matchedRunIds: string[];
  note: string;
}

function dayIso(date: string): string {
  return date.slice(0, 10);
}

/** Kinds that map to the same real-world effort for matching purposes. */
function kindMatches(recommended: string, actual: WorkoutType): boolean {
  if (recommended === actual) return true;
  const easyish = new Set(["easy", "recovery"]);
  if (easyish.has(recommended) && easyish.has(actual)) return true;
  // A tempo recommendation is satisfied by any hard continuous effort.
  if (recommended === "tempo" && (actual === "tempo" || actual === "race")) return true;
  return false;
}

function distanceOk(rec: LoggedRecommendation, actualKm: number): boolean {
  if (rec.distanceKmMin == null || rec.distanceKmMax == null) return true;
  return actualKm >= rec.distanceKmMin * 0.8 && actualKm <= rec.distanceKmMax * 1.25;
}

export function evaluateAdherence(
  rec: LoggedRecommendation,
  runs: RunActivity[],
  typeByRunId: Map<string, WorkoutType>,
  todayIso: string,
): AdherenceResult {
  const target = dayIso(rec.targetDate);
  const dayRuns = runs.filter((r) => dayIso(r.date) === target);
  const dayOver = todayIso > target;

  // Rest days: success is the absence of a run.
  if (rec.kind === "rest") {
    if (dayRuns.length === 0) {
      return dayOver
        ? { adherence: "followed", matchedRunIds: [], note: "Rest day taken as recommended." }
        : { adherence: "pending", matchedRunIds: [], note: "Rest day not over yet." };
    }
    return {
      adherence: "skipped",
      matchedRunIds: dayRuns.map((r) => r.id),
      note: "A run was recorded on a recommended rest day.",
    };
  }

  if (dayRuns.length === 0) {
    return dayOver
      ? { adherence: "skipped", matchedRunIds: [], note: "No run recorded on the target day." }
      : { adherence: "pending", matchedRunIds: [], note: "Target day not over yet." };
  }

  // Pick the longest run of the day as the intended session.
  const primary = [...dayRuns].sort((a, b) => b.distanceM - a.distanceM)[0];
  const actualKm = primary.distanceM / 1000;
  const actualType = typeByRunId.get(primary.id) ?? "unknown";
  const typeOk = kindMatches(rec.kind, actualType);
  const distOk = distanceOk(rec, actualKm);
  const ids = dayRuns.map((r) => r.id);

  if (typeOk && distOk) {
    return { adherence: "followed", matchedRunIds: ids, note: "Ran the recommended session." };
  }
  if (!typeOk && !distOk) {
    return {
      adherence: "partial",
      matchedRunIds: ids,
      note: `Ran, but as ${actualType} (~${actualKm.toFixed(1)} km) vs the recommended ${rec.kind}.`,
    };
  }
  if (!typeOk) {
    return {
      adherence: "partial",
      matchedRunIds: ids,
      note: `Ran ~${actualKm.toFixed(1)} km, but as ${actualType} rather than ${rec.kind}.`,
    };
  }
  return {
    adherence: "partial",
    matchedRunIds: ids,
    note: `Ran the recommended ${rec.kind}, but ~${actualKm.toFixed(1)} km was outside the target range.`,
  };
}
