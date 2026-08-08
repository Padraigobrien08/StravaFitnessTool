import { describe, expect, it } from "vitest";
import { confidenceLevel, describeGrounding } from "../groundingMeta";

/**
 * The "Grounded in" line is the UI's claim that an answer's numbers came from the
 * deterministic engines rather than from the model. It used to be computed partly by
 * running regexes over the model's own `## Evidence` prose, which is the one method that
 * cannot support that claim: a reply merely *mentioning* readiness earned a "readiness"
 * chip, and a reply that called no tools at all could still be labelled grounded in four
 * separate things.
 */

describe("describeGrounding", () => {
  it("reports the tools that actually ran", () => {
    const g = describeGrounding(["get_readiness", "get_fatigue_load"]);
    expect(g).toEqual({ kind: "tools", labels: ["readiness", "fatigue & load"] });
  });

  it("collapses tools that map to the same ground", () => {
    // Two different tools, one subject: the reader wants the subject, not the plumbing.
    const g = describeGrounding(["get_readiness", "explain_readiness_delta"]);
    expect(g).toEqual({ kind: "tools", labels: ["readiness"] });
  });

  it("falls back to a readable label for tools with no explicit mapping", () => {
    const g = describeGrounding(["get_athlete_memory"]);
    expect(g.kind).toBe("tools");
    if (g.kind !== "tools") return;
    expect(g.labels).toHaveLength(1);
    expect(g.labels[0]).toBe(g.labels[0].toLowerCase());
    expect(g.labels[0]).not.toContain("_");
  });

  it("caps the list so the line stays readable", () => {
    const g = describeGrounding([
      "get_readiness",
      "get_fatigue_load",
      "get_predictions",
      "get_race_strategy",
      "compare_sessions",
      "get_run_detail",
    ]);
    expect(g.kind).toBe("tools");
    if (g.kind !== "tools") return;
    expect(g.labels.length).toBeLessThanOrEqual(4);
  });

  // The case the old implementation actively concealed.
  it("says none when the model answered without calling anything", () => {
    expect(describeGrounding([])).toEqual({ kind: "none" });
  });

  /**
   * Absent is not the same as none. Threads are persisted as raw JSON under
   * `strideiq-coach-threads-v1` with no migration, so replies stored before `toolsUsed`
   * existed deserialize without it. Claiming those called no tools would be inventing a
   * fact in the opposite direction to the bug being fixed.
   */
  it("says unknown when there is no record either way", () => {
    expect(describeGrounding(undefined)).toEqual({ kind: "unknown" });
  });

  it("cannot be influenced by what the answer says", () => {
    // The old version scanned prose for /readiness|freshness|tsb/ and friends. The
    // signature no longer accepts the reply at all, so this is structural: there is
    // nothing to pass. Kept as a statement of the invariant.
    expect(describeGrounding.length).toBe(1);
  });
});

describe("confidenceLevel", () => {
  it("reads all four levels the prompt asks for", () => {
    expect(confidenceLevel("high")).toBe("high");
    expect(confidenceLevel("medium")).toBe("medium");
    expect(confidenceLevel("low")).toBe("low");
    expect(confidenceLevel("moderate")).toBe("medium");
  });

  // `"medium-high".includes("high")` is true, so the compound has to be matched first.
  // It was not, and the hedged level rendered as the confident one.
  it("does not round medium-high up to high", () => {
    expect(confidenceLevel("medium-high")).toBe("medium-high");
    expect(confidenceLevel("medium high")).toBe("medium-high");
    expect(confidenceLevel("medium_high")).toBe("medium-high");
    expect(confidenceLevel("Medium-High confidence, mainly because ...")).toBe("medium-high");
  });

  it("returns null rather than guessing", () => {
    expect(confidenceLevel(null)).toBeNull();
    expect(confidenceLevel("fairly sure")).toBeNull();
  });
});
