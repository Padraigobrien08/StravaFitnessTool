import type { RunActivity } from "@/lib/strava/types";
import type { AdherenceResult } from "./evaluateAdherence";
import type { LoggedRecommendation } from "./types";

/**
 * Adherence for a strategic (goal-scenario) recommendation, whose advice plays
 * out over weeks rather than a single day: did weekly running volume move toward
 * the recommended sustained target since it was issued?
 */

/** Days a strategic recommendation must age before its volume trend is judged. */
const MIN_AGE_DAYS = 10;

function dayIso(date: string): string {
  return date.slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

export function evaluateVolumeTrendAdherence(
  rec: LoggedRecommendation,
  runs: RunActivity[],
  todayIso: string,
): AdherenceResult {
  const target = rec.targetWeeklyKm;
  if (target == null || target <= 0) {
    return {
      adherence: "unknown",
      matchedRunIds: [],
      note: "No volume target on this recommendation.",
    };
  }

  const since = dayIso(rec.issuedAt || rec.targetDate);
  const ageDays = daysBetween(since, todayIso);
  if (ageDays < MIN_AGE_DAYS) {
    return {
      adherence: "pending",
      matchedRunIds: [],
      note: `Too soon to judge — ${ageDays}d of ${MIN_AGE_DAYS} elapsed.`,
    };
  }

  const windowRuns = runs.filter((r) => {
    const d = dayIso(r.date);
    return d >= since && d <= todayIso;
  });
  const totalKm = windowRuns.reduce((s, r) => s + r.distanceM / 1000, 0);
  const weeks = Math.max(1, ageDays / 7);
  const weeklyKm = totalKm / weeks;
  const ratio = weeklyKm / target;
  const ids = windowRuns.map((r) => r.id);
  const detail = `~${weeklyKm.toFixed(0)} km/wk vs ~${Math.round(target)} km/wk target`;

  if (ratio >= 0.9) {
    return { adherence: "followed", matchedRunIds: ids, note: `On target: ${detail}.` };
  }
  if (ratio >= 0.6) {
    return {
      adherence: "partial",
      matchedRunIds: ids,
      note: `Building, short of target: ${detail}.`,
    };
  }
  return { adherence: "skipped", matchedRunIds: ids, note: `Volume did not follow: ${detail}.` };
}
