import type { StravaLap, StravaStreamSet } from "./types";

export interface VerboseStreamPoint {
  index: number;
  time_s?: number;
  heartrate_bpm?: number;
  speed_mps?: number;
  cadence?: number;
  altitude_m?: number;
  lat?: number;
  lng?: number;
  watts?: number;
}

export function verboseActivityStreams(
  streams: StravaStreamSet | null,
  laps?: StravaLap[],
): { points: VerboseStreamPoint[]; laps?: StravaLap[]; pointCount: number } {
  if (!streams) return { points: [], pointCount: 0, ...(laps?.length ? { laps } : {}) };

  const time = streams.time?.data as number[] | undefined;
  const len =
    time?.length ??
    Math.max(
      0,
      ...Object.values(streams).map((s) => (s?.data as unknown[] | undefined)?.length ?? 0),
    );

  const points: VerboseStreamPoint[] = [];
  for (let i = 0; i < len; i++) {
    const p: VerboseStreamPoint = { index: i };
    if (time?.[i] != null) p.time_s = time[i];
    const hr = streams.heartrate?.data as number[] | undefined;
    if (hr?.[i] != null) p.heartrate_bpm = hr[i];
    const vel = streams.velocity_smooth?.data as number[] | undefined;
    if (vel?.[i] != null) p.speed_mps = vel[i];
    const cad = streams.cadence?.data as number[] | undefined;
    if (cad?.[i] != null) p.cadence = cad[i];
    const alt = streams.altitude?.data as number[] | undefined;
    if (alt?.[i] != null) p.altitude_m = alt[i];
    const latlng = streams.latlng?.data as unknown as [number, number][] | undefined;
    if (latlng?.[i]) {
      p.lat = latlng[i][0];
      p.lng = latlng[i][1];
    }
    const watts = streams.watts?.data as number[] | undefined;
    if (watts?.[i] != null) p.watts = watts[i];
    points.push(p);
  }

  return {
    points,
    pointCount: points.length,
    ...(laps?.length ? { laps } : {}),
  };
}
