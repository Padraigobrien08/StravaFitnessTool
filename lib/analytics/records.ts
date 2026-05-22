import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { paceSecPerKm } from "./pace";

export interface DistanceBucket {
  key: string;
  label: string;
  minKm: number;
  maxKm: number;
}

export const DISTANCE_BUCKETS: DistanceBucket[] = [
  { key: "5k", label: "5K", minKm: 4.5, maxKm: 5.5 },
  { key: "10k", label: "10K", minKm: 9.5, maxKm: 10.5 },
  { key: "hm", label: "Half Marathon", minKm: 20.5, maxKm: 22 },
  { key: "long", label: "Longest Run", minKm: 0, maxKm: 999 },
];

export type RecordSource = "full_run" | "segment" | "laps";

export interface PersonalRecord {
  bucket: string;
  label: string;
  runId: string;
  runName: string;
  date: string;
  distanceKm: number;
  paceSecPerKm: number;
  timeSec: number;
  source: RecordSource;
  sourceNote?: string;
}

function runById(runs: RunActivity[], id: string): RunActivity | undefined {
  return runs.find((r) => r.id === id);
}

/** Compare PR candidates — fastest time at nominal distance wins. */
function pickBetter(
  a: PersonalRecord | null,
  b: PersonalRecord | null
): PersonalRecord | null {
  if (!a) return b;
  if (!b) return a;
  return a.timeSec < b.timeSec ? a : b;
}

export function findPersonalRecords(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = []
): PersonalRecord[] {
  const prs: PersonalRecord[] = [];
  const fitByRun = new Map(fitDetails.map((f) => [f.activityId, f]));

  for (const bucket of DISTANCE_BUCKETS) {
    if (bucket.key === "long") {
      const longest = [...runs].sort((a, b) => b.distanceM - a.distanceM)[0];
      if (longest && longest.distanceM / 1000 >= 15) {
        const pace = paceSecPerKm(longest);
        if (pace) {
          prs.push({
            bucket: "long",
            label: "Longest Run",
            runId: longest.id,
            runName: longest.name,
            date: longest.date,
            distanceKm: longest.distanceM / 1000,
            paceSecPerKm: pace,
            timeSec: longest.movingSec || longest.elapsedSec,
            source: "full_run",
          });
        }
      }
      continue;
    }

    let best: PersonalRecord | null = null;

    // 1. Best efforts from FIT streams / laps (subset of longer runs)
    for (const fit of fitDetails) {
      const effort = fit.bestEfforts?.find((e) => e.key === bucket.key);
      if (!effort) continue;
      const run = runById(runs, fit.activityId);
      if (!run) continue;

      const candidate: PersonalRecord = {
        bucket: bucket.key,
        label: bucket.label,
        runId: run.id,
        runName: run.name,
        date: run.date,
        distanceKm: effort.distanceM / 1000,
        paceSecPerKm: effort.paceSecPerKm,
        timeSec: effort.timeSec,
        source: effort.source === "laps" ? "laps" : "segment",
        sourceNote:
          effort.source === "segment"
            ? `Best ${bucket.label} effort within run`
            : `Best ${bucket.label} from lap data`,
      };
      best = pickBetter(best, candidate);
    }

    // 2. Standalone runs in distance bucket (whole activity)
    for (const run of runs) {
      const km = run.distanceM / 1000;
      if (km < bucket.minKm || km > bucket.maxKm) continue;
      const pace = paceSecPerKm(run);
      if (pace === null) continue;

      const candidate: PersonalRecord = {
        bucket: bucket.key,
        label: bucket.label,
        runId: run.id,
        runName: run.name,
        date: run.date,
        distanceKm: km,
        paceSecPerKm: pace,
        timeSec: run.movingSec || run.elapsedSec,
        source: "full_run",
        sourceNote: "Full activity",
      };
      best = pickBetter(best, candidate);
    }

    if (best) prs.push(best);
  }

  return prs;
}

/** Riegel: T2 = T1 * (D2/D1)^1.06 */
export function predictRaceTime(
  distanceM1: number,
  timeSec1: number,
  distanceM2: number
): number {
  const ratio = distanceM2 / distanceM1;
  return timeSec1 * Math.pow(ratio, 1.06);
}

export interface RacePrediction {
  label: string;
  distanceKm: number;
  predictedSec: number;
  basedOn: string;
}

export function racePredictions(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = []
): RacePrediction[] {
  const prs = findPersonalRecords(runs, fitDetails);
  const anchor =
    prs.find((p) => p.bucket === "10k") ?? prs.find((p) => p.bucket === "5k");
  if (!anchor) return [];

  const anchorDistM = anchor.distanceKm * 1000;
  const sourceLabel =
    anchor.source === "full_run"
      ? anchor.label
      : `${anchor.label} best effort`;
  const targets = [
    { label: "5K", km: 5 },
    { label: "10K", km: 10 },
    { label: "Half Marathon", km: 21.0975 },
    { label: "Marathon", km: 42.195 },
  ];

  return targets.map((t) => ({
    label: t.label,
    distanceKm: t.km,
    predictedSec: predictRaceTime(anchorDistM, anchor.timeSec, t.km * 1000),
    basedOn: `${sourceLabel} (${formatDurationShort(anchor.timeSec)}) on ${new Date(anchor.date).toLocaleDateString()} — ${anchor.runName}`,
  }));
}

function formatDurationShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
