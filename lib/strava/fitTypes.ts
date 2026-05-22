import { z } from "zod";

export const FitLapSchema = z.object({
  index: z.number(),
  distanceM: z.number().nullable(),
  timeSec: z.number().nullable(),
  avgHr: z.number().nullable(),
  avgPaceSecPerKm: z.number().nullable(),
  avgCadence: z.number().nullable(),
});

export const FitStreamPointSchema = z.object({
  elapsedSec: z.number(),
  value: z.number(),
});

export const BestEffortSchema = z.object({
  key: z.string(),
  label: z.string(),
  distanceM: z.number(),
  timeSec: z.number(),
  paceSecPerKm: z.number(),
  startElapsedSec: z.number(),
  source: z.enum(["segment", "laps"]),
});

export const GpsPointSchema = z.object({
  elapsedSec: z.number(),
  lat: z.number(),
  lon: z.number(),
  elevationM: z.number().nullable().optional(),
});

export const FitRunDetailSchema = z.object({
  activityId: z.string(),
  bestEfforts: z.array(BestEffortSchema).optional().default([]),
  laps: z.array(FitLapSchema),
  hrStream: z.array(
    z.object({ elapsedSec: z.number(), hr: z.number() })
  ),
  paceStream: z.array(
    z.object({ elapsedSec: z.number(), paceSecPerKm: z.number() })
  ),
  cadenceStream: z.array(
    z.object({ elapsedSec: z.number(), cadence: z.number() })
  ),
  gpsStream: z.array(GpsPointSchema).optional().default([]),
  hrDriftPct: z.number().nullable(),
  avgCadence: z.number().nullable(),
});

export type GpsPoint = z.infer<typeof GpsPointSchema>;

export type FitLap = z.infer<typeof FitLapSchema>;
export type FitRunDetail = z.infer<typeof FitRunDetailSchema>;
