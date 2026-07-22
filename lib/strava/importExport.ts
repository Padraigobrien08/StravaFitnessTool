import { filterRuns, parseActivitiesCsv } from "./parseActivities";
import { parseGoalsCsv } from "./parseGoals";
import { parsePreferencesCsv } from "./parsePreferences";
import { parseFitFilesFromUpload } from "./parseFit";
import type { StravaImport } from "./types";
import { saveFitDetails, clearFitDetails } from "@/lib/storage/fit-db";

async function readFileAsText(file: File): Promise<string> {
  return file.text();
}

function findFile(files: File[], name: string): File | undefined {
  return files.find((f) => {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    const base = path ? path.split("/").pop() : f.name;
    return base === name || f.name === name;
  });
}

function countFitFiles(files: File[]): number {
  return files.filter((f) => {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? f.name;
    return /\.fit(\.gz)?$/i.test(path);
  }).length;
}

export interface ImportResult {
  data: StravaImport;
  fitParsed: number;
  fitAvailable: number;
}

export async function importFromFiles(
  files: File[],
  exportLabel?: string,
  onFitProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const activitiesFile = findFile(files, "activities.csv");
  if (!activitiesFile) {
    throw new Error("activities.csv not found. Upload your full Strava export folder.");
  }

  const activitiesText = await readFileAsText(activitiesFile);
  const { runs, allActivities } = parseActivitiesCsv(activitiesText);
  const filteredRuns = filterRuns(runs);

  // Optional files: a corrupt preferences/goals CSV must not discard an
  // otherwise-valid activities import. Fall back to defaults on failure.
  const prefsFile = findFile(files, "general_preferences.csv");
  let profile: ReturnType<typeof parsePreferencesCsv> = {
    maxHeartRate: null,
    athleteType: null,
    ftp: null,
    measurementPreference: null,
  };
  if (prefsFile) {
    try {
      profile = parsePreferencesCsv(await readFileAsText(prefsFile));
    } catch (err) {
      console.error("Skipping unreadable general_preferences.csv:", err);
    }
  }

  const goalsFile = findFile(files, "goals.csv");
  let goals: ReturnType<typeof parseGoalsCsv> = [];
  if (goalsFile) {
    try {
      goals = parseGoalsCsv(await readFileAsText(goalsFile));
    } catch (err) {
      console.error("Skipping unreadable goals.csv:", err);
    }
  }

  const fitFilenameById = new Map<string, string>();
  for (const run of filteredRuns) {
    if (run.fitFilename) fitFilenameById.set(run.id, run.fitFilename);
  }

  const fitAvailable = countFitFiles(files);
  let fitRunIds: string[] = [];

  if (fitAvailable > 0 && fitFilenameById.size > 0) {
    await clearFitDetails();
    const { details: fitDetails } = await parseFitFilesFromUpload(
      files,
      fitFilenameById,
      onFitProgress,
    );
    if (fitDetails.length > 0) {
      await saveFitDetails(fitDetails);
      fitRunIds = fitDetails.map((d) => d.activityId);
    }
  }

  const data: StravaImport = {
    runs: filteredRuns,
    profile,
    goals,
    allActivities,
    importedAt: new Date().toISOString(),
    exportLabel,
    fitRunIds,
  };

  return { data, fitParsed: fitRunIds.length, fitAvailable };
}

export function validateExportFiles(files: File[]): string | null {
  if (!findFile(files, "activities.csv")) {
    return "Missing activities.csv";
  }
  return null;
}
