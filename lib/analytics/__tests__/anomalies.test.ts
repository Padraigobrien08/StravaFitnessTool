import { describe, expect, it } from "vitest";
import { computeAnomalies } from "../anomalies";
import type { PersonalZScores, SessionZScore } from "../personalZScores";
import type { RunActivity } from "@/lib/strava/types";

function run(
  id: string,
  date: string,
  opts: { km?: number; tempC?: number | null; elevGainM?: number | null } = {},
): RunActivity {
  const km = opts.km ?? 8;
  return {
    id,
    name: `Run ${id}`,
    date: `${date}T09:00:00.000Z`,
    distanceM: km * 1000,
    movingSec: km * 300,
    elapsedSec: km * 300,
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr: 150,
    maxHr: 165,
    elevationGainM: opts.elevGainM === undefined ? km * 2 : opts.elevGainM, // ~2 m/km flat default
    calories: null,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: 300,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: opts.tempC === undefined ? 15 : opts.tempC,
  };
}

function session(runId: string, z: number): SessionZScore {
  return {
    runId,
    date: `2026-07-20T09:00:00.000Z`,
    runName: `Run ${runId}`,
    type: "tempo",
    typeLabel: "Tempo",
    paceZ: z,
    efficiencyZ: z,
    primaryZ: z,
    primaryMetric: "efficiency",
    cohortSize: 6,
    confidence: "medium",
    headline: "",
  };
}

function zscores(sessions: SessionZScore[], available = true): PersonalZScores {
  return {
    available,
    sessions,
    standouts: { best: null, worst: null },
    evidence: [],
    limitations: [],
  };
}

/** A set of cool, flat, isolated normal runs (weekly) → medians temp≈15, elev≈2, preceding≈0. */
function normals(): RunActivity[] {
  return ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29"].map((d, i) =>
    run(`n${i}`, d),
  );
}

describe("computeAnomalies", () => {
  it("is unavailable when personal z-scores are unavailable", () => {
    const r = computeAnomalies([], zscores([], false));
    expect(r.available).toBe(false);
  });

  it("flags nothing when all |z| are below threshold", () => {
    const runs = [...normals(), run("x", "2026-07-20")];
    const r = computeAnomalies(runs, zscores([session("x", -1.0)]));
    expect(r.available).toBe(false);
  });

  it("attributes heat to a hot underperformance", () => {
    const runs = [...normals(), run("x", "2026-07-20", { tempC: 28 })];
    const r = computeAnomalies(runs, zscores([session("x", -1.8)]));
    expect(r.available).toBe(true);
    const a = r.anomalies.find((x) => x.runId === "x")!;
    expect(a.direction).toBe("under");
    expect(a.likelyCauses.map((c) => c.cause)).toContain("heat");
    expect(a.likelyCauses.find((c) => c.cause === "heat")!.detail).toMatch(/28°C/);
  });

  it("attributes terrain to a hilly underperformance", () => {
    const runs = [...normals(), run("x", "2026-07-20", { elevGainM: 120 })]; // 15 m/km
    const r = computeAnomalies(runs, zscores([session("x", -1.7)]));
    const a = r.anomalies.find((x) => x.runId === "x")!;
    expect(a.likelyCauses.map((c) => c.cause)).toContain("terrain");
  });

  it("attributes fatigue when heavy load precedes the run", () => {
    const runs = [
      ...normals(),
      // a small typical preceding pair so the median preceding load stays low
      run("p1", "2026-07-01", { km: 5 }),
      run("p2", "2026-07-02", { km: 5 }),
      // heavy block right before the anomaly
      run("a", "2026-07-19", { km: 20 }),
      run("b", "2026-07-18", { km: 20 }),
      run("x", "2026-07-20"),
    ];
    const r = computeAnomalies(runs, zscores([session("x", -1.6)]));
    const a = r.anomalies.find((x) => x.runId === "x")!;
    expect(a.likelyCauses.map((c) => c.cause)).toContain("fatigue");
  });

  it("marks an underperformance unexplained when nothing accounts for it", () => {
    const runs = [...normals(), run("x", "2026-07-20")]; // cool, flat, isolated
    const r = computeAnomalies(runs, zscores([session("x", -1.9)]));
    const a = r.anomalies.find((x) => x.runId === "x")!;
    expect(a.likelyCauses.map((c) => c.cause)).toEqual(["unexplained"]);
  });

  it("treats a positive z as an overperformance", () => {
    const runs = [...normals(), run("x", "2026-07-20")];
    const r = computeAnomalies(runs, zscores([session("x", 2.1)]));
    const a = r.anomalies.find((x) => x.runId === "x")!;
    expect(a.direction).toBe("over");
    expect(a.headline).toMatch(/overperformed/i);
  });
});
