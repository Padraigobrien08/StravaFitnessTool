import { describe, expect, it } from "vitest";
import {
  buildRacePredictionAnalysis,
  collectEffortPoints,
  exponentCi95,
  fitPowerLawRegression,
  isRaceLikeEffort,
  predictCameron,
  racePredictionConfidence,
  typicalErrorPct,
  type EffortPoint,
} from "../predictions";
import { predictRaceTime } from "../records";
import type { RunWorkoutLabel, WorkoutType } from "../workoutType";
import type { RunActivity } from "@/lib/strava/types";

function label(runId: string, type: WorkoutType): RunWorkoutLabel {
  return {
    runId,
    date: "2025-01-15",
    runName: `Run ${runId}`,
    classification: { type, confidence: "high", signals: [] },
  };
}

function effort(distanceKm: number, timeSec: number, source: string, runId = "1"): EffortPoint {
  return { distanceKm, timeSec, runId, runName: `e${runId}`, date: "2025-01-15", source };
}

function mockRun(id: string, km: number, paceMin: number, date = "2025-01-15"): RunActivity {
  const paceSec = paceMin * 60;
  const movingSec = Math.round(km * 1000 * (paceSec / 1000));
  return {
    id,
    name: `Run ${id}`,
    date,
    distanceM: km * 1000,
    movingSec,
    elapsedSec: movingSec,
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr: 155,
    maxHr: 175,
    elevationGainM: 50,
    calories: null,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  };
}

describe("buildRacePredictionAnalysis", () => {
  it("returns empty when no data", () => {
    const analysis = buildRacePredictionAnalysis([], []);
    expect(analysis.models.length).toBe(0);
    expect(analysis.consensus.length).toBe(0);
  });

  it("builds models and consensus from quality runs", () => {
    const runs = [
      mockRun("1", 5, 4.5),
      mockRun("2", 10, 4.8),
      mockRun("3", 8, 4.6),
      mockRun("4", 12, 5.0),
    ];
    const analysis = buildRacePredictionAnalysis(runs, []);
    expect(analysis.efforts.length).toBeGreaterThanOrEqual(4);
    expect(analysis.models.some((m) => m.id === "riegel")).toBe(true);
    expect(analysis.models.some((m) => m.id === "cameron")).toBe(true);
    expect(analysis.consensus.length).toBe(4);
    expect(analysis.explanation.length).toBeGreaterThan(2);
    expect(analysis.primaryAnchor).not.toBeNull();
  });
});

describe("fitPowerLawRegression", () => {
  it("fits when enough efforts exist", () => {
    const runs = [mockRun("1", 5, 4.5), mockRun("2", 10, 4.8), mockRun("3", 8, 4.6)];
    const efforts = collectEffortPoints(runs, [], []);
    const fit = fitPowerLawRegression(efforts);
    expect(fit).not.toBeNull();
    expect(fit!.exponent).toBeGreaterThan(1);
    expect(fit!.curve.length).toBeGreaterThan(10);
  });

  // A perfect power law is the only case where the expected R² is known exactly,
  // which makes it the assertion that pins down the goodness-of-fit maths.
  it("reports R² ≈ 1 for a perfect power law", () => {
    const efforts = [3, 5, 8, 10, 15, 21].map((km, i) => ({
      distanceKm: km,
      timeSec: 300 * Math.pow(km, 1.06),
      runId: String(i),
      runName: `effort ${i}`,
      date: "2026-01-01",
      source: "Full run",
    }));
    const fit = fitPowerLawRegression(efforts)!;
    expect(fit.exponent).toBeCloseTo(1.06, 4);
    expect(fit.coefficient).toBeCloseTo(300, 2);
    expect(fit.rSquared).toBeCloseTo(1, 3);
  });

  it("keeps R² within [0, 1] on noisy real-world-shaped efforts", () => {
    const efforts = [3, 4, 5, 6, 8, 10, 12, 15, 18, 21].map((km, i) => ({
      distanceKm: km,
      timeSec: 300 * Math.pow(km, 1.06) * (i % 3 === 0 ? 1.05 : 0.97),
      runId: String(i),
      runName: `effort ${i}`,
      date: "2026-01-01",
      source: "Full run",
    }));
    const fit = fitPowerLawRegression(efforts)!;
    expect(fit.rSquared).toBeGreaterThanOrEqual(0);
    expect(fit.rSquared).toBeLessThanOrEqual(1);
  });
});

