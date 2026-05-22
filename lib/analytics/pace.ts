import type { RunActivity } from "@/lib/strava/types";

export function paceSecPerKm(run: RunActivity): number | null {
  const km = run.distanceM / 1000;
  if (km < 0.1) return null;
  const sec = run.movingSec > 0 ? run.movingSec : run.elapsedSec;
  if (sec <= 0) return null;
  return sec / km;
}

export function speedToPace(speedMps: number | null): number | null {
  if (speedMps === null || speedMps <= 0) return null;
  return 1000 / speedMps;
}
