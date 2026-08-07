import { describe, expect, it } from "vitest";
import { downsample, MAX_GPS_POINTS, MAX_STREAM_POINTS } from "../downsample";

/**
 * Stream downsampling — the bound between a FIT file's raw sample rate and what gets
 * stored per run and shipped to the browser.
 *
 * The audit filed the size claim as unverified (§F-7, remediation item 15). The
 * properties that actually matter are that the output is bounded, that it keeps the
 * first and last sample, and that it never contains holes: a chart plotting
 * `undefined` renders a break in the line rather than failing, so a hole here shows up
 * as a missing segment nobody can explain.
 */

const series = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("bounding the output", () => {
  it("returns the input untouched when it is already small enough", () => {
    const points = series(50);
    expect(downsample(points, 80)).toBe(points);
  });

  it("returns the input untouched at exactly the cap", () => {
    const points = series(80);
    expect(downsample(points, 80)).toBe(points);
  });

  it.each([
    [1_000, MAX_STREAM_POINTS],
    [100_000, MAX_STREAM_POINTS],
    [100_000, MAX_GPS_POINTS],
  ])("reduces %d points to exactly %d", (n, max) => {
    expect(downsample(series(n), max)).toHaveLength(max);
  });

  /**
   * The size claim item 15 asked about, stated as a bound rather than a benchmark: a
   * six-hour ultra at 1 Hz is roughly 21,600 samples, and what is stored per run must
   * not grow with the length of the run.
   */
  it("keeps a six-hour run's streams at the same size as a 30-minute one", () => {
    const short = downsample(series(1_800), MAX_STREAM_POINTS);
    const ultra = downsample(series(21_600), MAX_STREAM_POINTS);
    expect(ultra.length).toBe(short.length);
  });
});

describe("what survives the reduction", () => {
  // A route replay that loses its start or finish is visibly wrong on the map.
  it("keeps the first and last sample", () => {
    const out = downsample(series(5_000), MAX_GPS_POINTS);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(4_999);
  });

  it("never produces a hole", () => {
    const out = downsample(series(9_999), MAX_STREAM_POINTS);
    expect(out.every((v) => v !== undefined)).toBe(true);
  });

  it("keeps samples in order", () => {
    const out = downsample(series(9_999), MAX_STREAM_POINTS);
    expect([...out]).toEqual([...out].sort((a, b) => a - b));
  });

  it("spreads samples across the run rather than clustering at one end", () => {
    const out = downsample(series(10_000), 10);
    // Evenly spaced sampling puts the midpoint near the middle of the series.
    expect(out[5]).toBeGreaterThan(4_000);
    expect(out[5]).toBeLessThan(6_000);
  });
});

describe("degenerate inputs", () => {
  it("handles an empty stream", () => {
    expect(downsample([], MAX_STREAM_POINTS)).toEqual([]);
  });

  it("handles a single sample", () => {
    expect(downsample([42], MAX_STREAM_POINTS)).toEqual([42]);
  });

  /**
   * `step` is `(n - 1) / (max - 1)`, so `max === 1` divides by zero and every index
   * becomes `Math.round(0 * Infinity)` — `NaN`. `points[NaN]` is `undefined`, so the
   * function returns `[undefined]` rather than a sample.
   *
   * Not reachable from the current callers, which pass 80 and 500. Guarded anyway,
   * because a function that returns a hole for a legal argument is a trap for the next
   * caller rather than a documented limitation.
   */
  it("returns a real sample when asked for exactly one", () => {
    const out = downsample(series(1_000), 1);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeDefined();
  });

  it("returns nothing when asked for nothing", () => {
    expect(downsample(series(100), 0)).toEqual([]);
  });
});
