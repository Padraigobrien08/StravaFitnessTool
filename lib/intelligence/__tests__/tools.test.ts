import { describe, expect, it } from "vitest";
import { parseToolName } from "../tools";

describe("parseToolName", () => {
  it("accepts reasoning tool names", () => {
    expect(parseToolName("compare_sessions")).toBe("compare_sessions");
    expect(parseToolName("explain_readiness_delta")).toBe(
      "explain_readiness_delta"
    );
    expect(parseToolName("find_best_phase")).toBe("find_best_phase");
    expect(parseToolName("attribute_improvement")).toBe("attribute_improvement");
    expect(parseToolName("analyze_fade_pattern")).toBe("analyze_fade_pattern");
    expect(parseToolName("pr_context")).toBe("pr_context");
  });
});
