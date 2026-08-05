import { describe, expect, it } from "vitest";
import { stripMedicalLanguage } from "../repairWeeklyPlan";
import type { WeeklyTrainingPlan } from "../types";

/**
 * Field coverage, not just vocabulary: softening previously touched only
 * `summary`, `purpose`, `reasoning` and `limitations`, so medical wording in the
 * rationale, alternatives, titles or constraints reached the athlete untouched.
 */
function planWithMedicalLanguageEverywhere(): WeeklyTrainingPlan {
  return {
    weekStart: "2026-08-10",
    planType: "build",
    summary: "We diagnose the issue and prescribe rest.",
    hardSessionCount: 1,
    totalRunDistanceKm: 20,
    workouts: [
      {
        day: "Monday",
        modality: "run",
        type: "prescribed easy",
        title: "Run that treats the legs",
        distanceKm: 8,
        intensity: "easy",
        purpose: "Healing the calves",
        constraintsApplied: ["Prescription from last week"],
        reasoning: "This cures the soreness",
      },
    ],
    rationale: {
      primaryGoal: "Treating the aerobic gap",
      evidenceUsed: ["Diagnosis from the last block"],
      tradeoffs: ["Guaranteed progress"],
      risksManaged: ["Prescribed recovery"],
    },
    confidence: "medium",
    limitations: ["Diagnosis is approximate"],
    alternatives: [
      {
        name: "Healing week",
        summary: "A week that treats fatigue",
        changes: ["Prescribe two rest days"],
      },
    ],
  };
}

describe("stripMedicalLanguage", () => {
  const cleaned = stripMedicalLanguage(planWithMedicalLanguageEverywhere());

  it("softens every prose field, including rationale and alternatives", () => {
    const blob = JSON.stringify(cleaned).toLowerCase();
    for (const term of ["diagnos", "prescri", "treat", "cure", "heal", "guaranteed"]) {
      expect(blob, `"${term}" survived softening`).not.toContain(term);
    }
  });

  it("produces grammatical replacements", () => {
    expect(cleaned.summary).toBe("We assess the issue and suggest rest.");
    expect(cleaned.workouts[0].title).toBe("Run that supports the legs");
    expect(cleaned.workouts[0].purpose).toBe("Recovery the calves");
    expect(cleaned.workouts[0].reasoning).toBe("This helps the soreness");
    expect(cleaned.rationale.primaryGoal).toBe("Supporting the aerobic gap");
    expect(cleaned.rationale.tradeoffs[0]).toBe("Likely progress");
    expect(cleaned.alternatives?.[0].changes[0]).toBe("Suggest two rest days");
  });

  it("leaves structural fields untouched", () => {
    expect(cleaned.weekStart).toBe("2026-08-10");
    expect(cleaned.planType).toBe("build");
    expect(cleaned.workouts[0].day).toBe("Monday");
    expect(cleaned.workouts[0].modality).toBe("run");
    expect(cleaned.workouts[0].intensity).toBe("easy");
    expect(cleaned.workouts[0].distanceKm).toBe(8);
  });

  it("handles a plan with no alternatives", () => {
    const base = planWithMedicalLanguageEverywhere();
    delete base.alternatives;
    expect(() => stripMedicalLanguage(base)).not.toThrow();
    expect(stripMedicalLanguage(base).alternatives).toBeUndefined();
  });
});
