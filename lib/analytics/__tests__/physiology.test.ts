import { describe, expect, it } from "vitest";
import {
  assessConditionNormalization,
  assessCriticalSpeed,
  assessDurability,
  assessFatigueResistance,
  assessThresholdEconomy,
  computePhysiology,
  criticalSpeedPredictSec,
  fitCriticalSpeed,
  heatAdjustedPaceSecPerKm,
} from "../physiology";
import type { EffortPoint } from "../predictions";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { RunWorkoutLabel, WorkoutType } from "../workoutType";

/** Build a distance–time point on the line distance = cs·t + dPrime. */
function pointOnLine(timeSec: number, cs: number, dPrime: number) {
  return { timeSec, distanceKm: (cs * timeSec + dPrime) / 1000 };
}

function effort(distanceKm: number, timeSec: number, id = "e", date = "2025-06-01"): EffortPoint {
  return {
    distanceKm,
    timeSec,
    runId: id,
    runName: `Effort ${id}`,
    date,
    source: "Best effort",
  };
}

/** Efforts on the power-law curve time = k·distance^exponent. */
function powerLawEfforts(exponent: number, k: number, distancesKm: number[], date: string) {
  return distancesKm.map((d, i) => effort(d, k * Math.pow(d, exponent), `${date}-${i}`, date));
}

function mockRun(id: string, km: number, paceMinPerKm: number, date = "2025-06-01"): RunActivity {
  const paceSec = paceMinPerKm * 60;
  const movingSec = Math.round(km * paceSec);
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
    elevationGainM: 30,
    calories: null,
    relativeEffort: null,
    trainingLoad: null,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  };
}

function runHr(
  id: string,
  km: number,
  paceMinPerKm: number,
  avgHr: number,
  date = "2025-06-01",
): RunActivity {
  return { ...mockRun(id, km, paceMinPerKm, date), avgHr };
}

function label(runId: string, type: WorkoutType, date = "2025-06-01"): RunWorkoutLabel {
  return {
    runId,
    date,
    runName: `Run ${runId}`,
    classification: { type, confidence: "high", signals: [] },
  };
}

describe("fitCriticalSpeed", () => {
  it("recovers CS and D′ from clean synthetic efforts", () => {
    const cs = 5; // m/s → 3:20/km
    const dPrime = 200; // m
    const points = [180, 400, 700, 1100, 1500].map((t) => pointOnLine(t, cs, dPrime));
    const fit = fitCriticalSpeed(points);
    expect(fit).not.toBeNull();
    expect(fit!.csMetersPerSec).toBeCloseTo(cs, 2);
    expect(fit!.dPrimeMeters).toBeCloseTo(dPrime, 0);
    expect(fit!.rSquared).toBeGreaterThan(0.99);
    expect(fit!.n).toBe(5);
  });

  it("returns null with fewer than 3 in-band efforts", () => {
    const points = [pointOnLine(300, 5, 200), pointOnLine(600, 5, 200)];
    expect(fitCriticalSpeed(points)).toBeNull();
  });

  it("returns null when durations are too clustered", () => {
    // spread < 1.5×
    const points = [pointOnLine(500, 5, 200), pointOnLine(560, 5, 200), pointOnLine(620, 5, 200)];
    expect(fitCriticalSpeed(points)).toBeNull();
  });

  it("ignores efforts outside the 2–30 min band", () => {
    const inBand = [180, 700, 1500].map((t) => pointOnLine(t, 5, 200));
    const withOutliers = [
      ...inBand,
      pointOnLine(30, 5, 200), // too short
      pointOnLine(3600, 5, 200), // too long
    ];
    const fit = fitCriticalSpeed(withOutliers);
    expect(fit).not.toBeNull();
    expect(fit!.n).toBe(3);
  });

  it("recovers a higher CS for a faster athlete", () => {
    const slow = fitCriticalSpeed([180, 700, 1500].map((t) => pointOnLine(t, 5, 200)));
    const fast = fitCriticalSpeed([180, 700, 1500].map((t) => pointOnLine(t, 5.5, 200)));
    expect(fast!.csMetersPerSec).toBeGreaterThan(slow!.csMetersPerSec);
  });
});

