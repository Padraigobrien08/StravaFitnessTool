import { differenceInDays, parseISO } from "date-fns";
import {
  collectEffortPoints,
  fitPowerLawRegression,
  type EffortPoint,
} from "@/lib/analytics/predictions";
import { predictRaceTime, findPersonalRecords } from "@/lib/analytics/records";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type {
  ForecastModelEstimate,
  RaceForecastInput,
  RaceQualityEffort,
} from "./forecastTypes";

function effortToPoint(e: RaceQualityEffort): EffortPoint {
  return {
    distanceKm: e.distanceKm,
    timeSec: e.timeSec,
    runId: e.runId,
    runName: e.runName,
    date: e.date,
    source: e.source,
  };
}

function recencyWeight(date: string, halfLifeDays = 90): number {
  const days = Math.max(0, differenceInDays(new Date(), parseISO(date)));
  return Math.exp(-days / halfLifeDays);
}

/** How relevant an anchor distance is to the race distance */
export function distanceRelevanceWeight(
  anchorKm: number,
  targetKm: number
): number {
  if (targetKm <= 0 || anchorKm <= 0) return 0;
  const ratio = anchorKm / targetKm;
  if (ratio >= 0.85 && ratio <= 1.15) return 1;
  if (ratio >= 0.55 && ratio < 0.85) return 0.85;
  if (ratio >= 0.3 && ratio < 0.55) return 0.55;
  if (ratio < 0.3) return Math.max(0.12, ratio * 0.5);
  if (ratio > 1.15 && ratio <= 1.4) return 0.75;
  return 0.4;
}

function pickBestAnchor(
  efforts: RaceQualityEffort[],
  targetKm: number
): RaceQualityEffort | null {
  const maxKm = Math.min(30, Math.max(15, targetKm * 1.08));
  const c = efforts.filter(
    (e) => e.distanceKm >= 4 && e.distanceKm <= maxKm
  );
  if (c.length === 0) return efforts[0] ?? null;
  return [...c].sort((a, b) => a.timeSec / a.distanceKm - b.timeSec / b.distanceKm)[0];
}

function predictRiegel(
  anchor: RaceQualityEffort,
  targetM: number
): number {
  return predictRaceTime(
    anchor.distanceKm * 1000,
    anchor.timeSec,
    targetM
  );
}

function predictPowerLaw(
  efforts: RaceQualityEffort[],
  targetKm: number
): { timeSec: number; r2: number; n: number } | null {
  const reg = fitPowerLawRegression(efforts.map(effortToPoint));
  if (!reg) return null;
  return {
    timeSec: reg.coefficient * Math.pow(targetKm, reg.exponent),
    r2: reg.rSquared,
    n: reg.pointCount,
  };
}

function predictMultiEffort(
  efforts: RaceQualityEffort[],
  targetM: number,
  targetKm: number
): number | null {
  const maxKm = Math.min(30, Math.max(21, targetKm * 1.08));
  const anchors = [...efforts]
    .filter((e) => e.distanceKm >= 4 && e.distanceKm <= maxKm)
    .sort((a, b) => a.timeSec / a.distanceKm - b.timeSec / b.distanceKm)
    .slice(0, 3);
  if (anchors.length === 0) return null;
  const times = anchors.map((a) => predictRiegel(a, targetM));
  return times.reduce((s, t) => s + t, 0) / times.length;
}

function predictRecentBestAnchor(
  efforts: RaceQualityEffort[],
  targetM: number,
  targetKm: number
): { timeSec: number; anchor: RaceQualityEffort } | null {
  let best: { e: RaceQualityEffort; w: number } | null = null;
  for (const e of efforts) {
    const w =
      recencyWeight(e.date) *
      distanceRelevanceWeight(e.distanceKm, targetKm) *
      (e.hasHr ? 1.1 : 1) *
      (e.isRaceLike ? 1.15 : 1);
    if (!best || w > best.w) best = { e, w };
  }
  if (!best) return null;
  return {
    timeSec: predictRiegel(best.e, targetM),
    anchor: best.e,
  };
}

