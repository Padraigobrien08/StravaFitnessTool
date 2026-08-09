import { describe, expect, it } from "vitest";
import { scoreForecast, summarizeCalibration, type LoggedForecast } from "../calibration";
import type { EffortPoint } from "@/lib/analytics/predictions";

function forecast(overrides: Partial<LoggedForecast> = {}): LoggedForecast {
  return {
    forecastId: "forecast:hm:2026-05-01",
    distanceKey: "hm",
    distanceMeters: 21097,
    issuedAt: "2026-05-01T08:00:00.000Z",
    mostLikelyTimeSec: 5400, // 1:30:00
    outerLowSec: 5250,
    innerLowSec: 5330,
    innerHighSec: 5470,
    outerHighSec: 5550,
    ...overrides,
  };
}

function effort(distanceKm: number, timeSec: number, date: string): EffortPoint {
  return { distanceKm, timeSec, runId: `${date}`, runName: "race", date, source: "race" };
}

describe("scoreForecast", () => {
  it("stays pending when no effort at the distance has happened since issue", () => {
    const scored = scoreForecast(forecast(), [effort(10, 2400, "2026-06-01")]); // wrong distance
    expect(scored.actualTimeSec).toBeUndefined();
  });

  it("ignores efforts before the forecast was issued", () => {
    const scored = scoreForecast(forecast(), [effort(21.1, 5400, "2026-04-01")]);
    expect(scored.actualTimeSec).toBeUndefined();
  });

  it("scores against the earliest matching effort after issue, inside the interval", () => {
    const scored = scoreForecast(forecast(), [
      effort(21.0, 5420, "2026-06-10"),
      effort(21.2, 5300, "2026-07-01"),
    ]);
    expect(scored.actualTimeSec).toBe(5420); // earliest match
    expect(scored.withinBand).toBe(true); // 5420 in [5250, 5550]
    expect(scored.signedErrorSec).toBe(5420 - 5400);
  });

  it("marks an actual outside outerLowSec–outerHighSec as not within interval", () => {
    const scored = scoreForecast(forecast(), [effort(21.1, 5800, "2026-06-10")]); // way slower
    expect(scored.withinBand).toBe(false);
    expect(scored.signedErrorSec).toBe(400); // ran slower → model optimistic
  });

  it("does not re-score an already-scored forecast", () => {
    const already = forecast({ actualTimeSec: 5400, withinBand: true });
    const scored = scoreForecast(already, [effort(21.1, 5800, "2026-06-10")]);
    expect(scored.actualTimeSec).toBe(5400);
  });

  // The effort set is not race-only, so a slow training run in the distance band
  // must not be mistaken for the athlete's race result.
  it("ignores an easy long run in the distance band", () => {
    // 2:10:00 for 21 km — 40% slower than outerHighSec, i.e. nobody raced this.
    const scored = scoreForecast(forecast(), [effort(21.0, 7800, "2026-05-04")]);
    expect(scored.actualTimeSec).toBeUndefined();
    expect(scored.withinBand).toBeUndefined();
  });

  it("scores the real race even when an easy run happened first", () => {
    const scored = scoreForecast(forecast(), [
      effort(21.0, 7800, "2026-05-04"), // easy long run, three days later
      effort(21.1, 5390, "2026-06-01"), // the actual goal race
    ]);
    expect(scored.actualTimeSec).toBe(5390);
    expect(scored.actualDate).toBe("2026-06-01");
    expect(scored.withinBand).toBe(true);
    expect(scored.signedErrorSec).toBe(-10);
  });

  it("still counts a genuinely bad race as a miss", () => {
    // 1:44:10 — a blow-up, but a real attempt: must not be filtered away, or
    // calibration would only ever see the model's successes.
    const scored = scoreForecast(forecast(), [effort(21.1, 6250, "2026-06-10")]);
    expect(scored.actualTimeSec).toBe(6250);
    expect(scored.withinBand).toBe(false);
    expect(scored.signedErrorSec).toBe(850);
  });
});

describe("summarizeCalibration", () => {
  it("reports nulls with nothing scored", () => {
    const s = summarizeCalibration([forecast(), forecast({ forecastId: "f2" })]);
    expect(s.evaluated).toBe(0);
    expect(s.outerBandHitRatePct).toBeNull();
  });

  it("computes hit rates and bias across scored forecasts", () => {
    const scored: LoggedForecast[] = [
      forecast({ forecastId: "a", actualTimeSec: 5420, withinBand: true, signedErrorSec: 20 }),
      forecast({
        forecastId: "b",
        actualTimeSec: 5800,
        withinBand: false,
        signedErrorSec: 400,
      }),
      forecast({ forecastId: "c", actualTimeSec: 5410, withinBand: true, signedErrorSec: 10 }),
    ];
    const s = summarizeCalibration(scored);
    expect(s.evaluated).toBe(3);
    expect(s.outerBandHitRatePct).toBe(67); // 2 of 3
    expect(s.medianSignedErrorSec).toBe(20); // median(20,400,10)
    expect(s.meanAbsErrorSec).toBe(Math.round((20 + 400 + 10) / 3));
  });
});