describe("criticalSpeedPredictSec", () => {
  it("round-trips distance = CS·t + D′", () => {
    const fit = { csMetersPerSec: 5, dPrimeMeters: 200, rSquared: 1, n: 5 };
    // 5000 m should take (5000 − 200) / 5 = 960 s
    expect(criticalSpeedPredictSec(fit, 5000)).toBeCloseTo(960, 5);
  });

  it("returns null when distance is inside the reserve", () => {
    const fit = { csMetersPerSec: 5, dPrimeMeters: 200, rSquared: 1, n: 5 };
    expect(criticalSpeedPredictSec(fit, 100)).toBeNull();
  });
});

describe("assessCriticalSpeed", () => {
  it("is available with evidence when the fit holds", () => {
    const efforts = [180, 400, 700, 1100, 1500].map((t) => {
      const p = pointOnLine(t, 5, 200);
      return effort(p.distanceKm, p.timeSec);
    });
    const a = assessCriticalSpeed(efforts);
    expect(a.available).toBe(true);
    expect(a.csPaceSecPerKm).toBeGreaterThan(0);
    expect(a.dPrimeMeters).toBeGreaterThan(0);
    expect(a.evidence.length).toBeGreaterThanOrEqual(3);
    expect(a.confidence).toBe("high");
  });

  it("is unavailable with a limitation when efforts are too few", () => {
    const efforts = [effort(2.2, 400), effort(3.7, 700)];
    const a = assessCriticalSpeed(efforts);
    expect(a.available).toBe(false);
    expect(a.csMetersPerSec).toBeNull();
    expect(a.limitations.length).toBeGreaterThan(0);
  });
});

