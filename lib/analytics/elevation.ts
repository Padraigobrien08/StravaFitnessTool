import type { RunActivity } from "@/lib/strava/types";
import { parseISO, format } from "date-fns";

export interface ElevationPoint {
  date: string;
  label: string;
  runName: string;
  gainPerKm: number;
  elevationGainM: number;
  distanceKm: number;
}

export function elevationPerKm(runs: RunActivity[]): ElevationPoint[] {
  return runs
    .filter((r) => r.elevationGainM !== null && r.elevationGainM > 0)
    .map((r) => {
      const km = r.distanceM / 1000;
      return {
        date: r.date,
        label: format(parseISO(r.date), "MMM d"),
        runName: r.name,
        gainPerKm: Math.round((r.elevationGainM! / km) * 10) / 10,
        elevationGainM: r.elevationGainM!,
        distanceKm: km,
      };
    });
}

export function avgElevationPerKm(points: ElevationPoint[]): number | null {
  if (points.length === 0) return null;
  return Math.round((points.reduce((s, p) => s + p.gainPerKm, 0) / points.length) * 10) / 10;
}
