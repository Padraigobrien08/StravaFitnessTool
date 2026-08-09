import { describe, expect, it } from "vitest";
import { buildAdaptivePlanningNotes } from "../planningContext";
import type { AthleteBelief, AthleteMemoryProfile } from "@/lib/athlete-memory/types";
import type { AdaptationSignal } from "@/lib/adaptation-engine";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning";

/**
 * These notes are injected into the weekly-plan prompt, so they are one of the few
 * places where what the system has *learned* changes what it *prescribes*. Untested
 * until now.
 *
 * The behaviour that matters is restraint: a note only appears when a belief or signal
 * is specific enough to act on, and race-week advice only appears during race week.
 */

function belief(over: Partial<AthleteBelief> = {}): AthleteBelief {
  return {
    id: "b1",
    category: "fatigue",
    statement: "Hard sessions stacked back to back blunt this athlete's next quality day",
    confidence: "high",
    evidence: [],
    counterEvidence: [],
    lastUpdated: "2026-02-01T00:00:00.000Z",
    stability: "stable",
    recommendedUse: "leave 48h between hard days",
    ...over,
  };
}

function memory(beliefs: AthleteBelief[]): AthleteMemoryProfile {
  const byCategory = (c: string) => beliefs.filter((b) => b.category === c);
  return {
    generatedAt: "2026-02-10T00:00:00.000Z",
    adaptationPatterns: byCategory("adaptation"),
    fatiguePatterns: byCategory("fatigue"),
    pacingPatterns: byCategory("pacing"),
    taperResponses: byCategory("taper"),
    modalityInteractions: byCategory("modality"),
    durabilitySignals: byCategory("durability"),
    recommendationOutcomes: [],
  };
}

function signal(over: Partial<AdaptationSignal> = {}): AdaptationSignal {
  return {
    id: "s1",
    category: "freshness",
    statement: "Freshness is sensitive to hard-day density in this athlete",
    confidence: "medium",
    supportingEvidence: [],
    contradictoryEvidence: [],
    stability: "stable",
    ...over,
  };
}

let outcomeSeq = 0;

function outcome(evaluation: string): TrackedRecommendationOutcome {
  return {
    // Deterministic ids: a clock-derived one would vary between runs, and the
    // time-travel CI job exists to catch exactly that kind of drift.
    recommendationId: `o-${evaluation}-${++outcomeSeq}`,
    issuedAt: "2026-02-01T00:00:00.000Z",
    evaluatedAt: "2026-02-05T00:00:00.000Z",
    recommendation: "Do the thing",
    expectedOutcome: [],
    observedSignals: [],
    evaluation,
    confidenceBefore: 0.5,
    evidence: [],
  } as unknown as TrackedRecommendationOutcome;
}

const build = (p: Parameters<typeof buildAdaptivePlanningNotes>[0]) =>
  buildAdaptivePlanningNotes(p);

describe("beliefs become planning notes only when specific", () => {
  it("turns a fatigue belief about stacking into its recommended use", () => {
    const notes = build({ memory: memory([belief()]), adaptationSignals: [], outcomes: [] });
    expect(notes.join(" ")).toMatch(/leave 48h between hard days/);
  });

  it("ignores a fatigue belief that is not about density or hard days", () => {
    const vague = belief({ statement: "This athlete sleeps poorly before races" });
    const notes = build({ memory: memory([vague]), adaptationSignals: [], outcomes: [] });
    expect(notes).toEqual([]);
  });

  it("withholds taper guidance outside race week", () => {
    const taper = belief({ category: "taper", recommendedUse: "hold two quality touches" });
    const normal = build({ memory: memory([taper]), adaptationSignals: [], outcomes: [] });
    const raceWeek = build({
      memory: memory([taper]),
      adaptationSignals: [],
      outcomes: [],
      raceWeek: true,
    });
    expect(normal).toEqual([]);
    expect(raceWeek.join(" ")).toMatch(/hold two quality touches/);
  });

  it("adds an interference note for a modality belief", () => {
    const modality = belief({
      category: "modality",
      statement: "Hard cycling near key runs shows interference for this athlete",
    });
    const notes = build({ memory: memory([modality]), adaptationSignals: [], outcomes: [] });
    expect(notes.join(" ")).toMatch(/separate hard cross-training/);
  });
});

describe("adaptation signals", () => {
  it("uses a freshness signal about density", () => {
    const notes = build({ memory: memory([]), adaptationSignals: [signal()], outcomes: [] });
    expect(notes.join(" ")).toMatch(/avoid stacking hard sessions/);
  });

  // A low-confidence signal is not evidence enough to shape a week's prescription.
  it("ignores a low-confidence signal", () => {
    const notes = build({
      memory: memory([]),
      adaptationSignals: [signal({ confidence: "low" })],
      outcomes: [],
    });
    expect(notes).toEqual([]);
  });

  it("keeps threshold support when the athlete responds well to it", () => {
    const notes = build({
      memory: memory([]),
      adaptationSignals: [
        signal({
          category: "threshold",
          statement: "This athlete responds well to threshold work",
        }),
      ],
      outcomes: [],
    });
    expect(notes.join(" ")).toMatch(/maintain threshold support/);
  });
});

describe("outcomes bias the plan conservative", () => {
  it("says nothing after a single contradicted recommendation", () => {
    const notes = build({
      memory: memory([]),
      adaptationSignals: [],
      outcomes: [outcome("contradicted")],
    });
    expect(notes.join(" ")).not.toMatch(/bias conservative/);
  });

  /**
   * Two is the threshold. One contradicted recommendation is noise — training is noisy
   * and a single miss should not make the planner flinch; a pattern of two should.
   */
  it("biases conservative once two have been contradicted", () => {
    const notes = build({
      memory: memory([]),
      adaptationSignals: [],
      outcomes: [outcome("contradicted"), outcome("contradicted")],
    });
    expect(notes.join(" ")).toMatch(/bias conservative until patterns clarify/);
  });

  it("does not count supported outcomes toward the threshold", () => {
    const notes = build({
      memory: memory([]),
      adaptationSignals: [],
      outcomes: [outcome("contradicted"), outcome("supported"), outcome("supported")],
    });
    expect(notes.join(" ")).not.toMatch(/bias conservative/);
  });
});

describe("output shape", () => {
  it("deduplicates identical notes", () => {
    const twoSignals = [signal({ id: "a" }), signal({ id: "b" })]; // same statement text
    const notes = build({ memory: memory([]), adaptationSignals: twoSignals, outcomes: [] });
    expect(new Set(notes).size).toBe(notes.length);
  });

  it("caps at eight notes so the plan prompt cannot be swamped", () => {
    const signals = Array.from({ length: 30 }, (_, i) =>
      signal({ id: `s${i}`, statement: `Freshness is sensitive to density, variant ${i}` }),
    );
    const notes = build({ memory: memory([]), adaptationSignals: signals, outcomes: [] });
    expect(notes.length).toBeLessThanOrEqual(8);
  });

  it("returns an empty array for an athlete with nothing learned", () => {
    expect(build({ memory: memory([]), adaptationSignals: [], outcomes: [] })).toEqual([]);
  });
});