export function buildCapabilityModelEstimates(
  input: RaceForecastInput
): ForecastModelEstimate[] {
  const { efforts, goal } = input;
  const targetM = goal.distanceMeters;
  const targetKm = targetM / 1000;
  const estimates: ForecastModelEstimate[] = [];

  if (efforts.length === 0) return estimates;

  const anchor = pickBestAnchor(efforts, targetKm);
  if (anchor) {
    estimates.push({
      modelName: "Riegel (1981)",
      predictedTimeSec: Math.round(predictRiegel(anchor, targetM)),
      confidence: 0.72,
      weight: 0,
      anchorEfforts: [`${anchor.runName} (${anchor.distanceKm.toFixed(1)} km)`],
      assumptions: ["Classic endurance scaling exponent 1.06"],
      limitations: ["Single-anchor extrapolation"],
    });
  }

  const pl = predictPowerLaw(efforts, targetKm);
  if (pl && pl.r2 >= 0.35) {
    const confidence = Math.max(
      0.4,
      Math.min(0.92, 0.55 + pl.r2 * 0.35)
    );
    estimates.push({
      modelName: "Personalized power-law",
      predictedTimeSec: Math.round(pl.timeSec),
      confidence,
      weight: 0,
      anchorEfforts: [`${pl.n} efforts fitted`],
      assumptions: [`R²=${pl.r2.toFixed(2)} log-log fit`],
      limitations: pl.n < 4 ? ["Few efforts for curve fit"] : [],
    });
  }

  const multi = predictMultiEffort(efforts, targetM, targetKm);
  if (multi != null) {
    estimates.push({
      modelName: "Multi-effort average",
      predictedTimeSec: Math.round(multi),
      confidence: 0.7,
      weight: 0,
      anchorEfforts: ["Top 3 efforts by pace (4–21 km)"],
      assumptions: ["Mean Riegel from fastest efforts"],
      limitations: [],
    });
  }

  const recent = predictRecentBestAnchor(efforts, targetM, targetKm);
  if (recent) {
    estimates.push({
      modelName: "Recent best-effort anchor",
      predictedTimeSec: Math.round(recent.timeSec),
      confidence: 0.74,
      weight: 0,
      anchorEfforts: [recent.anchor.runName],
      assumptions: ["Weighted by recency and distance relevance"],
      limitations: [],
    });
  }

  return estimates;
}

/** Assign weights and compute weighted capability time */
export function computeWeightedCapability(
  input: RaceForecastInput,
  estimates: ForecastModelEstimate[]
): {
  baseTimeSec: number;
  weightedEstimates: ForecastModelEstimate[];
  spreadSec: number;
} {
  const targetKm = input.goal.distanceMeters / 1000;
  const anchor = pickBestAnchor(input.efforts, targetKm);

  const modelTimes = estimates
    .map((e) => e.predictedTimeSec)
    .filter((t) => t > 0);
  const spreadSec =
    modelTimes.length >= 2
      ? Math.max(...modelTimes) - Math.min(...modelTimes)
      : 0;

  const withWeights = estimates.map((est) => {
    let w = Math.max(0.1, est.confidence);
    if (est.modelName.includes("power-law") && est.confidence >= 0.75) {
      w *= 1.15;
    }
    if (est.modelName.includes("Riegel") && targetKm < 15) {
      w *= 1.05;
    }
    if (anchor && est.anchorEfforts.some((a) => a.includes(anchor.runName))) {
      const rel = distanceRelevanceWeight(anchor.distanceKm, targetKm);
      w *= 0.85 + rel * 0.3;
    }
    if (input.efforts.length < 3) w *= 0.7;
    return { ...est, weight: w };
  });

  const positive = withWeights.filter((e) => e.weight > 0);
  const totalW = positive.reduce((s, e) => s + e.weight, 0);

  if (totalW <= 0 || positive.length === 0) {
    const fallback =
      pickBestAnchor(input.efforts, targetKm) ?? input.efforts[0];
    const baseTimeSec = fallback
      ? Math.round(predictRiegel(fallback, input.goal.distanceMeters))
      : 0;
    const normalized = withWeights.map((e) => ({ ...e, weight: 0 }));
    return { baseTimeSec, weightedEstimates: normalized, spreadSec };
  }

  const baseTimeSec = Math.round(
    positive.reduce(
      (s, e) => s + e.predictedTimeSec * (e.weight / totalW),
      0
    )
  );

  const normalized = withWeights.map((e) => ({
    ...e,
    weight:
      e.weight > 0
        ? Math.round((e.weight / totalW) * 1000) / 1000
        : 0,
  }));

  return { baseTimeSec, weightedEstimates: normalized, spreadSec };
}

/** Build efforts from runs + optional fit (for adapter) */
export function effortsFromRuns(
  runs: RunActivity[],
  fitDetails: FitRunDetail[] = []
): RaceQualityEffort[] {
  const prs = findPersonalRecords(runs, fitDetails);
  return collectEffortPoints(runs, fitDetails, prs).map((e) => ({
    ...e,
    hasHr: !!runs.find((r) => r.id === e.runId)?.avgHr,
    isRaceLike:
      e.distanceKm >= 4 &&
      e.distanceKm <= 22 &&
      (e.source.includes("Lap") || e.source.includes("Best")),
  }));
}
