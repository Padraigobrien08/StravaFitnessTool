import type { DashboardInsights } from "@/lib/analytics";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { buildRunCoachDetail } from "./buildRunCoachDetail";
import type { RunCoachDetail } from "./types";

const DEFAULT_LIMIT = 12;
const DEFAULT_WINDOW_DAYS = 42;

export function buildRecentSessionDetails(params: {
  runs: RunActivity[];
  fitDetails?: FitRunDetail[];
  analytics: DashboardInsights;
  limit?: number;
  windowDays?: number;
}): RunCoachDetail[] {
  const limit = params.limit ?? DEFAULT_LIMIT;
  const windowDays = params.windowDays ?? DEFAULT_WINDOW_DAYS;
  const cutoff = Date.now() - windowDays * 86400000;

  const fitById = new Map(
    (params.fitDetails ?? []).map((f) => [f.activityId, f])
  );

  const recent = [...params.runs]
    .filter((r) => new Date(r.date).getTime() >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  return recent.map((run) =>
    buildRunCoachDetail(
      run,
      fitById.get(run.id) ?? null,
      params.analytics,
      params.runs
    )
  );
}