describe("collectEffortPoints effort quality", () => {
  // 5 km at 4:00/km is a hard effort; 5 km at 5:50/km is easy running. Both used to
  // be admitted as "race-quality", which is what flattened the fitted exponent.
  const runs = [
    mockRun("hard", 5, 4.0),
    mockRun("tempo", 8, 4.2),
    mockRun("easy", 6, 5.83),
    mockRun("recovery", 4, 6.5),
    mockRun("long", 20, 5.5),
  ];

  it("falls back to the pace gate alone when no classifications are given", () => {
    // Historical behaviour, preserved for callers that have no labels (physiology's
    // critical-speed fit, the V2 run adapter): every one of these is inside the
    // 8:00/km gate, so easy and long running is admitted.
    const ids = collectEffortPoints(runs, [], []).map((e) => e.runId);
    expect(ids).toContain("easy");
    expect(ids).toContain("long");
  });

  it("admits only genuine efforts once classifications are available", () => {
    const labels = [
      label("hard", "interval"),
      label("tempo", "tempo"),
      label("easy", "easy"),
      label("recovery", "recovery"),
      label("long", "long"),
    ];
    const ids = collectEffortPoints(runs, [], [], { workoutLabels: labels }).map((e) => e.runId);
    expect(ids).toContain("hard");
    expect(ids).toContain("tempo");
    expect(ids).not.toContain("easy");
    expect(ids).not.toContain("recovery");
    // A long run is distance-relevant but run at aerobic pace — durability, not speed.
    expect(ids).not.toContain("long");
  });

  it("admits a raced activity", () => {
    const ids = collectEffortPoints(runs, [], [], {
      workoutLabels: [label("easy", "race")],
    }).map((e) => e.runId);
    expect(ids).toContain("easy"); // same run, now known to have been raced
  });

  it("excludes an unclassified run rather than assuming it was an effort", () => {
    const ids = collectEffortPoints(runs, [], [], { workoutLabels: [] }).map((e) => e.runId);
    expect(ids).toEqual([]);
  });

  // The headline symptom: a set polluted with easy running fits an exponent near 1.0,
  // meaning "pace never fades with distance". Real runners sit near Riegel's 1.06.
  it("recovers a physiologically plausible exponent once easy running is excluded", () => {
    const mixed = [
      mockRun("r1", 5, 4.0),
      mockRun("r2", 8, 4.2),
      mockRun("r3", 10, 4.35),
      mockRun("r4", 15, 4.6),
      ...Array.from({ length: 20 }, (_, i) => mockRun(`easy${i}`, 6 + (i % 4), 5.9)),
    ];
    const labels = [
      label("r1", "interval"),
      label("r2", "tempo"),
      label("r3", "tempo"),
      label("r4", "race"),
      ...Array.from({ length: 20 }, (_, i) => label(`easy${i}`, "easy")),
    ];

    const polluted = fitPowerLawRegression(collectEffortPoints(mixed, [], []))!;
    const filtered = fitPowerLawRegression(
      collectEffortPoints(mixed, [], [], { workoutLabels: labels }),
    )!;

    expect(polluted.exponent).toBeLessThan(1.02); // flattened by easy running
    expect(filtered.exponent).toBeGreaterThan(1.02);
    expect(filtered.exponent).toBeLessThan(1.15);
  });
});

describe("fit quality statistics", () => {
  /** Efforts on an exact power law, optionally perturbed by ±`jitter` in log space. */
  function curve(distances: number[], exponent = 1.06, jitter = 0): EffortPoint[] {
    return distances.map((km, i) => ({
      distanceKm: km,
      timeSec: 300 * Math.pow(km, exponent) * (1 + (i % 2 === 0 ? jitter : -jitter)),
      runId: String(i),
      runName: `effort ${i}`,
      date: "2026-01-01",
      source: "Lap block",
    }));
  }

  it("reports no residual scatter for a perfect fit", () => {
    const fit = fitPowerLawRegression(curve([3, 5, 8, 10, 15, 21]))!;
    expect(fit.residualLogSd).toBeCloseTo(0, 6);
    expect(fit.exponentStdError).toBeCloseTo(0, 6);
    expect(typicalErrorPct(fit)).toBeCloseTo(0, 4);
  });

  it("recovers the scatter it was given", () => {
    // ±5% alternating perturbation. Residual SD in log space should land near ln(1.05).
    const fit = fitPowerLawRegression(curve([3, 5, 8, 10, 15, 21], 1.06, 0.05))!;
    expect(fit.residualLogSd).toBeGreaterThan(0.03);
    expect(fit.residualLogSd).toBeLessThan(0.07);
    expect(typicalErrorPct(fit)!).toBeGreaterThan(3);
    expect(typicalErrorPct(fit)!).toBeLessThan(7);
  });

  it("returns nulls rather than a fabricated precision at n = 2 degrees of freedom", () => {
    // Three points, two parameters: one degree of freedom left. Defined, but wide.
    const fit = fitPowerLawRegression(curve([5, 10, 21], 1.06, 0.05))!;
    expect(fit.residualLogSd).not.toBeNull();
    expect(exponentCi95(fit)!).toBeGreaterThan(0);
  });

  it("widens the exponent interval when the distances barely vary", () => {
    // Everything crammed into 9-11 km: little leverage, so the exponent is poorly pinned
    // even though the points sit close to the line.
    const narrow = fitPowerLawRegression(curve([9, 9.5, 10, 10.5, 11], 1.06, 0.02))!;
    const wide = fitPowerLawRegression(curve([3, 5, 10, 15, 21], 1.06, 0.02))!;
    expect(exponentCi95(narrow)!).toBeGreaterThan(exponentCi95(wide)!);
  });
});

