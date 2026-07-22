import type { TrainingBlock } from "@/lib/analytics/block";
import type { RaceForecastInput, RaceQualityEffort } from "../forecastTypes";
import type { ForecastFixtureProfile } from "./evaluationTypes";

const block = (
  label: string,
  distanceKm: number,
  longestRunKm: number,
  runCount = 4,
): TrainingBlock => ({
  weekStart: "2026-01-01",
  label,
  distanceKm,
  runCount,
  longestRunKm,
});

function eff(
  distanceKm: number,
  timeSec: number,
  runName: string,
  date: string,
  hasHr = false,
  isRaceLike = false,
): RaceQualityEffort {
  return {
    distanceKm,
    timeSec,
    runId: runName,
    runName,
    date,
    source: isRaceLike ? "Lap best" : "PR",
    hasHr,
    isRaceLike,
  };
}

export const lowDataRunnerInput: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [
    {
      distanceKm: 5.02,
      timeSec: 1320,
      runId: "1",
      runName: "Park 5K",
      date: "2026-04-01",
      source: "PR",
      hasHr: false,
    },
  ],
  recentBlocks: [block("Recent", 25, 8, 2)],
  goal: { distanceMeters: 21097, distanceKey: "hm" },
};

export const strong5kNoLongRunsInput: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [
    eff(5, 1080, "Fast 5K", "2026-04-10"),
    eff(5.1, 1100, "Track 5K", "2026-03-20"),
    eff(10, 2400, "10K tune-up", "2026-02-15"),
  ],
  recentBlocks: [block("Block", 45, 12, 5)],
  goal: { distanceMeters: 42195, distanceKey: "marathon" },
  athleteContext: { freshnessScore: 62, tsb: 2, hardRunsLast14d: 3, easyPct: 58 },
};

export const hmReadyRunnerInput: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [
    eff(10, 2520, "10K race", "2026-04-01"),
    eff(15, 4200, "15K tempo", "2026-03-15"),
    eff(21.1, 6120, "HM practice", "2026-02-20", true, true),
    eff(5, 1200, "5K", "2026-01-10"),
  ],
  recentBlocks: [block("Prior", 130, 16, 4), block("Current", 145, 20.5, 5)],
  goal: {
    distanceMeters: 21097,
    distanceKey: "hm",
    targetTimeSec: 6480,
  },
  athleteContext: {
    freshnessScore: 72,
    tsb: 6,
    hardRunsLast14d: 2,
    easyPct: 62,
    efficiencyTrend: "improving",
  },
};

export const marathonUnderpreparedInput: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [eff(10, 2580, "10K", "2026-04-01"), eff(5, 1180, "5K", "2026-03-01")],
  recentBlocks: [block("Block", 55, 20.5, 3)],
  goal: { distanceMeters: 42195, distanceKey: "marathon" },
  athleteContext: { freshnessScore: 55, tsb: 0, hardRunsLast14d: 3, easyPct: 50 },
};

export const fatigueHeavyRunnerInput: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [eff(10, 2700, "10K", "2026-04-05"), eff(5, 1250, "5K", "2026-03-28")],
  recentBlocks: [block("Block", 90, 14, 3)],
  goal: { distanceMeters: 21097, distanceKey: "hm", raceDate: "2026-05-25" },
  athleteContext: {
    freshnessScore: 38,
    tsb: -18,
    hardRunsLast14d: 6,
    easyPct: 35,
    efficiencyTrend: "declining",
  },
};

export const mixedModalityAthleteInput: RaceForecastInput = {
  ...hmReadyRunnerInput,
  trainingEcosystem: {
    modalities: ["run", "cycle", "strength"],
    strengthSessionsLast14d: 4,
    cycleVolumeKmLast14d: 120,
  },
  athleteContext: {
    ...hmReadyRunnerInput.athleteContext,
    archetypeLabel: "mixed-modality",
  },
};

export const missingHrDataAthleteInput: RaceForecastInput = {
  ...hmReadyRunnerInput,
  efforts: hmReadyRunnerInput.efforts.map((e) => ({ ...e, hasHr: false })),
  athleteContext: {
    ...hmReadyRunnerInput.athleteContext,
    maxHr: undefined,
  },
};

export const inconsistentModelEstimatesInput: RaceForecastInput = {
  ...hmReadyRunnerInput,
  efforts: [
    eff(5, 1000, "Very fast 5K", "2026-04-10"),
    eff(21.1, 7200, "Slow HM", "2026-01-01", true, true),
  ],
};

/** Recent 20.5k + 10-mile efforts — HM should land clearly under 2:00. */
export const nearRaceEvidenceRunnerInput: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [
    eff(20.5, 6780, "20.5 km long run", "2026-04-12", true, true),
    eff(16.09, 4920, "10 mile race", "2026-03-28", true, true),
    eff(10, 2520, "10K", "2026-03-01"),
  ],
  recentBlocks: [block("Prior", 120, 16, 4), block("Current", 145, 20.5, 5)],
  goal: { distanceMeters: 21097, distanceKey: "hm", targetTimeSec: 7200 },
  athleteContext: {
    freshnessScore: 68,
    tsb: 4,
    hardRunsLast14d: 2,
    easyPct: 60,
  },
};

