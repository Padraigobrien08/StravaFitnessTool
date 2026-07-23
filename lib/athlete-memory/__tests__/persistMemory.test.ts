import { describe, expect, it } from "vitest";
import { mergeBeliefWithStored, mergeProfileWithStored } from "../persistMemory";
import type { StoredBeliefMeta } from "../persistMemory";
import type { AthleteBelief, AthleteMemoryProfile } from "../types";

function belief(id: string, overrides: Partial<AthleteBelief> = {}): AthleteBelief {
  return {
    id,
    category: "adaptation",
    statement: "Efficiency trending up",
    confidence: "low",
    evidence: ["one observation"],
    counterEvidence: [],
    firstObserved: "2026-07-20T00:00:00.000Z",
    lastUpdated: "2026-07-20T00:00:00.000Z",
    stability: "emerging",
    recommendedUse: "Inform training",
    ...overrides,
  };
}

const NOW = "2026-07-25T09:00:00.000Z";

function stored(beliefId: string, timesConfirmed: number, firstObserved: string): StoredBeliefMeta {
  return { beliefId, timesConfirmed, firstObserved, lastConfirmed: "2026-07-24T00:00:00.000Z" };
}

describe("mergeBeliefWithStored", () => {
  it("initializes history for a brand-new belief", () => {
    const m = mergeBeliefWithStored(belief("adapt-efficiency-up"), undefined, NOW);
    expect(m.timesConfirmed).toBe(1);
    expect(m.lastConfirmed).toBe(NOW);
    expect(m.firstObserved).toBe("2026-07-20T00:00:00.000Z");
  });

  it("preserves the original first-observed date and increments the count", () => {
    const m = mergeBeliefWithStored(
      belief("adapt-efficiency-up", { firstObserved: NOW }),
      stored("adapt-efficiency-up", 4, "2026-05-01T00:00:00.000Z"),
      NOW,
    );
    expect(m.firstObserved).toBe("2026-05-01T00:00:00.000Z"); // stored wins, not the fresh reset
    expect(m.timesConfirmed).toBe(5);
    expect(m.lastConfirmed).toBe(NOW);
  });

  it("holds a well-established belief's confidence despite thin fresh evidence", () => {
    // Seen 6+ times → confidence floor of high, even though the fresh build said low.
    const m = mergeBeliefWithStored(
      belief("adapt-efficiency-up", { confidence: "low" }),
      stored("adapt-efficiency-up", 6, "2026-04-01T00:00:00.000Z"),
      NOW,
    );
    expect(m.confidence).toBe("high");
    expect(m.stability).toBe("stable");
  });

  it("never lowers confidence below the fresh value", () => {
    const m = mergeBeliefWithStored(
      belief("adapt-efficiency-up", { confidence: "high" }),
      stored("adapt-efficiency-up", 1, "2026-07-01T00:00:00.000Z"),
      NOW,
    );
    expect(m.confidence).toBe("high");
  });
});

describe("mergeProfileWithStored", () => {
  function profile(): AthleteMemoryProfile {
    return {
      generatedAt: NOW,
      adaptationPatterns: [belief("adapt-efficiency-up"), belief("adapt-best-block")],
      fatiguePatterns: [belief("fatigue-fresh-window", { category: "fatigue" })],
      pacingPatterns: [],
      taperResponses: [],
      modalityInteractions: [],
      durabilitySignals: [],
      recommendationOutcomes: [],
    };
  }

  it("merges every belief array and lists them all for persistence", () => {
    const storedById = new Map<string, StoredBeliefMeta>([
      ["adapt-efficiency-up", stored("adapt-efficiency-up", 2, "2026-06-01T00:00:00.000Z")],
    ]);
    const { profile: merged, toPersist } = mergeProfileWithStored(profile(), storedById, NOW);

    expect(toPersist).toHaveLength(3);
    const up = merged.adaptationPatterns.find((b) => b.id === "adapt-efficiency-up")!;
    expect(up.timesConfirmed).toBe(3); // 2 stored + 1
    const block = merged.adaptationPatterns.find((b) => b.id === "adapt-best-block")!;
    expect(block.timesConfirmed).toBe(1); // no stored history
  });
});
