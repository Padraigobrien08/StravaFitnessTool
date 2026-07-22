import { computeAllBestEfforts } from "@/lib/analytics/bestEfforts";
import { downsample, MAX_GPS_POINTS, MAX_STREAM_POINTS } from "@/lib/strava/downsample";
import type { FitLap, FitRunDetail, GpsPoint } from "@/lib/strava/fitTypes";
import type { StravaLap, StravaStreamSet } from "./types";

function speedToPaceSecPerKm(speedMps: number): number | null {
  if (!Number.isFinite(speedMps) || speedMps <= 0.3) return null;
  return 1000 / speedMps;
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

export function mapStravaLaps(laps: StravaLap[]): FitLap[] {
  return laps.map((lap) => ({
    index: lap.lap_index,
    distanceM: lap.distance ?? null,
    timeSec: lap.elapsed_time ?? lap.moving_time ?? null,
    avgHr: lap.average_heartrate ?? null,
    avgPaceSecPerKm: lap.average_speed != null ? speedToPaceSecPerKm(lap.average_speed) : null,
    avgCadence: lap.average_cadence ?? null,
  }));
}

export function mapStravaStreamsToFitDetail(
  activityId: string,
  streams: StravaStreamSet | null,
  laps: StravaLap[],
): FitRunDetail | null {
  const time = streams?.time?.data;
  if (!time?.length) {
    const lapOnly = mapStravaLaps(laps);
    if (lapOnly.length === 0) return null;
    return {
      activityId,
      bestEfforts: computeAllBestEfforts([], lapOnly),
      laps: lapOnly,
      hrStream: [],
      paceStream: [],
      cadenceStream: [],
      gpsStream: [],
      hrDriftPct: null,
      avgCadence: (() => {
        const withCad = lapOnly.filter((l) => l.avgCadence != null);
        if (withCad.length === 0) return null;
        return Math.round(withCad.reduce((s, l) => s + (l.avgCadence ?? 0), 0) / withCad.length);
      })(),
    };
  }

  const hrData = streams?.heartrate?.data ?? [];
  const velData = streams?.velocity_smooth?.data ?? [];
  const cadData = streams?.cadence?.data ?? [];
  const altData = streams?.altitude?.data ?? [];
  const latlngRaw = streams?.latlng?.data as [number, number][] | number[] | undefined;

  const hrStream: { elapsedSec: number; hr: number }[] = [];
  const paceStream: { elapsedSec: number; paceSecPerKm: number }[] = [];
  const cadenceStream: { elapsedSec: number; cadence: number }[] = [];
  const gpsStream: GpsPoint[] = [];
  let cadenceSum = 0;
  let cadenceCount = 0;

  for (let i = 0; i < time.length; i++) {
    const elapsedSec = time[i];
    const hr = hrData[i];
    if (hr !== undefined && hr > 0) {
      hrStream.push({ elapsedSec, hr });
    }
    const speed = velData[i];
    if (speed !== undefined) {
      const pace = speedToPaceSecPerKm(speed);
      if (pace !== null) {
        paceStream.push({ elapsedSec, paceSecPerKm: pace });
      }
    }
    const cadence = cadData[i];
    if (cadence !== undefined && cadence > 0) {
      cadenceStream.push({ elapsedSec, cadence });
      cadenceSum += cadence;
      cadenceCount += 1;
    }

    let lat: number | undefined;
    let lon: number | undefined;
    if (Array.isArray(latlngRaw?.[0])) {
      const pair = (latlngRaw as [number, number][])[i];
      if (pair) {
        lat = pair[0];
        lon = pair[1];
      }
    } else if (latlngRaw && latlngRaw.length >= (i + 1) * 2) {
      lat = (latlngRaw as number[])[i * 2];
      lon = (latlngRaw as number[])[i * 2 + 1];
    }
    if (lat != null && lon != null && Math.abs(lat) <= 90) {
      gpsStream.push({
        elapsedSec,
        lat,
        lon,
        elevationM: altData[i] ?? null,
      });
    }
  }

  const fitLaps = mapStravaLaps(laps);
  const bestEfforts = computeAllBestEfforts(paceStream, fitLaps);

  return {
    activityId,
    bestEfforts,
    laps: fitLaps,
    hrStream: downsample(hrStream, MAX_STREAM_POINTS),
    paceStream: downsample(paceStream, MAX_STREAM_POINTS),
    cadenceStream: downsample(cadenceStream, MAX_STREAM_POINTS),
    gpsStream: downsample(gpsStream, MAX_GPS_POINTS),
    hrDriftPct: computeHrDrift(hrStream),
    avgCadence: cadenceCount > 0 ? Math.round(cadenceSum / cadenceCount) : null,
  };
}
