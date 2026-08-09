import { describe, expect, it } from "vitest";
import { buildLearningObservabilityReport } from "../buildLearningReport";
import type { AthleteBelief, AthleteMemoryProfile } from "@/lib/athlete-memory/types";
import type { AdaptationSignal } from "@/lib/adaptation-engine";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning";

/**
 * `lib/learning-observability` shipped with no tests, which matters more than its size
 * suggests: it is the surface that answers "is the learning loop actually doing
 * anything?" — the question docs/LIMITATIONS.md says has never been answered over a real
 * production window. If this report is wrong, the evidence used to check the claim is
 * wrong too.
 */

function belief(id: string, over: Partial<AthleteBelief> = {}): AthleteBelief {
  return {
    id,
    category: "adaptation",
    statement: `Belief ${id} about how this athlete responds to training load`,
    confidence: "high",
    evidence: ["ev"],
    counterEvidence: [],
    lastUpdated: "2026-02-01T00:00:00.000Z",
    stability: "stable",
    recommendedUse: "use it",
    ...over,
  };
}

function memory(beliefs: AthleteBelief[] = []): AthleteMemoryProfile {
  return {
    generatedAt: "2026-02-10T00:00:00.000Z",
    adaptationPatterns: beliefs,
    fatiguePatterns: [],
    pacingPatterns: [],
    taperResponses: [],
    modalityInteractions: [],
    durabilitySignals: [],
    recommendationOutcomes: [],
  };
}

function outcome(id: string, over: Partial<TrackedRecommendationOutcome> = {}) {
  return {
    recommendationId: id,
    issuedAt: "2026-02-01T00:00:00.000Z",
    evaluatedAt: "2026-02-05T00:00:00.000Z",
    recommendation: `Recommendation ${id}`,
    expectedOutcome: [],
    observedSignals: ["signal a", "signal b", "signal c"],
    evaluation: "supported",
    confidenceBefore: 0.5,
    evidence: [],
    ...over,
  } as TrackedRecommendationOutcome;
}

function signal(id: string, over: Partial<AdaptationSignal> = {}): AdaptationSignal {
  return {
    id,
    category: "freshness",
    statement: `Signal ${id}`,
    confidence: "medium",
    supportingEvidence: [],
    contradictoryEvidence: [],
    stability: "emerging",
    ...over,
  };
}

const build = (over: Parameters<typeof buildLearningObservabilityReport>[0]) =>
  buildLearningObservabilityReport(over);

describe("contradictions and uncertainties", () => {
  it("reports a belief that has counter-evidence as a contradiction", () => {
    const r = build({
      memory: memory([belief("b1", { counterEvidence: ["ran well on stacked days"] })]),
      adaptationSignals: [],
      outcomes: [],
    });
    expect(r.contradictions).toHaveLength(1);
    expect(r.contradictions[0]).toMatch(/counter: ran well on stacked days/);
  });

  it("leaves contradictions empty when every belief is uncontested", () => {
    const r = build({ memory: memory([belief("b1")]), adaptationSignals: [], outcomes: [] });
    expect(r.contradictions).toEqual([]);
  });

  it("flags low-confidence and emerging beliefs as uncertainties", () => {
    const r = build({
      memory: memory([
        belief("low", { confidence: "low" }),
        belief("new", { stability: "emerging" }),
        belief("solid"),
      ]),
      adaptationSignals: [],
      outcomes: [],
    });
    expect(r.uncertainties).toHaveLength(2);
  });

  // Both lists are sliced. Without a cap a memory full of hedged beliefs would push
  // everything else off a fixed-height panel.
  it("caps contradictions and uncertainties at eight", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      belief(`b${i}`, { counterEvidence: ["c"], confidence: "low" }),
    );
    const r = build({ memory: memory(many), adaptationSignals: [], outcomes: [] });
    expect(r.contradictions).toHaveLength(8);
    expect(r.uncertainties).toHaveLength(8);
  });
});

describe("timeline", () => {
  it("orders newest first", () => {
    const r = build({
      memory: memory(),
      adaptationSignals: [],
      outcomes: [
        outcome("old", { evaluatedAt: "2026-01-01T00:00:00.000Z" }),
        outcome("new", { evaluatedAt: "2026-03-01T00:00:00.000Z" }),
      ],
    });
    expect(r.timeline.map((t) => t.at)).toEqual([
      "2026-03-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
  });

  it("dates an unevaluated outcome by when it was issued", () => {
    const r = build({
      memory: memory(),
      adaptationSignals: [],
      outcomes: [outcome("pending", { evaluatedAt: undefined })],
    });
    expect(r.timeline[0].at).toBe("2026-02-01T00:00:00.000Z");
  });

  it("includes emerging adaptation signals but not settled ones", () => {
    const r = build({
      memory: memory(),
      adaptationSignals: [signal("e"), signal("s", { stability: "stable" })],
      outcomes: [],
    });
    expect(r.timeline).toHaveLength(1);
    expect(r.timeline[0].type).toBe("adaptation");
  });

  it("caps the timeline at twelve entries", () => {
    const outcomes = Array.from({ length: 30 }, (_, i) => outcome(`o${i}`));
    const r = build({ memory: memory(), adaptationSignals: [], outcomes });
    expect(r.timeline.length).toBeLessThanOrEqual(12);
  });
});

describe("what the report does not yet observe", () => {
  /**
   * `confidenceChanges` is typed `BeliefConfidenceChange[]` — a six-field record of a
   * belief's confidence moving, with a reason and a timestamp — and is hardcoded to
   * `[]`. Nothing populates it and nothing reads it.
   *
   * This test exists to state that plainly rather than let the type imply otherwise.
   * The field names the one thing this module is for: a belief's confidence changing is
   * the observable event that would show the learning loop closing. Until something
   * fills it, docs/LIMITATIONS.md's "the learning loop has never been observed closing"
   * is not merely unproven — it is unobservable from here.
   *
   * If a future change populates it, delete this test. That is the point of it.
   */
  it("cannot yet show a belief's confidence changing", () => {
    const r = build({
      memory: memory([belief("b1", { confidence: "low" })]),
      adaptationSignals: [signal("s")],
      outcomes: [outcome("o", { confidenceBefore: 0.2, confidenceAfter: 0.9 })],
    });
    // An outcome that moved confidence from 0.2 to 0.9 is exactly the event the field
    // is named for, and it still records nothing.
    expect(r.confidenceChanges).toEqual([]);
  });
});

describe("passthrough and shape", () => {
  it("returns the beliefs, signals and outcomes it was given", () => {
    const b = belief("b1");
    const s = signal("s1");
    const o = outcome("o1");
    const r = build({ memory: memory([b]), adaptationSignals: [s], outcomes: [o] });
    expect(r.activeBeliefs).toContainEqual(b);
    expect(r.adaptationSignals).toEqual([s]);
    expect(r.recommendationOutcomes).toEqual([o]);
  });

  it("defaults attribution snapshots to an empty array rather than undefined", () => {
    const r = build({ memory: memory(), adaptationSignals: [], outcomes: [] });
    expect(r.attributionSnapshots).toEqual([]);
  });

  it("survives a completely empty athlete", () => {
    const r = build({ memory: memory(), adaptationSignals: [], outcomes: [] });
    expect(r.activeBeliefs).toEqual([]);
    expect(r.timeline).toEqual([]);
    expect(r.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