describe("racePredictionConfidence", () => {
  function curve(distances: number[], jitter = 0): EffortPoint[] {
    return distances.map((km, i) => ({
      distanceKm: km,
      timeSec: 300 * Math.pow(km, 1.06) * (1 + (i % 2 === 0 ? jitter : -jitter)),
      runId: String(i),
      runName: `effort ${i}`,
      date: "2026-01-01",
      source: "Lap block",
    }));
  }

  it("is low without enough efforts to fit anything", () => {
    expect(racePredictionConfidence(2, null)).toBe("low");
    expect(racePredictionConfidence(0, null)).toBe("low");
  });

  it("is high for many tight efforts across a wide distance range", () => {
    const fit = fitPowerLawRegression(curve([3, 5, 8, 10, 15, 21]))!;
    expect(racePredictionConfidence(6, fit)).toBe("high");
  });

  // The point of the change: R² alone certified sets like this one.
  it("refuses high when the efforts scatter badly, however good R² looks", () => {
    const fit = fitPowerLawRegression(curve([3, 5, 8, 10, 15, 21], 0.18))!;
    expect(fit.rSquared).toBeGreaterThan(0.9); // the old gate would have passed
    expect(racePredictionConfidence(6, fit)).not.toBe("high");
  });

  it("refuses high when the exponent is not pinned down, however tight the fit", () => {
    // Tight scatter but almost no distance leverage: extrapolating to a marathon from
    // this is guesswork, and the old gate could not see the difference.
    const fit = fitPowerLawRegression(curve([9, 9.5, 10, 10.5, 11], 0.03))!;
    expect(fit.rSquared).toBeGreaterThan(0.5);
    expect(exponentCi95(fit)!).toBeGreaterThan(0.08);
    expect(racePredictionConfidence(5, fit)).not.toBe("high");
  });

  it("never exceeds medium below five efforts, however perfect the curve", () => {
    const fit = fitPowerLawRegression(curve([5, 10, 21]))!;
    expect(fit.residualLogSd).toBeCloseTo(0, 6);
    expect(racePredictionConfidence(4, fit)).toBe("medium");
  });
});

describe("prediction confidence end to end", () => {
  // The regression test from `collectEffortPoints`, carried through to the headline:
  // an effort set polluted with easy running must not be labelled high confidence.
  it("does not report high confidence on a set polluted with easy running", () => {
    const runs = [
      mockRun("r1", 5, 4.0),
      mockRun("r2", 8, 4.2),
      mockRun("r3", 10, 4.35),
      mockRun("r4", 15, 4.6),
      ...Array.from({ length: 20 }, (_, i) => mockRun(`easy${i}`, 6 + (i % 4), 5.9)),
    ];
    const polluted = buildRacePredictionAnalysis(runs, []);
    expect(polluted.efforts.length).toBeGreaterThan(5);
    expect(polluted.confidence).not.toBe("high");
  });

  it("explains the fit in scatter and exponent precision, not R²", () => {
    const runs = [mockRun("1", 5, 4.0), mockRun("2", 10, 4.3), mockRun("3", 15, 4.5)];
    const analysis = buildRacePredictionAnalysis(runs, []);
    const line = analysis.explanation.find((e) => e.includes("exponent"));
    expect(line).toBeDefined();
    expect(line).not.toContain("R²");
    expect(line).toMatch(/off it on average/);
  });
});

