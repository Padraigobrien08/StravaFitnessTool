import { z } from "zod";

export const RunActivitySchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  distanceM: z.number(),
  elapsedSec: z.number(),
  movingSec: z.number(),
  avgSpeedMps: z.number().nullable(),
  maxSpeedMps: z.number().nullable(),
  avgHr: z.number().nullable(),
  maxHr: z.number().nullable(),
  elevationGainM: z.number().nullable(),
  calories: z.number().nullable(),
  relativeEffort: z.number().nullable(),
  trainingLoad: z.number().nullable(),
  gradeAdjustedPaceSecPerKm: z.number().nullable(),
  avgCadence: z.number().nullable(),
  totalSteps: z.number().nullable(),
  weatherTempC: z.number().nullable(),
  description: z.string().optional(),
  fitFilename: z.string().optional(),
});

export type RunActivity = z.infer<typeof RunActivitySchema>;

export const AthleteProfileSchema = z.object({
  maxHeartRate: z.number().nullable(),
  athleteType: z.string().nullable(),
  ftp: z.number().nullable(),
  measurementPreference: z.string().nullable(),
});

export type AthleteProfile = z.infer<typeof AthleteProfileSchema>;

export const GoalSchema = z.object({
  type: z.string(),
  activityType: z.string(),
  target: z.number(),
  startDate: z.string(),
  timePeriod: z.string(),
});

export type Goal = z.infer<typeof GoalSchema>;

export const ActivitySummarySchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  /** Canonical Strava API v3 sport_type */
  type: z.string(),
  distanceM: z.number(),
  elapsedSec: z.number(),
  movingSec: z.number().optional(),
  startDateLocal: z.string().optional(),
  avgHr: z.number().nullable().optional(),
  maxHr: z.number().nullable().optional(),
  calories: z.number().nullable().optional(),
  elevationGainM: z.number().nullable().optional(),
  avgCadence: z.number().nullable().optional(),
  avgWatts: z.number().nullable().optional(),
  trainer: z.boolean().optional(),
  commute: z.boolean().optional(),
  hasLaps: z.boolean().optional(),
});

export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;

export const StravaImportSchema = z.object({
  runs: z.array(RunActivitySchema),
  profile: AthleteProfileSchema,
  goals: z.array(GoalSchema),
  allActivities: z.array(ActivitySummarySchema),
  importedAt: z.string(),
  exportLabel: z.string().optional(),
  fitRunIds: z.array(z.string()).optional().default([]),
});

export type StravaImport = z.infer<typeof StravaImportSchema>;

export const InsightsPayloadSchema = z.object({
  import: StravaImportSchema,
  computedAt: z.string(),
});

export type InsightsPayload = z.infer<typeof InsightsPayloadSchema>;