export const raceWeekTaperAthleteInput: RaceForecastInput = {
  ...fatigueHeavyRunnerInput,
  goal: {
    distanceMeters: 21097,
    distanceKey: "hm",
    raceDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
  },
  recentBlocks: [block("Taper", 35, 10, 3)],
  athleteContext: {
    freshnessScore: 42,
    tsb: -12,
    hardRunsLast14d: 5,
    easyPct: 40,
    efficiencyTrend: "declining",
  },
};

export const FORECAST_FIXTURES: ForecastFixtureProfile[] = [
  {
    id: "low_data",
    label: "Low-data runner",
    description: "Single 5K PR, sparse history, HM goal.",
    input: lowDataRunnerInput,
    expectations: {
      maxConfidence: "medium",
      requireWarnings: true,
      minIntervalWidthSec: 120,
      mustPassAllRules: false,
    },
  },
  {
    id: "strong_5k_no_long",
    label: "Strong 5K, no long runs",
    description: "Fast short anchors only; marathon target.",
    input: strong5kNoLongRunsInput,
    expectations: {
      specificityLabel: "low",
      maxConfidence: "medium",
      forbidRecommendationPhrases: ["increase volume", "add volume"],
    },
  },
  {
    id: "hm_ready",
    label: "HM-ready runner",
    description: "Race-specific efforts, volume, and freshness aligned.",
    input: hmReadyRunnerInput,
    expectations: {
      minConfidence: "medium",
      durabilityLabel: "strong",
      specificityLabel: "high",
      mustPassAllRules: true,
    },
  },
  {
    id: "marathon_underprepared",
    label: "Marathon underprepared",
    description: "Marathon goal with ~20 km longest run and thin anchors.",
    input: marathonUnderpreparedInput,
    expectations: {
      durabilityLabel: "weak",
      maxConfidence: "medium_high",
      requireWarnings: true,
    },
  },
  {
    id: "fatigue_heavy",
    label: "Fatigue-heavy runner",
    description: "Elevated load, negative TSB, declining efficiency.",
    input: fatigueHeavyRunnerInput,
    expectations: {
      freshnessLabel: "fatigued",
      forbidRecommendationPhrases: ["increase volume", "add more volume", "build volume"],
      requireRecommendationPhrases: ["freshness", "hard"],
    },
  },
  {
    id: "mixed_modality",
    label: "Mixed-modality athlete",
    description: "Run goal with substantial cycle/strength cross-training.",
    input: mixedModalityAthleteInput,
    expectations: {
      requireWarnings: true,
    },
  },
  {
    id: "missing_hr",
    label: "Missing HR data",
    description: "Solid efforts but no heart-rate streams.",
    input: missingHrDataAthleteInput,
    expectations: {
      maxConfidence: "high",
    },
  },
  {
    id: "inconsistent_models",
    label: "Inconsistent model estimates",
    description: "Conflicting 5K and HM anchors produce model spread.",
    input: inconsistentModelEstimatesInput,
    expectations: {
      modelAgreementNotHigh: true,
      minIntervalWidthSec: 180,
    },
  },
  {
    id: "near_race_evidence",
    label: "Near-race evidence (20.5k + 10 mi)",
    description: "Recent 1:53 20.5k and 1:22 10-mile — HM forecast should be clearly under 2:00.",
    input: nearRaceEvidenceRunnerInput,
    expectations: {
      minConfidence: "medium",
      durabilityLabel: "strong",
      specificityLabel: "high",
      mustPassAllRules: true,
    },
  },
  {
    id: "race_week_taper",
    label: "Race-week taper athlete",
    description: "Race within days, elevated fatigue, reduced taper volume.",
    input: raceWeekTaperAthleteInput,
    expectations: {
      freshnessLabel: "fatigued",
      forbidRecommendationPhrases: ["increase volume", "add volume", "build mileage"],
      requireRecommendationPhrases: ["freshness"],
    },
  },
];

export const FORECAST_FIXTURE_BY_ID = Object.fromEntries(
  FORECAST_FIXTURES.map((f) => [f.id, f]),
) as Record<string, ForecastFixtureProfile>;

/** @deprecated Use evaluation/fixtures — kept for legacy tests */
export {
  lowDataRunnerInput as lowDataRunner,
  strong5kNoLongRunsInput as strong5kNoLongRuns,
  hmReadyRunnerInput as hmReadyRunner,
  marathonUnderpreparedInput as marathonWeakDurability,
  fatigueHeavyRunnerInput as fatigueHeavyRunner,
  inconsistentModelEstimatesInput as inconsistentModels,
};
