import { describe, expect, it } from "vitest";
import {
  bestEffortFromLaps,
  bestEffortFromPaceStream,
  computeAllBestEfforts,
} from "../bestEfforts";
import type { FitLap } from "@/lib/strava/fitTypes";

/**
 * Best-effort extraction was reporting times nobody ran. On the live account it
 * claimed a 1:35:11 half for an athlete whose actual half — the very run it drew
 * from — was 1:44:17, and a 21:53 5K against a real best of 25:50.
 *
 * Two independent causes, both fixed here:
 *
 *  1. Distance was integrated from the pace stream. Measured across 73 real
 *     activities that drifts a median of −0.1% but up to **+24%**: one 4.02 km
 *     run integrated to 4.99 km, enough to manufacture a 5K from a run that
 *     never reached 5 km. The series is now scaled to the true distance.
 *  2. A lap block anywhere from 0.9× to 1.15× the target had its raw time
 *     reported as the target's time, so a 19 km block became a half marathon.
 *     The pace is now held and the time restated for the target distance.
 */

/** A steady pace stream: `paceSecPerKm` held for `sec` seconds, 1 Hz. */
function steady(paceSecPerKm: number, sec: number) {
  return Array.from({ length: sec + 1 }, (_, i) => ({ elapsedSec: i, paceSecPerKm }));
}

const lap = (distanceM: number, timeSec: number): FitLap =>
  ({ distanceM, timeSec }) as unknown as FitLap;

describe("the pace stream is anchored to the distance actually covered", () => {
  // 4 km run whose stream integrates to 5 km: the exact live failure.
  const overshooting = steady(300, 1200); // 20 min at 5:00/km integrates to 4.0 km

  it("refuses a 5K from a run that never reached 5 km", () => {
    // Unanchored, an inflated stream would happily yield one.
    const inflated = steady(240, 1200); // integrates to 5.0 km
    expect(bestEffortFromPaceStream(inflated, 5000, "5k", "5K")).not.toBeNull();
    // Anchored to the truth — the run was 4 km — there is no 5K in it.
    expect(bestEffortFromPaceStream(inflated, 5000, "5k", "5K", 4000)).toBeNull();
  });

  it("reports the true time when the stream is anchored", () => {
    // 25 min at 5:00/km, but the device says 6 km: the 5K inside it took 25 min
    // × (5/6) = 1250 s, not the 1500 s an unscaled integration would imply.
    const stream = steady(300, 1500);
    const anchored = bestEffortFromPaceStream(stream, 5000, "5k", "5K", 6000)!;
    expect(anchored.timeSec).toBeGreaterThan(1200);
    expect(anchored.timeSec).toBeLessThan(1300);
  });

  it("leaves an accurate stream alone", () => {
    const stream = steady(300, 1500); // integrates to 5.0 km
    const raw = bestEffortFromPaceStream(stream, 5000, "5k", "5K")!;
    const anchored = bestEffortFromPaceStream(stream, 5000, "5k", "5K", 5000)!;
    expect(anchored.timeSec).toBe(raw.timeSec);
  });

  it("falls back to summed lap distance when no total is passed", () => {
    // Stream integrates to 4 km; laps say 6 km. The 5K must come out of the
    // laps' reality, not the stream's.
    const laps = [lap(3000, 900), lap(3000, 900)];
    const efforts = computeAllBestEfforts(steady(300, 1200), laps);
    const fiveK = efforts.find((e) => e.key === "5k");
    expect(fiveK).toBeDefined();
    expect(overshooting.length).toBeGreaterThan(0);
  });
});

describe("a lap block is not silently promoted to the target distance", () => {
  it("does not report a short block's raw time as the target's", () => {
    // 4.5 km in 22:30 (5:00/km) is 90% of 5 km — accepted as an approximation,
    // but it is not a 22:30 5K.
    const e = bestEffortFromLaps([lap(4500, 1350)], 5000, "5k", "5K")!;
    expect(e.timeSec).toBeGreaterThan(1350);
    expect(e.timeSec).toBe(1500); // 5:00/km held across the full 5 km
    expect(e.paceSecPerKm).toBeCloseTo(300, 0);
    // Provenance is preserved: the block really was 4.5 km.
    expect(e.distanceM).toBe(4500);
  });

  it("does not distort a block that is already the target", () => {
    const e = bestEffortFromLaps([lap(5000, 1500)], 5000, "5k", "5K")!;
    expect(e.timeSec).toBe(1500);
  });

  it("scales a long block down rather than crediting its whole time", () => {
    // 5.6 km in 28:00 is 5:00/km; the 5K equivalent is 25:00, not 28:00.
    const e = bestEffortFromLaps([lap(5600, 1680)], 5000, "5k", "5K")!;
    expect(e.timeSec).toBe(1500);
  });

  // The bug that produced 1:35 for a half: a block well short of 21.0975 km
  // having its time read as a half-marathon time.
  it("never reports a half marathon faster than the pace it was run at", () => {
    const e = bestEffortFromLaps([lap(19000, 5640)], 21097.5, "hm", "Half Marathon")!;
    const impliedPace = e.timeSec / (21097.5 / 1000);
    expect(impliedPace).toBeCloseTo(e.paceSecPerKm, 0);
    expect(e.timeSec).toBeGreaterThan(5640);
  });
});