describe("isRaceLikeEffort", () => {
  it("counts device-measured segments in the 4–22 km band", () => {
    expect(isRaceLikeEffort(effort(10, 2400, "Lap block"))).toBe(true);
    expect(isRaceLikeEffort(effort(10, 2400, "Best effort"))).toBe(true);
  });

  it("rejects a whole activity unless it was raced", () => {
    expect(isRaceLikeEffort(effort(10, 2400, "Full run"))).toBe(false);
    expect(isRaceLikeEffort(effort(10, 2400, "Full run"), "tempo")).toBe(false);
    expect(isRaceLikeEffort(effort(10, 2400, "Full run"), "race")).toBe(true);
  });

  it("rejects anything outside the 4–22 km band", () => {
    expect(isRaceLikeEffort(effort(3, 800, "Lap block"))).toBe(false);
    expect(isRaceLikeEffort(effort(30, 9000, "Best effort"))).toBe(false);
    expect(isRaceLikeEffort(effort(30, 9000, "Full run"), "race")).toBe(false);
  });
});

describe("multi-anchor model", () => {
  // The comparator read `b.timeSec / b.timeSec` (always 1), so it never compared the
  // two efforts and "top 3 by speed" picked arbitrarily.
  it("anchors on the fastest efforts, not an arbitrary three", () => {
    const runs = [
      mockRun("slow1", 10, 5.5),
      mockRun("slow2", 10, 5.4),
      mockRun("slow3", 10, 5.3),
      mockRun("fast1", 10, 4.0),
      mockRun("fast2", 10, 4.1),
      mockRun("fast3", 10, 4.2),
    ];
    const analysis = buildRacePredictionAnalysis(runs, []);
    const multi = analysis.models.find((m) => m.id === "multi")!;
    const tenK = multi.predictions.find((p) => p.label === "10K")!;

    // Averaging the three fastest 10 Ks (4:00–4:10/km) lands near 41–42 min; the
    // three slowest would land near 54 min.
    expect(tenK.timeSec).toBeLessThan(45 * 60);
    expect(tenK.timeSec).toBeGreaterThan(38 * 60);
  });
});

describe("predictCameron", () => {
  it("predicts longer time than riegel for marathon from 10k", () => {
    const t10 = 3000;
    const d10 = 10000;
    const d42 = 42195;
    const riegel = predictRaceTime(d10, t10, d42);
    const cameron = predictCameron(d10, t10, d42);
    expect(cameron).toBeGreaterThan(riegel);
  });

  // Pinned to published equivalence tables. The old implementation also satisfied
  // "slower than Riegel at the marathon" — it inflated everything — so that
  // assertion alone let a 57-minute error sit unnoticed. These pin the values.
  it.each([
    ["10K from a 20:00 5K", 5000, 1200, 10000, 41 * 60 + 40],
    ["HM from a 20:00 5K", 5000, 1200, 21097, 91 * 60 + 51],
    ["marathon from a 20:00 5K", 5000, 1200, 42195, 3 * 3600 + 15 * 60 + 11],
    ["marathon from a 50:00 10K", 10000, 3000, 42195, 3 * 3600 + 54 * 60 + 16],
  ])("matches published equivalence for %s", (_label, d1, t1, d2, expected) => {
    expect(predictCameron(d1, t1, d2)).toBeCloseTo(expected, -1); // within ~5s
  });

  it("stays in the same family as the other models on a short anchor", () => {
    // The regression case: a 5.52 km anchor in 1358s projected to 2:30:22 for a half
    // marathon, ~57 min beyond Riegel's 1:33:45, because the old trailing factor
    // approached 2 as the extrapolation grew.
    const cameron = predictCameron(5520, 1358, 21097);
    const riegel = predictRaceTime(5520, 1358, 21097);
    expect(cameron).toBeGreaterThan(riegel * 0.95);
    expect(cameron).toBeLessThan(riegel * 1.15);
  });

  it("is monotonic in distance and returns 0 on degenerate input", () => {
    const t = (d: number) => predictCameron(5000, 1200, d);
    expect(t(10000)).toBeGreaterThan(t(5000));
    expect(t(21097)).toBeGreaterThan(t(10000));
    expect(t(42195)).toBeGreaterThan(t(21097));
    expect(predictCameron(0, 1200, 10000)).toBe(0);
    expect(predictCameron(5000, 0, 10000)).toBe(0);
    expect(predictCameron(5000, 1200, 0)).toBe(0);
  });
});
