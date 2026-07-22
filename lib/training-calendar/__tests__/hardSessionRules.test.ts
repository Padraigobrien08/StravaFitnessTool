import { describe, expect, it } from "vitest";
import { isHardTrainingRun, isRaceDayWorkout } from "../hardSessionRules";

describe("hardSessionRules", () => {
  it("does not count pre-race shakeout as hard", () => {
    expect(
      isHardTrainingRun({
        modality: "run",
        type: "shakeout",
        title: "Pre-race shakeout",
        intensity: "easy",
      }),
    ).toBe(false);
  });

  it("does not count race day against training hard limit", () => {
    expect(
      isHardTrainingRun({
        modality: "run",
        type: "race",
        title: "Half marathon",
        intensity: "hard",
      }),
    ).toBe(false);
    expect(
      isRaceDayWorkout({
        modality: "run",
        type: "race",
        title: "Half marathon",
        intensity: "hard",
      }),
    ).toBe(true);
  });

  it("does not count easy strides as hard", () => {
    expect(
      isHardTrainingRun({
        modality: "run",
        type: "easy",
        title: "Strides",
        intensity: "easy",
      }),
    ).toBe(false);
  });

  it("counts tempo as hard training", () => {
    expect(
      isHardTrainingRun({
        modality: "run",
        type: "tempo",
        title: "Tempo run",
        intensity: "moderate",
      }),
    ).toBe(true);
  });
});
