import type { StravaActivityZone } from "./fetchAthlete";

/** Strava may return zones as an array or a keyed object depending on API version. */
export function normalizeAthleteZones(raw: unknown): StravaActivityZone[] {
  if (Array.isArray(raw)) return raw as StravaActivityZone[];
  if (raw && typeof raw === "object") {
    return Object.values(raw as Record<string, StravaActivityZone>);
  }
  return [];
}

export function maxHrFromZones(zones: StravaActivityZone[]): number | null {
  const hr = zones.find((z) => z.type === "heartrate");
  return hr?.max ?? null;
}
