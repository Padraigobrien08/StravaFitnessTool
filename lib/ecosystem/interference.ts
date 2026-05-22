import { parseISO } from "date-fns";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { InterferenceFlag, NormalizedActivity } from "./types";
import { isQualityRun } from "./aggregates";
import { inWindow } from "./aggregates";

const MS_DAY = 86400000;
const MS_HOUR = 3600000;

function isInterferingActivity(a: NormalizedActivity): boolean {
  return (
    a.modality === "high_intensity_cross_training" ||
    a.modality === "sport" ||
    (a.modality === "strength" && a.perceivedIntensity !== "low")
  );
}

export function detectInterference(
  activities: NormalizedActivity[],
  windowHours = 48
): InterferenceFlag[] {
  const hardRuns = activities.filter(isQualityRun);
  const interferers = activities.filter(isInterferingActivity);
  const flags: InterferenceFlag[] = [];

  for (const nr of interferers) {
    const nrTime = parseISO(nr.startDate).getTime();
    for (const run of hardRuns) {
      const runTime = parseISO(run.startDate).getTime();
      const hours = Math.abs(nrTime - runTime) / MS_HOUR;
      if (hours > windowHours) continue;

      const severity =
        hours <= 24 && nr.perceivedIntensity === "high"
          ? "high"
          : hours <= 36
            ? "medium"
            : "low";

      flags.push({
        id: `if-${nr.id}-${run.id}`,
        severity,
        kind: "near_quality_run",
        nonRunActivityName: nr.name,
        nonRunSportType: nr.sportType,
        nonRunDate: nr.startDate,
        anchorRunName: run.name,
        anchorRunDate: run.startDate,
        hoursApart: Math.round(hours * 10) / 10,
        message:
          nrTime < runTime
            ? `${nr.sportType} may interfere with upcoming key run (${Math.round(hours)}h apart).`
            : `${nr.sportType} followed a key run within ${Math.round(hours)}h — recovery context may be compressed.`,
        evidence: [
          `Non-run: ${nr.sportType}, ${Math.round(nr.movingTimeSec / 60)} min, ${nr.perceivedIntensity} intensity`,
          `Run anchor: ${run.name}`,
          `Separation: ${Math.round(hours)} hours`,
        ],
        confidence: hours <= 24 ? "medium" : "low",
      });
    }
  }

  return flags.sort(
    (a, b) =>
      ({ high: 0, medium: 1, low: 2 }[a.severity] ?? 3) -
      ({ high: 0, medium: 1, low: 2 }[b.severity] ?? 3)
  );
}

export function detectWeeklyHighIntensityDensity(
  activities: NormalizedActivity[],
  maxPer7Days = 4
): InterferenceFlag[] {
  const recent = activities.filter((a) => inWindow(a.startDate, 7));
  const hi = recent.filter(
    (a) =>
      a.perceivedIntensity === "high" ||
      a.modality === "high_intensity_cross_training" ||
      (a.modality === "strength" && a.perceivedIntensity !== "low")
  );
  if (hi.length <= maxPer7Days) return [];
  return [
    {
      id: "weekly-hi-density",
      severity: hi.length >= maxPer7Days + 2 ? "high" : "medium",
      kind: "weekly_hi_density",
      nonRunActivityName: "Rolling 7-day block",
      nonRunSportType: "mixed",
      nonRunDate: recent[recent.length - 1]?.startDate ?? new Date().toISOString(),
      hoursApart: 0,
      message: `${hi.length} high-intensity sessions in 7 days may increase fatigue — recommendation confidence: medium.`,
      evidence: [
        `${hi.length} sessions at high perceived load (runs + HIIT + heavy strength)`,
        `Threshold context: >${maxPer7Days} hard sessions/week`,
      ],
      confidence: "medium",
    },
  ];
}

export function detectHybridLoadClusters(
  activities: NormalizedActivity[],
  clusterDays = 3
): InterferenceFlag[] {
  const sorted = [...activities]
    .filter(
      (a) =>
        isQualityRun(a) ||
        a.modality === "high_intensity_cross_training" ||
        (a.modality === "strength" && a.perceivedIntensity !== "low")
    )
    .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());

  const flags: InterferenceFlag[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cluster = [sorted[i]];
    const t0 = parseISO(sorted[i].startDate).getTime();
    for (let j = i + 1; j < sorted.length; j++) {
      const tj = parseISO(sorted[j].startDate).getTime();
      if ((tj - t0) / MS_DAY <= clusterDays) cluster.push(sorted[j]);
      else break;
    }
    const hasRun = cluster.some((a) => a.modality === "run");
    const hasHiit = cluster.some(
      (a) => a.modality === "high_intensity_cross_training"
    );
    const hasStrength = cluster.some((a) => a.modality === "strength");
    if (cluster.length >= 3 && hasRun && (hasHiit || hasStrength)) {
      flags.push({
        id: `cluster-${sorted[i].id}`,
        severity: "medium",
        kind: "hybrid_cluster",
        nonRunActivityName: "Intensity cluster",
        nonRunSportType: "mixed",
        nonRunDate: sorted[i].startDate,
        hoursApart: clusterDays * 24,
        message: `Hard run + HIIT/strength clustered within ${clusterDays} days — hybrid load concentration.`,
        evidence: cluster.map(
          (a) =>
            `${a.sportType}: ${a.name} (${a.perceivedIntensity})`
        ),
        confidence: "medium",
      });
      i += cluster.length - 1;
    }
  }
  return flags.slice(0, 3);
}

export function detectRaceWeekInterference(
  activities: NormalizedActivity[],
  raceGoal: RaceGoal | null
): InterferenceFlag[] {
  if (!raceGoal?.date) return [];
  const raceTime = parseISO(raceGoal.date).getTime();
  const now = Date.now();
  if (raceTime < now - MS_DAY || raceTime > now + 10 * MS_DAY) return [];

  const warnings: InterferenceFlag[] = [];
  for (const a of activities) {
    if (!inWindow(a.startDate, 10)) continue;
    const t = parseISO(a.startDate).getTime();
    const daysToRace = (raceTime - t) / MS_DAY;
    if (daysToRace < 0 || daysToRace > 7) continue;

    if (
      a.modality === "high_intensity_cross_training" ||
      (a.modality === "strength" && a.perceivedIntensity === "high") ||
      (a.modality === "sport" && a.perceivedIntensity !== "low")
    ) {
      warnings.push({
        id: `race-${a.id}`,
        severity: daysToRace <= 2 ? "high" : "medium",
        kind: "race_week",
        nonRunActivityName: a.name,
        nonRunSportType: a.sportType,
        nonRunDate: a.startDate,
        hoursApart: Math.round(daysToRace * 24),
        message:
          daysToRace <= 2
            ? `High-load ${a.sportType} within ${Math.round(daysToRace)}d of race — may increase fatigue before race day.`
            : `${a.sportType} in race week — monitor stacking with taper runs.`,
        evidence: [
          `Race date: ${raceGoal.date}`,
          `Activity ${Math.round(daysToRace)}d before race`,
        ],
        confidence: "medium",
      });
    }
  }
  return warnings;
}

export function collectInterferenceFlags(
  activities: NormalizedActivity[],
  raceGoal: RaceGoal | null
): InterferenceFlag[] {
  return [
    ...detectInterference(activities, 48),
    ...detectWeeklyHighIntensityDensity(activities),
    ...detectHybridLoadClusters(activities),
    ...detectRaceWeekInterference(activities, raceGoal),
  ];
}
