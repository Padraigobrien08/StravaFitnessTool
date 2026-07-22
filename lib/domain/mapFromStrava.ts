import type { StravaImport } from "@/lib/strava/types";
import type { RunActivity as StravaRun } from "@/lib/strava/types";
import type {
  ActivitySummary,
  RunActivity,
  SportType,
  TrainingDataset,
  WeeklyGoal,
} from "./activity";
import { paceSecPerKm } from "@/lib/analytics/pace";

function toSport(type: string): SportType {
  if (type === "Run") return "Run";
  if (type === "Ride") return "Ride";
  if (type === "Walk") return "Walk";
  if (type === "Weight Training") return "Weight Training";
  return "Other";
}

export function mapRunFromStrava(run: StravaRun, fitRunIds: string[]): RunActivity {
  const pace = paceSecPerKm({
    ...run,
    distanceM: run.distanceM,
    movingSec: run.movingSec,
    elapsedSec: run.elapsedSec,
  });

  return {
    id: run.id,
    date: run.date,
    name: run.name,
    distanceKm: run.distanceM / 1000,
    movingTimeSec: run.movingSec,
    elapsedTimeSec: run.elapsedSec,
    paceSecPerKm: pace,
    avgHeartRate: run.avgHr ?? undefined,
    maxHeartRate: run.maxHr ?? undefined,
    elevationGainM: run.elevationGainM ?? undefined,
    trainingLoad: run.trainingLoad ?? undefined,
    relativeEffort: run.relativeEffort ?? undefined,
    avgCadence: run.avgCadence ?? undefined,
    calories: run.calories ?? undefined,
    weatherTempC: run.weatherTempC ?? undefined,
    description: run.description,
    fitFilename: run.fitFilename,
    hasFitStream: fitRunIds.includes(run.id),
  };
}

export function mapStravaImport(data: StravaImport): TrainingDataset {
  const fitRunIds = data.fitRunIds ?? [];
  return {
    runs: data.runs.map((r) => mapRunFromStrava(r, fitRunIds)),
    activities: data.allActivities.map((a): ActivitySummary => ({
      id: a.id,
      date: a.date,
      name: a.name,
      sport: toSport(a.type),
      distanceKm: a.distanceM / 1000,
      elapsedTimeSec: a.elapsedSec,
    })),
    profile: data.profile,
    goals: data.goals.map((g): WeeklyGoal => ({
      type: g.type,
      activityType: g.activityType,
      targetPerWeek: g.target,
      startDate: g.startDate,
      timePeriod: g.timePeriod,
    })),
    importedAt: data.importedAt,
    exportLabel: data.exportLabel,
    fitRunIds,
  };
}
