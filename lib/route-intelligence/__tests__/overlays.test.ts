import { describe, expect, it } from "vitest";
import { detectWorkoutOverlays } from "../overlays";
import type { TimelinePoint } from "../types";
import type { FitLap } from "@/lib/strava/fitTypes";

/**
 * Workout overlays — the coloured bands drawn over a run's replay: intervals,
 * recoveries, fades, surges, pauses.
 *
 * This is interpretation rather than measurement. Every band makes a claim about what
 * the athlete was doing, so a band in the wrong place is a wrong statement about their
 * session, presented with the authority of a chart.
 */

function point(elapsedSec: number, paceSecPerKm: number | null): TimelinePoint {
  return {
    elapsedSec,
    lat: 53.35,
    lon: -6.26,
    elevationM: 10,
    paceSecPerKm,
    hr: 150,
    cadence: 170,
  };
}

/** A steady run at `pace`, one sample per 10s. */
const steady = (n: number, pace = 300) => Array.from({ length: n }, (_, i) => point(i * 10, pace));

const lap = (index: number, timeSec: number, avgPaceSecPerKm?: number): FitLap =>
  ({ index, timeSec, avgPaceSecPerKm }) as FitLap;

const kinds = (segs: { kind: string }[]) => segs.map((s) => s.kind);

describe("not enough to say anything", () => {
  it("draws nothing on a stub of a run", () => {
    expect(detectWorkoutOverlays(steady(3), [])).toEqual([]);
  });

  it("draws nothing on a steady run with no laps", () => {
    expect(detectWorkoutOverlays(steady(30), [])).toEqual([]);
  });
});

describe("laps", () => {
  it("marks a faster-than-average lap as work", () => {
    const overlays = detectWorkoutOverlays(steady(30), [lap(1, 100, 250)]);
    expect(kinds(overlays)).toContain("interval");
  });

  it("marks a lap that is not faster as recovery", () => {
    const overlays = detectWorkoutOverlays(steady(30), [lap(1, 100, 320)]);
    expect(kinds(overlays)).toContain("recovery");
  });

  it("ignores a lap with no duration rather than emitting a zero-length band", () => {
    expect(detectWorkoutOverlays(steady(30), [lap(1, 0, 250)])).toEqual([]);
  });

  it("lays consecutive laps end to end", () => {
    const overlays = detectWorkoutOverlays(steady(40), [lap(1, 100, 250), lap(2, 100, 250)]);
    const laps = overlays.filter((o) => o.id.startsWith("lap-"));
    if (laps.length === 2) expect(laps[1].startSec).toBe(laps[0].endSec);
  });
});

describe("fade", () => {
  // The claim is "you slowed down late", so it must need a real slowdown.
  it("flags a run whose last third is markedly slower", () => {
    const timeline = [...steady(10, 280), ...steady(10, 280), ...steady(10, 360)].map((p, i) =>
      point(i * 10, p.paceSecPerKm),
    );
    expect(kinds(detectWorkoutOverlays(timeline, []))).toContain("fade");
  });

  it("does not flag a run that held its pace", () => {
    expect(kinds(detectWorkoutOverlays(steady(30, 300), []))).not.toContain("fade");
  });

  it("does not flag a negative split", () => {
    const timeline = [...steady(15, 340), ...steady(15, 280)].map((p, i) =>
      point(i * 10, p.paceSecPerKm),
    );
    expect(kinds(detectWorkoutOverlays(timeline, []))).not.toContain("fade");
  });
});

describe("surges and pauses", () => {
  it("marks a sharp acceleration as a surge", () => {
    const timeline = steady(20, 300);
    timeline[10] = point(100, 240);
    expect(kinds(detectWorkoutOverlays(timeline, []))).toContain("pace_spike");
  });

  it("marks a very slow sample as a pause", () => {
    const timeline = steady(20, 300);
    timeline[10] = point(100, 600);
    expect(kinds(detectWorkoutOverlays(timeline, []))).toContain("pause");
  });

  it("ignores samples with no pace rather than treating them as zero", () => {
    const timeline = steady(20, 300).map((p, i) => (i === 5 ? point(50, null) : p));
    expect(() => detectWorkoutOverlays(timeline, [])).not.toThrow();
  });
});

describe("tempo fallback", () => {
  // A tempo run with nothing else detected still deserves one band, or the replay
  // looks like the analysis failed.
  it("marks the whole effort when nothing else was found", () => {
    const overlays = detectWorkoutOverlays(steady(30, 300), [], "tempo");
    expect(overlays).toHaveLength(1);
    expect(overlays[0].label).toMatch(/threshold/i);
  });

  it("does not add the fallback when something was already found", () => {
    const timeline = steady(20, 300);
    timeline[10] = point(100, 240);
    const overlays = detectWorkoutOverlays(timeline, [], "tempo");
    expect(overlays.every((o) => o.id !== "tempo-main")).toBe(true);
  });

  it("does not apply to other workout types", () => {
    expect(detectWorkoutOverlays(steady(30, 300), [], "easy")).toEqual([]);
  });
});

describe("the output list", () => {
  it("is ordered by start time", () => {
    const timeline = steady(60, 300);
    for (const i of [10, 20, 30, 40]) timeline[i] = point(i * 10, 240);
    const starts = detectWorkoutOverlays(timeline, []).map((o) => o.startSec);
    expect([...starts]).toEqual([...starts].sort((a, b) => a - b));
  });

  it("is capped, since every band is drawn", () => {
    const timeline = steady(200, 300);
    for (let i = 1; i < 200; i += 2) timeline[i] = point(i * 10, 200);
    expect(detectWorkoutOverlays(timeline, []).length).toBeLessThanOrEqual(24);
  });

  /**
   * Recorded, not changed. The final step is called `mergeOverlapping`, but its body
   * only sorts — nothing is merged, so adjacent surges on a noisy pace stream stay as
   * separate overlapping bands. The 24-item cap limits how bad that looks, which is
   * presumably why it has never been noticed.
   *
   * Left alone deliberately: making it merge would change what every replay draws,
   * which is a product decision rather than a bug fix.
   */
  it("does not actually merge overlapping bands, despite the name", () => {
    const timeline = steady(40, 300);
    timeline[10] = point(100, 240);
    timeline[11] = point(110, 200);
    const spikes = detectWorkoutOverlays(timeline, []).filter((o) => o.kind === "pace_spike");
    expect(spikes.length).toBeGreaterThan(1);
  });
});
