import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { findPersonalRecords } from "./records";
import { buildRacePredictionAnalysis } from "./predictions";
import { weeklyVolume } from "./volume";
import { parseISO } from "date-fns";

export interface PrTimelinePoint {
  date: string;
  bucket: string;
  label: string;
  timeSec: number;
  runId: string;
  runName: string;
  isNewPr: boolean;
}

export interface PredictionTimelinePoint {
  weekStart: string;
  label: string;
  consensus5kSec: number | null;
  consensus10kSec: number | null;
  consensusHmSec: number | null;
}

const TRACK_BUCKETS = ["5k", "10k", "hm"] as const;

export function buildPrTimeline(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = []
): PrTimelinePoint[] {
  const sorted = [...runs].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
  const points: PrTimelinePoint[] = [];
  const bestByBucket = new Map<string, number>();

  for (let i = 0; i < sorted.length; i++) {
    const slice = sorted.slice(0, i + 1);
    const fitSlice = fitDetails.filter((f) =>
      slice.some((r) => r.id === f.activityId)
    );
    const prs = findPersonalRecords(slice, fitSlice);

    for (const pr of prs) {
      if (!TRACK_BUCKETS.includes(pr.bucket as (typeof TRACK_BUCKETS)[number])) {
        continue;
      }
      const prev = bestByBucket.get(pr.bucket);
      if (prev === undefined || pr.timeSec < prev) {
        const isNewPr = prev !== undefined;
        bestByBucket.set(pr.bucket, pr.timeSec);
        points.push({
          date: pr.date,
          bucket: pr.bucket,
          label: pr.label,
          timeSec: pr.timeSec,
          runId: pr.runId,
          runName: pr.runName,
          isNewPr,
        });
      }
    }
  }

  return points;
}

export function buildPredictionTimeline(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = [],
  sampleEveryNWeeks = 4,
  maxPoints = 15
): PredictionTimelinePoint[] {
  const weeks = weeklyVolume(runs);
  if (weeks.length === 0) return [];

  const sortedRuns = [...runs].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  const sampleIndices: number[] = [];
  for (let i = 0; i < weeks.length; i += sampleEveryNWeeks) {
    sampleIndices.push(i);
  }
  if (sampleIndices[sampleIndices.length - 1] !== weeks.length - 1) {
    sampleIndices.push(weeks.length - 1);
  }

  const points: PredictionTimelinePoint[] = [];

  for (const idx of sampleIndices.slice(-maxPoints)) {
    const week = weeks[idx];
    const weekEnd = week.weekStart;
    const slice = sortedRuns.filter((r) => r.date <= weekEnd + "T23:59:59");
    if (slice.length < 3) continue;

    const fitSlice = fitDetails.filter((f) =>
      slice.some((r) => r.id === f.activityId)
    );
    const analysis = buildRacePredictionAnalysis(slice, fitSlice);

    const getConsensus = (label: string) =>
      analysis.consensus.find((c) => c.label === label)?.timeSec ?? null;

    points.push({
      weekStart: week.weekStart,
      label: week.label,
      consensus5kSec: getConsensus("5K"),
      consensus10kSec: getConsensus("10K"),
      consensusHmSec: getConsensus("Half Marathon"),
    });
  }

  return points;
}

export function recentPrHighlights(
  timeline: PrTimelinePoint[],
  withinDays = 14
): PrTimelinePoint[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);
  return timeline.filter(
    (p) => p.isNewPr && parseISO(p.date) >= cutoff
  );
}
