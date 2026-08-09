import { describe, expect, it } from "vitest";
import { classifyAdaptiveCoachQuestion } from "../coachIntent";

/**
 * Routes a question to the slice of adaptive intelligence worth serializing into the
 * Coach prompt. Untested until now, and worth pinning precisely because it is *not*
 * clever: the patterns are near-verbatim phrases, so it matches the suggested prompts
 * the UI offers and very little else.
 *
 * That is a defensible design — a miss costs nothing, since `serializeAdaptiveIntelligence`
 * falls back to serializing everything when the topic is null. These tests exist to keep
 * the narrowness deliberate rather than accidental, so nobody reads the function name and
 * assumes free-text intent classification.
 */

describe("the phrases the UI actually offers", () => {
  const cases: [string, string][] = [
    ["What historically improves my pace?", "adaptation"],
    ["Why did readiness improve this week?", "readiness"],
    ["Is this taper working?", "taper"],
    ["Am I adapting well to threshold work?", "adaptation"],
    ["Compare this block to my strongest block", "history"],
    ["Did the last recommendation help?", "outcomes"],
    ["What tends to fatigue me most?", "fatigue"],
    ["What have you learned about me?", "all"],
  ];

  it.each(cases)("routes %j to %s", (question, topic) => {
    expect(classifyAdaptiveCoachQuestion(question)).toBe(topic);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(classifyAdaptiveCoachQuestion("  IS THIS TAPER WORKING?  ")).toBe("taper");
  });
});

describe("the narrowness is real", () => {
  it("returns null for a paraphrase, which falls back to serializing everything", () => {
    expect(classifyAdaptiveCoachQuestion("is my taper going ok")).toBeNull();
    expect(classifyAdaptiveCoachQuestion("how is the taper looking")).toBeNull();
  });

  it("returns null for an unrelated question", () => {
    expect(classifyAdaptiveCoachQuestion("How far should I run on Sunday?")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(classifyAdaptiveCoachQuestion("")).toBeNull();
    expect(classifyAdaptiveCoachQuestion("   ")).toBeNull();
  });

  // The patterns are unanchored, so the phrase still matches inside a longer question.
  // Worth knowing: it is the one way a paraphrase can succeed.
  it("still matches when the phrase is embedded in a longer sentence", () => {
    expect(classifyAdaptiveCoachQuestion("Quick one: is this taper working, do you think?")).toBe(
      "taper",
    );
  });

  it("takes the first matching pattern when a question contains two", () => {
    // "what have you learned" (all) appears after "is this taper working" (taper) in the
    // table, so the earlier entry wins. Pinned so reordering the table is a visible change.
    const q = "Is this taper working, and what have you learned about me?";
    expect(classifyAdaptiveCoachQuestion(q)).toBe("taper");
  });
});
