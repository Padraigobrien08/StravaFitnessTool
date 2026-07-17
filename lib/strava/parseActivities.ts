import { parseNum } from "@/lib/utils";
import { pickField, parseCsvRows } from "./parseCsv";
import type { ActivitySummary, RunActivity } from "./types";

/**
 * Returns an ISO date string, or null if the cell is empty/unparseable.
 * Returning null (rather than the raw string) is critical: a garbage date
 * that reaches analytics makes date-fns `format(parseISO(...))` throw
 * "Invalid time value" inside a render path above the error boundary, which
 * white-screens the entire app. Rows with a null date are dropped downstream.
 */
function parseStravaDate(raw: string): string | null {
  const cleaned = raw.replace(/^"|"$/g, "").trim();
  if (!cleaned) return null;
  const d = new Date(cleaned);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

function distanceMeters(row: Record<string, string>): number {
  const detailed = parseNum(pickField(row, "Distance"));
  const summary = parseNum(row["Distance"]);
  if (detailed !== null && detailed > 100) return detailed;
  if (summary !== null && summary > 0) return summary * 1000;
  if (detailed !== null) return detailed;
  return 0;
}

function elapsedSeconds(row: Record<string, string>): number {
  return (
    parseNum(pickField(row, "Elapsed Time")) ??
    parseNum(row["Elapsed Time"]) ??
    0
  );
}

function movingSeconds(row: Record<string, string>): number {
  return (
    parseNum(pickField(row, "Moving Time")) ??
    parseNum(row["Moving Time"]) ??
    elapsedSeconds(row)
  );
}

export function parseActivitiesCsv(csvText: string): {
  runs: RunActivity[];
  allActivities: ActivitySummary[];
} {
  const rows = parseCsvRows(csvText);
  const runs: RunActivity[] = [];
  const allActivities: ActivitySummary[] = [];

  for (const row of rows) {
    const type = row["Activity Type"]?.trim() ?? "";
    const id = row["Activity ID"]?.trim();
    if (!id) continue;

    // Drop rows with a missing/unparseable date entirely — every downstream
    // analytic keys off the date, and an invalid one crashes rendering.
    const date = parseStravaDate(row["Activity Date"] ?? "");
    if (!date) continue;

    const distanceM = distanceMeters(row);
    const elapsedSec = elapsedSeconds(row);
    const movingSec = movingSeconds(row);

    const avgHr = parseNum(pickField(row, "Average Heart Rate"));
    const maxHr = parseNum(pickField(row, "Max Heart Rate"));

    allActivities.push({
      id,
      date,
      name: row["Activity Name"]?.trim() ?? "Untitled",
      type,
      distanceM,
      elapsedSec,
      movingSec,
      avgHr,
      maxHr,
      calories: parseNum(pickField(row, "Calories")),
      elevationGainM: parseNum(pickField(row, "Elevation Gain")),
    });

    const runTypes = new Set(["Run", "Trail Run", "TrailRun", "Virtual Run"]);
    if (!runTypes.has(type)) continue;

    const gapRaw = pickField(row, "Average Grade Adjusted Pace");
    const gap = parseNum(gapRaw);

    runs.push({
      id,
      date,
      name: row["Activity Name"]?.trim() ?? "Untitled",
      distanceM,
      elapsedSec,
      movingSec,
      avgSpeedMps: parseNum(pickField(row, "Average Speed")),
      maxSpeedMps: parseNum(pickField(row, "Max Speed")),
      avgHr: parseNum(pickField(row, "Average Heart Rate")),
      maxHr: parseNum(pickField(row, "Max Heart Rate")),
      elevationGainM: parseNum(pickField(row, "Elevation Gain")),
      calories: parseNum(pickField(row, "Calories")),
      relativeEffort: parseNum(pickField(row, "Relative Effort")),
      trainingLoad: parseNum(pickField(row, "Training Load")),
      gradeAdjustedPaceSecPerKm:
        gap && gap > 0 ? gap : null,
      avgCadence: parseNum(pickField(row, "Average Cadence")),
      totalSteps: parseNum(pickField(row, "Total Steps")),
      weatherTempC: parseNum(row["Weather Temperature"]),
      description: row["Activity Description"]?.trim() || undefined,
      fitFilename: row["Filename"]?.trim() || undefined,
    });
  }

  runs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  allActivities.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return { runs, allActivities };
}

export function filterRuns(runs: RunActivity[]): RunActivity[] {
  return runs.filter(
    (r) => r.distanceM > 0 && !Number.isNaN(new Date(r.date).getTime())
  );
}
