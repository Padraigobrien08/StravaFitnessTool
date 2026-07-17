import type { Goal, RunActivity, StravaImport } from "@/lib/strava/types";

/** Merge two imports: overlay runs replace base on same id; unique runs from both are kept. */
export function mergeStravaImports(
  base: StravaImport | null,
  overlay: StravaImport | null
): StravaImport | null {
  if (!base) return overlay;
  if (!overlay) return base;

  const runsById = new Map<string, RunActivity>(
    base.runs.map((r) => [r.id, r])
  );
  for (const run of overlay.runs) {
    runsById.set(run.id, run);
  }

  const activitiesById = new Map(
    base.allActivities.map((a) => [a.id, a])
  );
  for (const a of overlay.allActivities) {
    activitiesById.set(a.id, a);
  }

  const goalsKey = (g: Goal) =>
    `${g.type}|${g.activityType}|${g.target}|${g.startDate}|${g.timePeriod}`;
  const goalsByKey = new Map<string, Goal>();
  for (const g of [...base.goals, ...overlay.goals]) {
    goalsByKey.set(goalsKey(g), g);
  }

  const fitRunIds = Array.from(
    new Set([...(base.fitRunIds ?? []), ...(overlay.fitRunIds ?? [])])
  );

  const profile = {
    ...base.profile,
    maxHeartRate:
      overlay.profile.maxHeartRate ?? base.profile.maxHeartRate,
    athleteType:
      overlay.profile.athleteType ?? base.profile.athleteType,
    ftp: overlay.profile.ftp ?? base.profile.ftp,
    measurementPreference:
      overlay.profile.measurementPreference ??
      base.profile.measurementPreference,
  };

  return {
    runs: Array.from(runsById.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ),
    profile,
    goals: Array.from(goalsByKey.values()),
    allActivities: Array.from(activitiesById.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ),
    importedAt:
      new Date(overlay.importedAt) > new Date(base.importedAt)
        ? overlay.importedAt
        : base.importedAt,
    exportLabel: mergeExportLabels(base.exportLabel, overlay.exportLabel),
    fitRunIds,
  };
}

function mergeExportLabels(
  a?: string,
  b?: string
): string | undefined {
  if (!a?.trim()) return b?.trim() || undefined;
  if (!b?.trim()) return a.trim();
  const left = a.trim();
  const right = b.trim();
  if (left === right || left.includes(right) || right.includes(left)) {
    return left;
  }
  return `${left} + ${right}`;
}

export function enrichImportWithFitDetails(
  data: StravaImport,
  fitDetails: { activityId: string }[]
): StravaImport {
  const fitRunIds = Array.from(
    new Set([
      ...(data.fitRunIds ?? []),
      ...fitDetails.map((f) => f.activityId),
    ])
  );
  return { ...data, fitRunIds };
}

export interface DataSources {
  localExport: boolean;
  stravaApi: boolean;
  /** Synthetic sample athlete loaded via "Try the demo". */
  demo?: boolean;
}

export function buildDataSourceLabel(sources: DataSources): string | null {
  if (sources.demo) return "Demo data";
  if (!sources.localExport && !sources.stravaApi) return null;
  if (sources.localExport && sources.stravaApi) return "Export + Strava API";
  if (sources.stravaApi) return "Strava API";
  return "Local export";
}
