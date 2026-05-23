import { describe, expect, it } from "vitest";
import { inferPlanHintsFromContext } from "../inferPlanHintsFromContext";

describe("inferPlanHintsFromContext", () => {
  it("detects post-race recovery", () => {
    const hints = inferPlanHintsFromContext(
      "I just ran a half marathon — plan recovery for this week"
    );
    expect(hints.planTypeHint).toBe("recovery");
    expect(hints.notes.length).toBeGreaterThan(0);
  });

  it("returns empty for blank", () => {
    expect(inferPlanHintsFromContext("   ").notes).toEqual([]);
  });
});
