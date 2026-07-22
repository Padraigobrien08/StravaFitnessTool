import { describe, expect, it } from "vitest";
import { parseCoachResponse } from "../parseResponse";

describe("parseCoachResponse", () => {
  it("treats content with no ## headings as an unstructured summary", () => {
    const r = parseCoachResponse("You're fresh and ready.\n\nGo run.");
    expect(r.isStructured).toBe(false);
    expect(r.summary).toBe("You're fresh and ready.");
    expect(r.why).toEqual([]);
    expect(r.raw).toContain("Go run.");
  });

  it("falls back to the full trimmed content when there are no paragraph breaks", () => {
    const r = parseCoachResponse("   single line answer   ");
    expect(r.isStructured).toBe(false);
    expect(r.summary).toBe("single line answer");
  });

  it("parses structured sections into their fields", () => {
    const content = [
      "## Summary",
      "You are on track.",
      "## Recommendation",
      "Run an easy 8k today.",
      "## Confidence",
      "high",
    ].join("\n");
    const r = parseCoachResponse(content);
    expect(r.isStructured).toBe(true);
    expect(r.summary).toBe("You are on track.");
    expect(r.recommendation).toBe("Run an easy 8k today.");
    expect(r.confidence).toBe("high");
  });

  it("parses bullet lists across the supported markers", () => {
    const content = [
      "## Evidence",
      "- freshness 68",
      "* TSB +4",
      "• 3 quality sessions",
      "1. long run streak",
    ].join("\n");
    const r = parseCoachResponse(content);
    expect(r.evidence).toEqual(["freshness 68", "TSB +4", "3 quality sessions", "long run streak"]);
  });

  it("maps section aliases to the canonical field", () => {
    const content = [
      "## Reasoning",
      "- because you are fresh",
      "## Follow-ups",
      "- try a tempo next",
      "## Missing data",
      "- no HR on 2 runs",
      "## History",
      "- faster than last block",
    ].join("\n");
    const r = parseCoachResponse(content);
    expect(r.why).toEqual(["because you are fresh"]);
    expect(r.followUps).toEqual(["try a tempo next"]);
    expect(r.limitations).toEqual(["no HR on 2 runs"]); // "missing data" → limitations
    expect(r.historicalComparison).toEqual(["faster than last block"]); // "history" → historicalComparison
  });

  it("keeps a non-bulleted body as a single-element array for list fields", () => {
    const r = parseCoachResponse("## Risks\nOvertraining if you keep this ramp.");
    expect(r.risks).toEqual(["Overtraining if you keep this ramp."]);
  });

  it("ignores unknown section headings", () => {
    const r = parseCoachResponse("## Weather\nSunny.\n## Summary\nReady.");
    expect(r.summary).toBe("Ready.");
    // Unknown heading contributed nothing to the recognized fields.
    expect(r.why).toEqual([]);
  });

  it("derives the summary from the first why bullet when no summary section exists", () => {
    const r = parseCoachResponse(
      "## Analysis\n- your aerobic base is strong\n- pace is trending down",
    );
    expect(r.summary).toBe("your aerobic base is strong");
    expect(r.why.length).toBe(2);
  });

  it("collapses a multi-line summary into a single line", () => {
    const r = parseCoachResponse("## Summary\nline one\nline two");
    expect(r.summary).toBe("line one line two");
  });

  it("tolerates a trailing colon on the heading", () => {
    const r = parseCoachResponse("## Recommendation:\nEasy run.");
    expect(r.recommendation).toBe("Easy run.");
  });
});
