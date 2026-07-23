import { describe, expect, it } from "vitest";
import { evaluateAdherence } from "../evaluateAdherence";
import type { LoggedRecommendation } from "../types";
import type { WorkoutType } from "@/lib/analytics/workoutType";
import type { RunActivity } from "@/lib/strava/types";

function rec(overrides: Partial<LoggedRecommendation> = {}): LoggedRecommendation {
  return {
    recommendationId: "today_session:2026-07-10",
    producer: "today_session",
    issuedAt: "2026-07-10T08:00:00.000Z",
    targetDate: "2026-07-10",
    kind: "tempo",
    headline: "Tempo — 8–10 km",
    distanceKmMin: 8,
    distanceKmMax: 10,
    ...overrides,
  };
}

function run(id: string, date: string, distanceKm: number): RunActivity {
  return {
    id,
    date,
    name: id,
    distanceM: distanceKm * 1000,
    elapsedSec: 3000,
    movingSec: 3000,
    avgSpeedMps: 3.3,
    maxSpeedMps: 5,
    avgHr: 160,
    maxHr: 180,
    elevationGainM: 10,
    calories: 400,
    relativeEffort: 90,
    trainingLoad: 250,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: 80,
    totalSteps: null,
    weatherTempC: null,
  };
}

const types = (entries: [string, WorkoutType][]) => new Map(entries);

describe("evaluateAdherence", () => {
  it("marks a matching session followed", () => {
    const r = evaluateAdherence(
      rec(),
      [run("a", "2026-07-10", 9)],
      types([["a", "tempo"]]),
      "2026-07-11",
    );
    expect(r.adherence).toBe("followed");
    expect(r.matchedRunIds).toEqual(["a"]);
  });

  it("marks a run of the wrong type as partial", () => {
    const r = evaluateAdherence(
      rec(),
      [run("a", "2026-07-10", 9)],
      types([["a", "easy"]]),
      "2026-07-11",
    );
    expect(r.adherence).toBe("partial");
    expect(r.note).toMatch(/easy/);
  });

  it("marks a right-type but off-distance run as partial", () => {
    const r = evaluateAdherence(
      rec(),
      [run("a", "2026-07-10", 3)], // way under the 8–10 km target
      types([["a", "tempo"]]),
      "2026-07-11",
    );
    expect(r.adherence).toBe("partial");
    expect(r.note).toMatch(/range/);
  });

  it("is skipped when the day passed with no run", () => {
    const r = evaluateAdherence(rec(), [], types([]), "2026-07-12");
    expect(r.adherence).toBe("skipped");
  });

  it("is pending when the target day is not over", () => {
    const r = evaluateAdherence(rec(), [], types([]), "2026-07-10");
    expect(r.adherence).toBe("pending");
  });

  it("treats easy/recovery as interchangeable", () => {
    const r = evaluateAdherence(
      rec({ kind: "easy", distanceKmMin: null, distanceKmMax: null }),
      [run("a", "2026-07-10", 6)],
      types([["a", "recovery"]]),
      "2026-07-11",
    );
    expect(r.adherence).toBe("followed");
  });

  describe("rest days", () => {
    it("followed when no run is recorded", () => {
      const r = evaluateAdherence(
        rec({ kind: "rest", distanceKmMin: null, distanceKmMax: null }),
        [],
        types([]),
        "2026-07-11",
      );
      expect(r.adherence).toBe("followed");
    });

    it("skipped when a run happens on a rest day", () => {
      const r = evaluateAdherence(
        rec({ kind: "rest", distanceKmMin: null, distanceKmMax: null }),
        [run("a", "2026-07-10", 5)],
        types([["a", "easy"]]),
        "2026-07-11",
      );
      expect(r.adherence).toBe("skipped");
      expect(r.matchedRunIds).toEqual(["a"]);
    });
  });

  it("picks the longest run of the day as the intended session", () => {
    const r = evaluateAdherence(
      rec(),
      [run("short", "2026-07-10", 2), run("main", "2026-07-10", 9)],
      types([
        ["short", "easy"],
        ["main", "tempo"],
      ]),
      "2026-07-11",
    );
    expect(r.adherence).toBe("followed");
    expect(r.matchedRunIds).toContain("main");
  });
});