describe("assessFatigueResistance", () => {
  it("recovers the personal exponent and compares to the reference", () => {
    const efforts = powerLawEfforts(1.1, 240, [5, 8, 10, 15, 21], "2025-05-01");
    const a = assessFatigueResistance(efforts);
    expect(a.available).toBe(true);
    expect(a.exponent).toBeCloseTo(1.1, 1);
    expect(a.referenceExponent).toBe(1.06);
    // Exponent above 1.06 → fades more per doubling than the reference.
    expect(a.extraFadePerDoublingPct).toBeGreaterThan(0);
    expect(a.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it("reports a positive extra-fade when the athlete holds pace better", () => {
    const efforts = powerLawEfforts(1.02, 260, [5, 8, 10, 15, 21], "2025-05-01");
    const a = assessFatigueResistance(efforts);
    expect(a.exponent!).toBeLessThan(1.06);
    // Below reference → negative extra-fade (holds pace better).
    expect(a.extraFadePerDoublingPct!).toBeLessThan(0);
  });

  it("classifies a declining trend when recent efforts fade more", () => {
    const older = powerLawEfforts(1.04, 250, [5, 10, 15], "2025-01-01");
    const recent = powerLawEfforts(1.16, 230, [5, 10, 15], "2025-06-01");
    const a = assessFatigueResistance([...older, ...recent]);
    expect(a.trend).toBe("declining");
    expect(a.trendDetail).not.toBeNull();
  });

  it("is unavailable with a limitation when efforts are too few", () => {
    const a = assessFatigueResistance([effort(5, 1200), effort(10, 2600)]);
    expect(a.available).toBe(false);
    expect(a.exponent).toBeNull();
    expect(a.trend).toBeNull();
    expect(a.limitations.length).toBeGreaterThan(0);
  });
});

/** Pace stream with a controllable first→last-third fade (12 points). */
function paceStream(firstPace: number, lastPace: number) {
  const midPace = (firstPace + lastPace) / 2;
  const out: { elapsedSec: number; paceSecPerKm: number }[] = [];
  const paces = [
    firstPace,
    firstPace,
    firstPace,
    firstPace,
    midPace,
    midPace,
    midPace,
    midPace,
    lastPace,
    lastPace,
    lastPace,
    lastPace,
  ];
  paces.forEach((p, i) => out.push({ elapsedSec: i * 60, paceSecPerKm: p }));
  return out;
}

function mockFit(
  activityId: string,
  hrDriftPct: number | null,
  fade: { first: number; last: number } | null,
): FitRunDetail {
  return {
    activityId,
    bestEfforts: [],
    laps: [],
    hrStream: [],
    paceStream: fade ? paceStream(fade.first, fade.last) : [],
    cadenceStream: [],
    gpsStream: [],
    hrDriftPct,
    avgCadence: null,
  };
}

describe("assessDurability", () => {
  it("scores strong when HR drift is low and pace holds", () => {
    const runs = [mockRun("1", 12, 5), mockRun("2", 14, 5.1), mockRun("3", 16, 5.2)];
    const fits = [
      mockFit("1", 2, { first: 300, last: 300 }),
      mockFit("2", 3, { first: 300, last: 301 }),
      mockFit("3", 1, { first: 300, last: 299 }),
    ];
    const a = assessDurability(runs, fits);
    expect(a.available).toBe(true);
    expect(a.label).toBe("strong");
    expect(a.score!).toBeGreaterThanOrEqual(72);
    expect(a.sampleSize).toBe(3);
  });

  it("scores weak when HR drift and late fade are high", () => {
    const runs = [mockRun("1", 12, 5), mockRun("2", 14, 5.1), mockRun("3", 16, 5.2)];
    const fits = [
      mockFit("1", 12, { first: 300, last: 324 }), // +8% fade
      mockFit("2", 13, { first: 300, last: 327 }),
      mockFit("3", 11, { first: 300, last: 321 }),
    ];
    const a = assessDurability(runs, fits);
    expect(a.available).toBe(true);
    expect(a.label).toBe("weak");
    expect(a.score!).toBeLessThan(48);
    expect(a.decouplingMedianPct!).toBeGreaterThan(0);
    expect(a.lateFadeMedianPct!).toBeGreaterThan(0);
  });

  it("is unavailable when there are no long runs with streams", () => {
    const runs = [mockRun("1", 5, 5)]; // too short to qualify
    const a = assessDurability(runs, [mockFit("1", 3, null)]);
    expect(a.available).toBe(false);
    expect(a.score).toBeNull();
    expect(a.limitations.length).toBeGreaterThan(0);
  });

  it("detects a declining trend when recent long runs fade more", () => {
    const runs = [
      mockRun("1", 14, 5, "2025-01-01"),
      mockRun("2", 14, 5, "2025-02-01"),
      mockRun("3", 14, 5, "2025-06-01"),
      mockRun("4", 14, 5, "2025-07-01"),
    ];
    const fits = [
      mockFit("1", 2, { first: 300, last: 300 }),
      mockFit("2", 2, { first: 300, last: 301 }),
      mockFit("3", 12, { first: 300, last: 327 }),
      mockFit("4", 13, { first: 300, last: 330 }),
    ];
    const a = assessDurability(runs, fits);
    expect(a.trend).toBe("declining");
  });
});

describe("assessThresholdEconomy", () => {
  it("estimates LT pace/HR from tempo sessions", () => {
    const runs = [
      runHr("t1", 8, 4.0, 170, "2025-05-01"),
      runHr("t2", 6, 4.05, 172, "2025-05-10"),
      runHr("t3", 7, 3.95, 168, "2025-05-20"),
    ];
    const labels = [
      label("t1", "tempo", "2025-05-01"),
      label("t2", "tempo", "2025-05-10"),
      label("t3", "tempo", "2025-05-20"),
    ];
    const a = assessThresholdEconomy(runs, { workoutLabels: labels, athleteMaxHr: 190 });
    expect(a.available).toBe(true);
    expect(a.ltPaceSecPerKm).toBeCloseTo(240, -1); // ~4:00/km
    expect(a.ltHr).toBe(170);
    expect(a.ltPctMaxHr).toBeCloseTo(170 / 190, 2);
    expect(a.thresholdSampleSize).toBe(3);
  });

  it("detects an improving economy trend (faster GAP at same HR)", () => {
    const runs: RunActivity[] = [];
    const labels: RunWorkoutLabel[] = [];
    // 4 older easy runs at 5:00/km, 4 recent at 4:45/km — same HR → economy improves.
    for (let i = 0; i < 4; i++) {
      const d = `2025-01-0${i + 1}`;
      runs.push(runHr(`o${i}`, 10, 5.0, 150, d));
      labels.push(label(`o${i}`, "easy", d));
    }
    for (let i = 0; i < 4; i++) {
      const d = `2025-06-0${i + 1}`;
      runs.push(runHr(`r${i}`, 10, 4.75, 150, d));
      labels.push(label(`r${i}`, "easy", d));
    }
    const a = assessThresholdEconomy(runs, { workoutLabels: labels, athleteMaxHr: 190 });
    expect(a.economyTrend).toBe("improving");
    expect(a.economySampleSize).toBe(8);
  });

  it("is unavailable without workout labels", () => {
    const runs = [runHr("t1", 8, 4.0, 170)];
    const a = assessThresholdEconomy(runs, {});
    expect(a.available).toBe(false);
    expect(a.limitations.length).toBeGreaterThan(0);
  });

  it("tracks economy but flags missing threshold when no tempo work", () => {
    const runs = [runHr("e1", 10, 5.0, 150, "2025-05-01"), runHr("e2", 10, 5.1, 151, "2025-05-08")];
    const labels = [label("e1", "easy", "2025-05-01"), label("e2", "easy", "2025-05-08")];
    const a = assessThresholdEconomy(runs, { workoutLabels: labels, athleteMaxHr: 190 });
    expect(a.available).toBe(true);
    expect(a.ltPaceSecPerKm).toBeNull();
    expect(a.economyIndex).not.toBeNull();
    expect(a.limitations.some((l) => /tempo\/threshold/i.test(l))).toBe(true);
  });
});

function runTemp(
  id: string,
  km: number,
  paceMinPerKm: number,
  avgHr: number,
  tempC: number,
  date: string,
): RunActivity {
  return { ...mockRun(id, km, paceMinPerKm, date), avgHr, weatherTempC: tempC };
}

describe("heatAdjustedPaceSecPerKm", () => {
  it("leaves pace unchanged at the reference temperature", () => {
    expect(heatAdjustedPaceSecPerKm(300, 15, 15)).toBeCloseTo(300, 5);
  });

  it("credits heat above the reference (cool-equivalent is faster)", () => {
    const adj = heatAdjustedPaceSecPerKm(300, 28, 15); // 13°C over → /1.039
    expect(adj).toBeLessThan(300);
    expect(adj).toBeCloseTo(300 / (1 + 13 * 0.003), 3);
  });
});

describe("assessConditionNormalization", () => {
  it("normalizes for heat and surfaces a hot-run example", () => {
    const runs: RunActivity[] = [];
    // 6 cool runs at 5:00/km, HR 150.
    for (let i = 0; i < 6; i++) {
      runs.push(runTemp(`c${i}`, 10, 5.0, 150, 15, `2025-05-0${i + 1}`));
    }
    // 2 hot runs at 30°C, slower raw pace (heat tax), same HR.
    runs.push(runTemp("h1", 10, 5.25, 150, 30, "2025-05-20"));
    runs.push(runTemp("h2", 10, 5.25, 150, 30, "2025-05-21"));

    const a = assessConditionNormalization(runs);
    expect(a.available).toBe(true);
    expect(a.hotRunCount).toBeGreaterThanOrEqual(2);
    expect(a.example).not.toBeNull();
    expect(a.example!.tempC).toBe(30);
    // Once heat is removed, the hot run reads better (lower z) than raw.
    expect(a.example!.normalizedZScore).toBeLessThan(a.example!.rawZScore);
    expect(a.example!.normalizedPaceSecPerKm).toBeLessThan(a.example!.rawPaceSecPerKm);
  });

  it("is unavailable when weather coverage is thin", () => {
    const runs = [
      runTemp("t1", 10, 5.0, 150, 18, "2025-05-01"),
      runTemp("t2", 10, 5.0, 150, 18, "2025-05-02"),
      mockRun("n1", 10, 5.0, "2025-05-03"), // no temp
    ];
    const a = assessConditionNormalization(runs);
    expect(a.available).toBe(false);
    expect(a.limitations.length).toBeGreaterThan(0);
  });
});

describe("computePhysiology", () => {
  it("produces a critical-speed assessment from runs", () => {
    // Distances/paces chosen to land several full-run efforts in the 2–30 min band.
    const runs = [
      mockRun("1", 3, 3.6), // ~648 s
      mockRun("2", 5, 3.9), // ~1170 s
      mockRun("3", 4, 3.75), // ~900 s
      mockRun("4", 6, 4.1), // ~1476 s
    ];
    const phys = computePhysiology(runs, []);
    expect(phys.criticalSpeed).toBeDefined();
    // Either a fit or an honest limitation — never a silent crash.
    if (phys.criticalSpeed.available) {
      expect(phys.criticalSpeed.csPaceSecPerKm).toBeGreaterThan(0);
    } else {
      expect(phys.criticalSpeed.limitations.length).toBeGreaterThan(0);
    }
  });
});
