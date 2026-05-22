import type { RaceDistance, RaceGoal } from "@/lib/analytics/readiness";

const DISTANCES = new Set<RaceDistance>(["5k", "10k", "hm", "marathon"]);

/** Client-safe race goal for API sync (invalid persisted values → null). */
export function sanitizeRaceGoalForApi(
  goal: RaceGoal | null | undefined
): RaceGoal | null {
  if (!goal || typeof goal !== "object") return null;
  const distance = (goal as { distance?: string }).distance;
  if (!distance || !DISTANCES.has(distance as RaceDistance)) return null;
  const date = (goal as { date?: string }).date;
  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const targetTimeSec = (goal as { targetTimeSec?: unknown }).targetTimeSec;
  const out: RaceGoal = {
    distance: distance as RaceDistance,
    date,
  };
  if (
    typeof targetTimeSec === "number" &&
    Number.isInteger(targetTimeSec) &&
    targetTimeSec > 0
  ) {
    out.targetTimeSec = targetTimeSec;
  }
  return out;
}
