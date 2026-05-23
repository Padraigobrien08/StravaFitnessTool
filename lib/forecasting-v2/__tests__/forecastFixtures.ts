import type { TrainingBlock } from "@/lib/analytics/block";
import type { RaceForecastInput, RaceQualityEffort } from "../forecastTypes";

const block = (
  label: string,
  distanceKm: number,
  longestRunKm: number,
  runCount = 4
): TrainingBlock => ({
  weekStart: "2026-01-01",
  label,
  distanceKm,
  runCount,
  longestRunKm,
});

export const lowDataRunner: RaceForecastInput = {
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

export const strong5kNoLongRuns: RaceForecastInput = {
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

export const hmReadyRunner: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [
    eff(10, 2520, "10K race", "2026-04-01"),
    eff(15, 4200, "15K tempo", "2026-03-15"),
    eff(21.1, 6120, "HM practice", "2026-02-20", true, true),
    eff(5, 1200, "5K", "2026-01-10"),
  ],
  recentBlocks: [
    block("Prior", 130, 16, 4),
    block("Current", 145, 20.5, 5),
  ],
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

export const fatigueHeavyRunner: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [
    eff(10, 2700, "10K", "2026-04-05"),
    eff(5, 1250, "5K", "2026-03-28"),
  ],
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

export const marathonWeakDurability: RaceForecastInput = {
  activities: [],
  runs: [],
  efforts: [
    eff(10, 2580, "10K", "2026-04-01"),
    eff(5, 1180, "5K", "2026-03-01"),
  ],
  recentBlocks: [block("Block", 55, 20.5, 3)],
  goal: { distanceMeters: 42195, distanceKey: "marathon" },
  athleteContext: { freshnessScore: 55, tsb: 0, hardRunsLast14d: 3, easyPct: 50 },
};

export const inconsistentModels: RaceForecastInput = {
  ...hmReadyRunner,
  efforts: [
    eff(5, 1000, "Very fast 5K", "2026-04-10"),
    eff(21.1, 7200, "Slow HM", "2026-01-01", true, true),
  ],
};

function eff(
  distanceKm: number,
  timeSec: number,
  runName: string,
  date: string,
  hasHr = false,
  isRaceLike = false
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
