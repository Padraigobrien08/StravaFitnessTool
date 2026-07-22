import type { RunActivity } from "@/lib/strava/types";
import type { WorkoutClassification } from "@/lib/analytics/workoutType";
import { paceSecPerKm } from "@/lib/analytics/pace";

export function compareToHistoricalSessions(
  run: RunActivity,
  workout: WorkoutClassification,
  peers: RunActivity[],
): string | undefined {
  const sameType = peers.filter((r) => {
    if (r.id === run.id) return false;
    const dist = Math.abs(r.distanceM - run.distanceM) / run.distanceM;
    return dist < 0.15;
  });
  if (sameType.length < 2) return undefined;

  const pace = paceSecPerKm(run);
  if (pace == null) return undefined;

  const peerPaces = sameType.map((r) => paceSecPerKm(r)).filter((p): p is number => p != null);
  if (peerPaces.length < 2) return undefined;

  const avg = peerPaces.reduce((a, b) => a + b, 0) / peerPaces.length;
  const deltaPct = ((pace - avg) / avg) * 100;

  if (Math.abs(deltaPct) < 2) {
    return `Pace aligns with your prior ${workout.type} sessions at similar distance.`;
  }
  if (deltaPct < -3) {
    return `Execution appears faster than your previous ${peerPaces.length} comparable ${workout.type} sessions.`;
  }
  return `Pace appears slower than your previous ${peerPaces.length} comparable ${workout.type} sessions — may reflect fatigue or conditions.`;
}
