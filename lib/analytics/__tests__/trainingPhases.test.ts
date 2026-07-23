import { describe, expect, it } from "vitest";
import { detectTrainingPhases, type PhaseWeek, type TrainingPhasesInput } from "../trainingPhases";
import { addWeeks, format } from "date-fns";

const MONDAY0 = new Date("2026-01-05T00:00:00.000Z"); // a Monday

function weekKey(i: number): string {
  return format(addWeeks(MONDAY0, i), "yyyy-MM-dd");
}

/** Build a dense week grid from (distanceKm, hardShare) pairs. */
function grid(specs: { km: number; hard?: number; runs?: number; ctl?: number }[]): PhaseWeek[] {
  return specs.map((s, i) => ({
    weekStart: weekKey(i),
    distanceKm: s.km,
    runCount: s.runs ?? (s.km > 0 ? 4 : 0),
    hardShare: s.hard ?? 0,
    ctl: s.ctl ?? null,
  }));
}

function input(weeks: PhaseWeek[], raceDate: string | null = null): TrainingPhasesInput {
  return { weeks, raceDate };
}

describe("detectTrainingPhases", () => {
  it("returns nothing with too little history", () => {
    expect(detectTrainingPhases(input(grid([{ km: 40 }, { km: 40 }])))).toEqual([]);
  });

  it("segments a base → build → sharpening arc", () => {
    const phases = detectTrainingPhases(
      input(
        grid([
          // base: steady ~40, low intensity
          { km: 40 },
          { km: 41 },
          { km: 40 },
          { km: 41 },
          // build: rising volume
          { km: 46 },
          { km: 50 },
          { km: 55 },
          { km: 60 },
          // sharpening: high hard share, volume held
          { km: 58, hard: 0.4 },
          { km: 60, hard: 0.4 },
          { km: 59, hard: 0.4 },
        ]),
      ),
    );
    const types = phases.map((p) => p.type);
    expect(types).toContain("base");
    expect(types).toContain("build");
    expect(types).toContain("peak");
    // chronological, contiguous
    expect(phases[0].startWeek < phases[phases.length - 1].endWeek).toBe(true);
    for (const p of phases) expect(p.characterization.length).toBeGreaterThan(0);
  });

  it("detects a gap (off) phase from zero-volume weeks", () => {
    const phases = detectTrainingPhases(
      input(
        grid([
          { km: 40 },
          { km: 41 },
          { km: 40 },
          { km: 42 },
          { km: 0 },
          { km: 0 },
          { km: 30 },
          { km: 38 },
          { km: 40 },
        ]),
      ),
    );
    expect(phases.some((p) => p.type === "gap")).toBe(true);
  });

  it("detects a recovery dip after a bigger block", () => {
    const phases = detectTrainingPhases(
      input(
        grid([{ km: 55 }, { km: 58 }, { km: 60 }, { km: 30 }, { km: 28 }, { km: 56 }, { km: 58 }]),
      ),
    );
    expect(phases.some((p) => p.type === "recovery")).toBe(true);
  });

  it("detects a taper when volume eases inside the race window", () => {
    // 10 weeks; race 5 days after the last week → last weeks are inside 21d window.
    const weeks = grid([
      { km: 55 },
      { km: 58 },
      { km: 60 },
      { km: 58 },
      { km: 60 },
      { km: 58 },
      { km: 60 },
      { km: 45 },
      { km: 35 },
      { km: 25 },
    ]);
    const raceDate = format(addWeeks(MONDAY0, 9).valueOf() + 5 * 86400000, "yyyy-MM-dd");
    const phases = detectTrainingPhases(input(weeks, raceDate));
    expect(phases.some((p) => p.type === "taper")).toBe(true);
  });

  it("does not emit one-week islands (except gap/taper)", () => {
    const phases = detectTrainingPhases(
      input(
        grid([
          { km: 40 },
          { km: 41 },
          { km: 60, hard: 0.5 }, // lone spike — should be smoothed into neighbours
          { km: 40 },
          { km: 41 },
          { km: 40 },
        ]),
      ),
    );
    for (const p of phases) {
      if (p.type !== "gap" && p.type !== "taper") {
        expect(p.weeks).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
