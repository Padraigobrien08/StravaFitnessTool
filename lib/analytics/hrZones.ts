import type { RunActivity } from "@/lib/strava/types";

export interface HrZoneBucket {
  zone: string;
  label: string;
  pct: number;
  runCount: number;
}

const ZONE_DEFS = [
  { zone: "Z1", label: "Recovery (<60%)", min: 0, max: 0.6 },
  { zone: "Z2", label: "Easy (60–70%)", min: 0.6, max: 0.7 },
  { zone: "Z3", label: "Aerobic (70–80%)", min: 0.7, max: 0.8 },
  { zone: "Z4", label: "Threshold (80–90%)", min: 0.8, max: 0.9 },
  { zone: "Z5", label: "Max (90%+)", min: 0.9, max: 1.01 },
];

export function classifyHrZone(avgHr: number, maxHr: number): string {
  const pct = avgHr / maxHr;
  for (const z of ZONE_DEFS) {
    if (pct >= z.min && pct < z.max) return z.zone;
  }
  return "Z5";
}

export function hrZoneDistribution(runs: RunActivity[], athleteMaxHr: number): HrZoneBucket[] {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const run of runs) {
    if (run.avgHr === null) continue;
    const zone = classifyHrZone(run.avgHr, athleteMaxHr);
    counts[zone] = (counts[zone] ?? 0) + 1;
    total += 1;
  }

  return ZONE_DEFS.map((z) => ({
    zone: z.zone,
    label: z.label,
    runCount: counts[z.zone] ?? 0,
    pct: total > 0 ? ((counts[z.zone] ?? 0) / total) * 100 : 0,
  }));
}

export function easyHardSplit(
  runs: RunActivity[],
  athleteMaxHr: number,
): { easy: number; hard: number; easyPct: number } {
  let easy = 0;
  let hard = 0;
  for (const run of runs) {
    if (run.avgHr === null) continue;
    const pct = run.avgHr / athleteMaxHr;
    if (pct < 0.8) easy += 1;
    else hard += 1;
  }
  const total = easy + hard;
  return {
    easy,
    hard,
    easyPct: total > 0 ? (easy / total) * 100 : 0,
  };
}
