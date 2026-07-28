import { describe, it, expect } from "vitest";
import {
  computeFeelCalibration,
  DEFAULT_FEEL_CALIBRATION,
  type FeelHistoryPoint,
  type WeeklyLoadLite,
} from "@/lib/wellness/calibration";

// Six weeks spanning TSB [-20, -10, 0, 5, 10, 20] → median 2.5.
const WEEKS: WeeklyLoadLite[] = [
  { weekStart: "2026-01-05", ctl: 50, atl: 70 }, // -20
  { weekStart: "2026-01-12", ctl: 50, atl: 60 }, // -10
  { weekStart: "2026-01-19", ctl: 50, atl: 50 }, // 0
  { weekStart: "2026-01-26", ctl: 55, atl: 50 }, // +5
  { weekStart: "2026-02-02", ctl: 60, atl: 50 }, // +10
  { weekStart: "2026-02-09", ctl: 70, atl: 50 }, // +20
];

const feel = (date: string, legs: FeelHistoryPoint["legs"]): FeelHistoryPoint => ({ date, legs });

describe("computeFeelCalibration", () => {
  it("returns the default when there isn't enough load history", () => {
    expect(computeFeelCalibration([feel("2026-01-06", "heavy")], WEEKS.slice(0, 2))).toEqual(
      DEFAULT_FEEL_CALIBRATION,
    );
  });

  it("returns the default (but counts) below the sample threshold", () => {
    const c = computeFeelCalibration([feel("2026-01-06", "heavy")], WEEKS);
    expect(c.heavyDelta).toBe(DEFAULT_FEEL_CALIBRATION.heavyDelta);
    expect(c.freshDelta).toBe(DEFAULT_FEEL_CALIBRATION.freshDelta);
    expect(c.sampleCount).toBe(1);
  });

  it("amplifies the nudge when reports reliably track the load model", () => {
    const reports = [
      feel("2026-01-06", "heavy"), // week -20 (below median) ✓
      feel("2026-01-13", "heavy"), // week -10 ✓
      feel("2026-02-03", "fresh"), // week +10 (above median) ✓
      feel("2026-02-10", "fresh"), // week +20 ✓
      feel("2026-01-20", "normal"), // ignored (non-directional)
    ];
    const c = computeFeelCalibration(reports, WEEKS);
    expect(c.reliability).toBe(1);
    expect(c.sampleCount).toBe(4);
    expect(c.heavyDelta).toBeLessThan(DEFAULT_FEEL_CALIBRATION.heavyDelta); // stronger
    expect(c.freshDelta).toBeGreaterThan(DEFAULT_FEEL_CALIBRATION.freshDelta);
    expect(c.confidence).toBe("medium");
  });

  it("never dampens below the default when reports diverge from the model", () => {
    const reports = [
      feel("2026-02-10", "heavy"), // felt heavy on a high-balance week ✗
      feel("2026-02-03", "heavy"), // ✗
      feel("2026-01-06", "fresh"), // felt fresh on a low-balance week ✗
      feel("2026-01-13", "fresh"), // ✗
    ];
    const c = computeFeelCalibration(reports, WEEKS);
    expect(c.reliability).toBe(0);
    expect(c.heavyDelta).toBe(DEFAULT_FEEL_CALIBRATION.heavyDelta);
    expect(c.freshDelta).toBe(DEFAULT_FEEL_CALIBRATION.freshDelta);
  });

  it("stays within the hard caps", () => {
    const reports = [
      feel("2026-01-06", "heavy"),
      feel("2026-01-13", "heavy"),
      feel("2026-01-19", "heavy"),
      feel("2026-02-03", "fresh"),
      feel("2026-02-09", "fresh"),
    ];
    const c = computeFeelCalibration(reports, WEEKS);
    expect(c.heavyDelta).toBeGreaterThanOrEqual(-17);
    expect(c.freshDelta).toBeLessThanOrEqual(8);
  });
});
