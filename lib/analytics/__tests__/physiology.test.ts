import { describe, expect, it } from "vitest";
import {
  assessCriticalSpeed,
  assessFatigueResistance,
  computePhysiology,
  criticalSpeedPredictSec,
  fitCriticalSpeed,
} from "../physiology";
import type { EffortPoint } from "../predictions";
import type { RunActivity } from "@/lib/strava/types";

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
