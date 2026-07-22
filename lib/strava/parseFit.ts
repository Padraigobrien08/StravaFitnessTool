import FitParser from "fit-file-parser";
import { inflate } from "pako";
import { computeAllBestEfforts } from "@/lib/analytics/bestEfforts";
import { downsample, MAX_GPS_POINTS, MAX_STREAM_POINTS } from "@/lib/strava/downsample";
import type { FitLap, FitRunDetail, GpsPoint } from "./fitTypes";

export function decompressFitBuffer(buffer: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return inflate(bytes);
  }
  return bytes;
}

export function fitPathBasename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function matchFitFileToActivityId(
  fitPath: string,
  fitFilenameById: Map<string, string>,
): string | null {
  const base = fitPathBasename(fitPath).toLowerCase();
  for (const [activityId, filename] of fitFilenameById) {
    const runBase = fitPathBasename(filename).toLowerCase();
    if (base === runBase || base.replace(".gz", "") === runBase.replace(".gz", "")) {
      return activityId;
    }
  }
  const idMatch = base.match(/^(\d+)\.fit/);
  if (idMatch) {
    for (const [activityId, filename] of fitFilenameById) {
      if (filename.includes(idMatch[1])) return activityId;
    }
  }
  return null;
}

function parseFitBuffer(bytes: Uint8Array): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: "m/s",
      lengthUnit: "m",
      temperatureUnit: "celsius",
      elapsedRecordField: true,
      // "list" exposes records + laps; "cascade" leaves them empty for Strava exports
      mode: "list",
    });
    parser.parse(bytes, (err: Error | undefined, data: Record<string, unknown>) => {
      if (err) reject(err);
      else resolve(data ?? {});
    });
  });
}

function speedToPaceSecPerKm(speedMps: number): number | null {
  if (!Number.isFinite(speedMps) || speedMps <= 0.3) return null;
  return 1000 / speedMps;
}

const SEMICIRCLE_TO_DEG = 180 / Math.pow(2, 31);

function semicirclesToDegrees(v: number): number {
  return v * SEMICIRCLE_TO_DEG;
}

function computeHrDrift(hrStream: { elapsedSec: number; hr: number }[]): number | null {
  if (hrStream.length < 10) return null;
  const mid = hrStream[Math.floor(hrStream.length / 2)].elapsedSec;
  const first = hrStream.filter((p) => p.elapsedSec <= mid);
  const second = hrStream.filter((p) => p.elapsedSec > mid);
  if (first.length < 3 || second.length < 3) return null;
  const avg1 = first.reduce((s, p) => s + p.hr, 0) / first.length;
  const avg2 = second.reduce((s, p) => s + p.hr, 0) / second.length;
  if (avg1 <= 0) return null;
  return Math.round(((avg2 - avg1) / avg1) * 1000) / 10;
}

