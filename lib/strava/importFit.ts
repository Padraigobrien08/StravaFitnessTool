import type { RunActivity, StravaImport } from "./types";
import { parseFitFilesFromUpload } from "./parseFit";
import { mergeFitDetails } from "@/lib/storage/fit-db";

export interface FitImportResult {
  parsed: number;
  matched: number;
  unmatched: number;
  fitRunIds: string[];
}

function buildFitFilenameMap(runs: RunActivity[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const run of runs) {
    if (run.fitFilename) map.set(run.id, run.fitFilename);
  }
  return map;
}

function countFitFilesInList(files: File[]): number {
  return files.filter((f) => {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? f.name;
    return /\.fit(\.gz)?$/i.test(path);
  }).length;
}

/** Add or refresh FIT data without re-importing activities.csv */
export async function importFitFilesOnly(
  files: File[],
  existing: StravaImport,
  onProgress?: (done: number, total: number) => void,
): Promise<FitImportResult> {
  const fitFilenameById = buildFitFilenameMap(existing.runs);
  if (fitFilenameById.size === 0) {
    throw new Error("No runs with FIT filenames in your CSV import.");
  }

  const fitAvailable = countFitFilesInList(files);
  if (fitAvailable === 0) {
    throw new Error(
      "No .fit or .fit.gz files found. Select the activities folder from your Strava archive.",
    );
  }

  const { details, matched, unmatched } = await parseFitFilesFromUpload(
    files,
    fitFilenameById,
    onProgress,
  );

  if (details.length === 0) {
    throw new Error(
      `Found ${fitAvailable} FIT file(s) but none matched your runs. Ensure filenames match activities.csv (e.g. activities/19543214110.fit.gz).`,
    );
  }

  // A storage failure leaves the run data intact and simply records no new stream
  // ids, rather than throwing away an import the athlete has already waited for.
  const stored = await mergeFitDetails(details);

  const fitRunIds = stored
    ? Array.from(new Set([...(existing.fitRunIds ?? []), ...details.map((d) => d.activityId)]))
    : (existing.fitRunIds ?? []);

  return {
    parsed: details.length,
    matched,
    unmatched,
    fitRunIds,
  };
}
