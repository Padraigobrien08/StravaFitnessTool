import type { NormalizedActivity } from "../types";

function act(
  partial: Partial<NormalizedActivity> &
    Pick<NormalizedActivity, "id" | "sportType" | "modality" | "startDate">,
): NormalizedActivity {
  return {
    source: "strava_api",
    name: partial.name ?? partial.sportType,
    movingTimeSec: partial.movingTimeSec ?? 3600,
    elapsedTimeSec: partial.elapsedTimeSec ?? 3700,
    perceivedIntensity: partial.perceivedIntensity ?? "moderate",
    intensity: partial.intensity ?? {
      level: partial.perceivedIntensity ?? "moderate",
      confidence: "medium",
      evidence: [],
    },
    hasStreams: false,
    hasLaps: false,
    confidence: "medium",
    ...partial,
  };
}

/** Mostly runs */
export const pureRunner: NormalizedActivity[] = Array.from({ length: 12 }, (_, i) =>
  act({
    id: `run-${i}`,
    sportType: "Run",
    modality: "run",
    startDate: new Date(Date.now() - i * 3 * 86400000).toISOString(),
    isHardRun: i % 4 === 0,
    perceivedIntensity: i % 4 === 0 ? "high" : "low",
  }),
);

/** Run + strength + HIIT */
export const hybridRunner: NormalizedActivity[] = [
  ...pureRunner.slice(0, 8),
  act({
    id: "wt-1",
    sportType: "WeightTraining",
    modality: "strength",
    startDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    perceivedIntensity: "moderate",
  }),
  act({
    id: "hiit-1",
    sportType: "Crossfit",
    modality: "high_intensity_cross_training",
    startDate: new Date(Date.now() - 1 * 86400000).toISOString(),
    perceivedIntensity: "high",
  }),
];

/** Run + bike + swim */
export const triathlete: NormalizedActivity[] = [
  ...pureRunner.slice(0, 6),
  act({
    id: "ride-1",
    sportType: "Ride",
    modality: "bike",
    startDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    movingTimeSec: 4500,
    perceivedIntensity: "moderate",
  }),
  act({
    id: "ride-2",
    sportType: "VirtualRide",
    modality: "bike",
    startDate: new Date(Date.now() - 8 * 86400000).toISOString(),
    movingTimeSec: 3600,
  }),
  act({
    id: "swim-1",
    sportType: "Swim",
    modality: "swim",
    startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    movingTimeSec: 2400,
  }),
  act({
    id: "swim-2",
    sportType: "Swim",
    modality: "swim",
    startDate: new Date(Date.now() - 10 * 86400000).toISOString(),
    movingTimeSec: 3000,
  }),
];

export const strengthHeavy: NormalizedActivity[] = [
  ...pureRunner.slice(0, 4),
  ...Array.from({ length: 6 }, (_, i) =>
    act({
      id: `str-${i}`,
      sportType: "WeightTraining",
      modality: "strength",
      startDate: new Date(Date.now() - i * 2 * 86400000).toISOString(),
      perceivedIntensity: i % 2 === 0 ? "high" : "moderate",
    }),
  ),
  act({
    id: "hiit-s",
    sportType: "HighIntensityIntervalTraining",
    modality: "high_intensity_cross_training",
    startDate: new Date(Date.now() - 86400000).toISOString(),
    perceivedIntensity: "high",
  }),
];

export const lowDataUser: NormalizedActivity[] = pureRunner.slice(0, 2);

export const unknownSports: NormalizedActivity[] = [
  ...pureRunner.slice(0, 3),
  act({
    id: "unk-1",
    sportType: "ObstacleCourse",
    modality: "unknown",
    startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
  }),
];
