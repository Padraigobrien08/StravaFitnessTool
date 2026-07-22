import { describe, expect, it } from "vitest";
import { classifyActivityModality } from "../modality";
import { detectAthleteArchetype } from "../archetype";
import { collectInterferenceFlags } from "../interference";
import { buildTrainingEcosystem } from "../engine";
import { getAthleteArchetypePayload } from "../coachTools";
import {
  hybridRunner,
  pureRunner,
  triathlete,
  strengthHeavy,
  lowDataUser,
  unknownSports,
} from "./fixtures";
import type { DashboardInsights } from "@/lib/analytics";
import { computeTrainingEcosystem } from "../index";
import { buildRollingSnapshots } from "../aggregates";

describe("classifyActivityModality", () => {
  it("maps Strava sport_type per API model", () => {
    expect(classifyActivityModality("Run")).toBe("run");
    expect(classifyActivityModality("TrailRun")).toBe("run");
    expect(classifyActivityModality("Ride")).toBe("bike");
    expect(classifyActivityModality("GravelRide")).toBe("bike");
    expect(classifyActivityModality("Swim")).toBe("swim");
    expect(classifyActivityModality("Rowing")).toBe("aerobic_cross_training");
    expect(classifyActivityModality("WeightTraining")).toBe("strength");
    expect(classifyActivityModality("Yoga")).toBe("mobility");
    expect(classifyActivityModality("Walk")).toBe("recovery");
    expect(classifyActivityModality("Crossfit")).toBe("high_intensity_cross_training");
    expect(classifyActivityModality("Hike")).toBe("outdoor_endurance");
    expect(classifyActivityModality("Soccer")).toBe("sport");
    expect(classifyActivityModality("ObstacleCourse")).toBe("unknown");
  });
});

describe("archetype detection", () => {
  it("detects runner", () => {
    const rolling = buildRollingSnapshots(pureRunner);
    const r = detectAthleteArchetype(rolling[56]);
    expect(r.archetype).toBe("runner");
  });

  it("detects triathlete", () => {
    const rolling = buildRollingSnapshots(triathlete);
    const r = detectAthleteArchetype(rolling[56]);
    expect(r.archetype).toBe("triathlete");
  });

  it("detects hybrid_runner", () => {
    const rolling = buildRollingSnapshots(hybridRunner);
    const r = detectAthleteArchetype(rolling[56]);
    expect(["hybrid_runner", "strength_endurance", "multisport"]).toContain(r.archetype);
  });

  it("returns unknown for low data", () => {
    const rolling = buildRollingSnapshots(lowDataUser);
    const r = detectAthleteArchetype(rolling[56]);
    expect(r.confidence).toBe("low");
  });
});

describe("interference", () => {
  it("flags HIIT near hard run", () => {
    const run = pureRunner.find((a) => a.isHardRun)!;
    const hiit = hybridRunner.find((a) => a.modality === "high_intensity_cross_training")!;
    const flags = collectInterferenceFlags(
      [
        { ...run, startDate: "2025-05-10T18:00:00.000Z" },
        { ...hiit, startDate: "2025-05-10T10:00:00.000Z" },
      ],
      null,
    );
    expect(flags.some((f) => f.kind === "near_quality_run")).toBe(true);
  });

  it("flags weekly HI density for strength-heavy athlete", () => {
    const flags = collectInterferenceFlags(strengthHeavy, null);
    expect(flags.some((f) => f.kind === "weekly_hi_density" || f.kind === "hybrid_cluster")).toBe(
      true,
    );
  });
});

describe("buildTrainingEcosystem", () => {
  it("produces ecosystem insights with evidence", () => {
    const eco = buildTrainingEcosystem(triathlete, null, "medium");
    expect(eco.rolling[28]?.bikeMinutes).toBeGreaterThan(0);
    expect(eco.rolling[28]?.swimMinutes).toBeGreaterThan(0);
    expect(eco.ecosystemInsights.length).toBeGreaterThan(0);
    expect(eco.ecosystemInsights[0].limitations.length).toBeGreaterThan(0);
  });

  it("handles unknown sport types", () => {
    const eco = buildTrainingEcosystem(unknownSports, null, "low");
    expect(eco.modalityCoverage.unknown).toBeGreaterThan(0);
  });
});

describe("coach tool payloads", () => {
  const minimalAnalytics = {
    trainingEcosystem: buildTrainingEcosystem(hybridRunner, null, "medium"),
  } as DashboardInsights;

  it("get_athlete_archetype returns grounded payload", () => {
    const p = getAthleteArchetypePayload(minimalAnalytics);
    expect(p.archetype).toBeDefined();
    expect(p.evidence.length).toBeGreaterThan(0);
  });
});

describe("computeTrainingEcosystem from import", () => {
  it("uses strava_api source", () => {
    const eco = computeTrainingEcosystem(
      {
        runs: [],
        profile: { maxHeartRate: 190, athleteType: null, ftp: null, measurementPreference: null },
        goals: [],
        allActivities: [
          {
            id: "1",
            date: new Date().toISOString(),
            name: "Ride",
            type: "Ride",
            distanceM: 20000,
            elapsedSec: 3600,
          },
        ],
        importedAt: new Date().toISOString(),
        fitRunIds: [],
      },
      [],
      "low",
      null,
      "strava_api",
    );
    expect(eco.activities[0]?.source).toBe("strava_api");
    expect(eco.activities[0]?.modality).toBe("bike");
  });
});
