import type { RaceQualityEffort } from "./forecastTypes";

/** Dedupe and cap efforts so power-law fit stays stable (avoids negative R² / weight blow-ups). */
export function prepareCapabilityEfforts(efforts: RaceQualityEffort[]): RaceQualityEffort[] {
  const seen = new Set<string>();
  const deduped: RaceQualityEffort[] = [];

  for (const e of efforts) {
    const key = `${e.runId}-${e.distanceKm.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.distanceKm < 3 || e.distanceKm > 30 || e.timeSec < 60) continue;
    deduped.push(e);
  }

  return deduped.sort((a, b) => a.timeSec / a.distanceKm - b.timeSec / b.distanceKm).slice(0, 40);
}
