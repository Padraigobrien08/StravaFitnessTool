/** Normalized domain models — UI and analytics consume these, not raw Strava CSV shapes. */

export type SportType = "Run" | "Ride" | "Walk" | "Weight Training" | "Other";

export type RunActivity = {
  id: string;
  date: string;
  name: string;
  distanceKm: number;
  movingTimeSec: number;
  elapsedTimeSec: number;
  paceSecPerKm: number | null;
  avgHeartRate?: number;
  maxHeartRate?: number;
  elevationGainM?: number;
  trainingLoad?: number;
  relativeEffort?: number;
  avgCadence?: number;
  calories?: number;
  weatherTempC?: number;
  description?: string;
  fitFilename?: string;
  hasFitStream?: boolean;
};

export type ActivitySummary = {
  id: string;
  date: string;
  name: string;
  sport: SportType;
  distanceKm: number;
  elapsedTimeSec: number;
};

export type AthleteProfile = {
  maxHeartRate: number | null;
  athleteType: string | null;
  ftp: number | null;
  measurementPreference: string | null;
};

export type WeeklyGoal = {
  type: string;
  activityType: string;
  targetPerWeek: number;
  startDate: string;
  timePeriod: string;
};

export type TrainingDataset = {
  runs: RunActivity[];
  activities: ActivitySummary[];
  profile: AthleteProfile;
  goals: WeeklyGoal[];
  importedAt: string;
  exportLabel?: string;
  fitRunIds: string[];
};