export async function parseFitFile(buffer: ArrayBuffer, activityId: string): Promise<FitRunDetail> {
  const bytes = decompressFitBuffer(buffer);
  const data = await parseFitBuffer(bytes);

  const records = (data.records as Record<string, unknown>[]) ?? [];
  const lapsRaw = (data.laps as Record<string, unknown>[]) ?? [];

  let startTs: number | null = null;
  const hrStream: { elapsedSec: number; hr: number }[] = [];
  const paceStream: { elapsedSec: number; paceSecPerKm: number }[] = [];
  const cadenceStream: { elapsedSec: number; cadence: number }[] = [];
  const gpsStream: GpsPoint[] = [];
  let cadenceSum = 0;
  let cadenceCount = 0;

  for (const rec of records) {
    const ts = rec.timestamp as number | undefined;
    if (ts !== undefined && startTs === null) startTs = ts;
    const elapsed =
      typeof rec.elapsed_time === "number"
        ? rec.elapsed_time
        : startTs && ts
          ? ts - startTs
          : hrStream.length;

    const hr = rec.heart_rate as number | undefined;
    if (hr !== undefined && hr > 0) {
      hrStream.push({ elapsedSec: elapsed, hr });
    }

    const speed = (rec.enhanced_speed as number | undefined) ?? (rec.speed as number | undefined);
    const pace = speed !== undefined ? speedToPaceSecPerKm(speed) : null;
    if (pace !== null) {
      paceStream.push({ elapsedSec: elapsed, paceSecPerKm: pace });
    }

    const cadence = rec.cadence as number | undefined;
    if (cadence !== undefined && cadence > 0) {
      cadenceStream.push({ elapsedSec: elapsed, cadence });
      cadenceSum += cadence;
      cadenceCount += 1;
    }

    const latRaw =
      (rec.position_lat as number | undefined) ?? (rec.enhanced_latitude as number | undefined);
    const lonRaw =
      (rec.position_long as number | undefined) ?? (rec.enhanced_longitude as number | undefined);
    if (latRaw != null && lonRaw != null) {
      const lat = Math.abs(latRaw) > 90 ? semicirclesToDegrees(latRaw) : latRaw;
      const lon = Math.abs(lonRaw) > 180 ? semicirclesToDegrees(lonRaw) : lonRaw;
      const alt =
        (rec.altitude as number | undefined) ?? (rec.enhanced_altitude as number | undefined);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        gpsStream.push({
          elapsedSec: elapsed,
          lat,
          lon,
          elevationM: alt ?? null,
        });
      }
    }
  }

  const laps: FitLap[] = lapsRaw.map((lap, index) => {
    const dist = lap.total_distance as number | undefined;
    const time =
      (lap.total_timer_time as number | undefined) ??
      (lap.total_elapsed_time as number | undefined);
    const avgHr = lap.avg_heart_rate as number | undefined;
    const avgSpeed =
      (lap.enhanced_avg_speed as number | undefined) ?? (lap.avg_speed as number | undefined);
    return {
      index: index + 1,
      distanceM: dist ?? null,
      timeSec: time ?? null,
      avgHr: avgHr ?? null,
      avgPaceSecPerKm: avgSpeed ? speedToPaceSecPerKm(avgSpeed) : null,
      avgCadence: (lap.avg_cadence as number | undefined) ?? null,
    };
  });

  const bestEfforts = computeAllBestEfforts(paceStream, laps);

  const hrDown = downsample(hrStream, MAX_STREAM_POINTS);
  const paceDown = downsample(paceStream, MAX_STREAM_POINTS);
  const cadDown = downsample(cadenceStream, MAX_STREAM_POINTS);
  const gpsDown = downsample(gpsStream, MAX_GPS_POINTS);

  return {
    activityId,
    bestEfforts,
    laps,
    hrStream: hrDown,
    paceStream: paceDown,
    cadenceStream: cadDown,
    gpsStream: gpsDown,
    hrDriftPct: computeHrDrift(hrStream),
    avgCadence: cadenceCount > 0 ? Math.round(cadenceSum / cadenceCount) : null,
  };
}

export interface FitParseBatchResult {
  details: FitRunDetail[];
  matched: number;
  unmatched: number;
}

export async function parseFitFilesFromUpload(
  files: File[],
  fitFilenameById: Map<string, string>,
  onProgress?: (done: number, total: number) => void,
): Promise<FitParseBatchResult> {
  const fitFiles = files.filter((f) => {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? f.name;
    return /\.fit(\.gz)?$/i.test(path);
  });

  const matched: { file: File; activityId: string }[] = [];
  let unmatched = 0;
  for (const file of fitFiles) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
    const activityId = matchFitFileToActivityId(path, fitFilenameById);
    if (activityId) matched.push({ file, activityId });
    else unmatched += 1;
  }

  const results: FitRunDetail[] = [];
  let done = 0;
  const total = matched.length;

  for (const { file, activityId } of matched) {
    try {
      const buffer = await file.arrayBuffer();
      const detail = await parseFitFile(buffer, activityId);
      results.push(detail);
    } catch {
      // skip unparseable files
    }
    done += 1;
    onProgress?.(done, total);
  }

  return { details: results, matched: matched.length, unmatched };
}
