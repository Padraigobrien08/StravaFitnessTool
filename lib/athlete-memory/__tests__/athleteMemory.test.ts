import { describe, expect, it } from "vitest";
import {
  buildAthleteMemoryProfile,
  createBelief,
  profileToJson,
  selectRelevantBeliefs,
  serializeAthleteMemoryForLLM,
  serializeMemoryForCoachAnswer,
  updateAthleteMemoryProfile,
} from "../index";
import { classifyMemoryQuestion } from "../memoryIntent";
import { emptyProfile } from "../beliefUtils";
import {
  hybridAthlete,
  lowData,
  raceWeekAthlete,
} from "@/lib/coaching-context/__tests__/fixtures";

describe("AthleteMemoryProfile", () => {
  it("returns empty profile with no data", () => {
    const profile = buildAthleteMemoryProfile(null);
    expect(profile.adaptationPatterns).toHaveLength(0);
    expect(profile.fatiguePatterns).toHaveLength(0);
    expect(serializeAthleteMemoryForLLM(profile)).toMatch(/No structured athlete memory/);
  });

  it("builds low-confidence beliefs from sparse data", () => {
    const profile = buildAthleteMemoryProfile(lowData.analytics);
    const beliefs = [
      ...profile.adaptationPatterns,
      ...profile.fatiguePatterns,
      ...profile.pacingPatterns,
    ];
    for (const b of beliefs) {
      expect(b.evidence.length).toBeGreaterThan(0);
      expect(b.confidence).not.toBe("high");
      expect(b.recommendedUse.length).toBeGreaterThan(0);
    }
  });

  it("never assigns high confidence from a single observation", () => {
    const belief = createBelief({
      id: "test-one",
      category: "fatigue",
      statement: "One hard week felt heavy",
      evidence: ["TSB -18 after one stacked week"],
      confidence: "high",
      recommendedUse: "Test only",
    });
    expect(belief.confidence).not.toBe("high");
    expect(belief.confidence).toBe("medium");
  });

  it("strengthens beliefs with repeated supporting evidence", () => {
    const base = createBelief({
      id: "fatigue-density",
      category: "fatigue",
      statement: "Freshness sensitive to hard-session density",
      evidence: ["3 hard runs in 10 days"],
      confidence: "low",
      recommendedUse: "Space quality sessions",
    });
    const profile = emptyProfile();
    profile.fatiguePatterns = [base];

    const updated = updateAthleteMemoryProfile(profile, {
      observedAt: new Date().toISOString(),
      supporting: {
        fatigue: [
          "4 hard runs in 14 days with freshness drop",
          "Repeated freshness <50 after dense blocks",
          "Third dense block with TSB below -12",
        ],
      },
    });

    const belief = updated.fatiguePatterns.find((b) => b.id === "fatigue-density");
    expect(belief?.evidence.length).toBeGreaterThanOrEqual(4);
    expect(belief?.confidence).toBe("high");
    expect(belief?.stability).toBe("stable");
  });

  it("weakens beliefs when contradicted", () => {
    const base = createBelief({
      id: "taper-fresh",
      category: "taper",
      statement: "Race-week taper improves freshness",
      evidence: ["Freshness rose in taper week", "Volume dropped 40%"],
      confidence: "high",
      recommendedUse: "Protect taper before race",
      stability: "stable",
    });
    const profile = emptyProfile();
    profile.taperResponses = [base];

    const updated = updateAthleteMemoryProfile(profile, {
      observedAt: new Date().toISOString(),
      contradicting: {
        taper: [
          "Freshness fell during race week despite lower volume",
          "TSB remained negative through taper",
        ],
      },
    });

    const belief = updated.taperResponses.find((b) => b.id === "taper-fresh");
    expect(belief?.confidence).not.toBe("high");
    expect(belief?.counterEvidence.length).toBeGreaterThan(0);
    expect(belief?.stability).toBe("weakening");
  });

  it("serializes profile to JSON round-trip shape", () => {
    const profile = buildAthleteMemoryProfile(hybridAthlete().analytics);
    const json = profileToJson(profile);
    const parsed = JSON.parse(json);
    expect(parsed.generatedAt).toBeTruthy();
    expect(Array.isArray(parsed.adaptationPatterns)).toBe(true);
  });

  it("selects relevant memory for planning with fatigue notes", () => {
    const profile = buildAthleteMemoryProfile(raceWeekAthlete().analytics);
    const selection = selectRelevantBeliefs(profile, {
      goal: raceWeekAthlete().analytics.raceReadiness
        ? {
            distance: "hm",
            date: raceWeekAthlete().analytics.raceReadiness!.raceDate,
            targetTimeSec: 7200,
          }
        : null,
      forPlanning: true,
      maxBeliefs: 5,
    });
    expect(selection.beliefs.length).toBeGreaterThan(0);
    expect(selection.beliefs.length).toBeLessThanOrEqual(5);
  });

  it("classifies coach memory questions", () => {
    expect(classifyMemoryQuestion("What have you learned about me?")?.topic).toBe(
      "all"
    );
    expect(classifyMemoryQuestion("What tends to make me fatigued?")?.topic).toBe(
      "fatigue"
    );
    expect(classifyMemoryQuestion("What patterns are still uncertain?")?.topic).toBe(
      "all"
    );
  });

  it("coach answer mentions uncertainty when empty", () => {
    const answer = serializeMemoryForCoachAnswer(emptyProfile(), "fatigue");
    expect(answer).toMatch(/don't have enough/i);
  });

  it("builds beliefs from real analytics fixture", () => {
    const profile = buildAthleteMemoryProfile(hybridAthlete().analytics);
    const total =
      profile.adaptationPatterns.length +
      profile.fatiguePatterns.length +
      profile.pacingPatterns.length +
      profile.modalityInteractions.length;
    expect(total).toBeGreaterThan(0);
  });
});
