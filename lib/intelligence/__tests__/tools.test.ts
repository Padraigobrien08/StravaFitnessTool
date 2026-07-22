import { describe, expect, it } from "vitest";
import { INTELLIGENCE_TOOL_DEFINITIONS, parseToolName } from "../tools";

describe("parseToolName", () => {
  it("accepts reasoning tool names", () => {
    expect(parseToolName("compare_sessions")).toBe("compare_sessions");
    expect(parseToolName("explain_readiness_delta")).toBe("explain_readiness_delta");
    expect(parseToolName("find_best_phase")).toBe("find_best_phase");
    expect(parseToolName("attribute_improvement")).toBe("attribute_improvement");
    expect(parseToolName("analyze_fade_pattern")).toBe("analyze_fade_pattern");
    expect(parseToolName("pr_context")).toBe("pr_context");
    expect(parseToolName("generate_next_week_training_plan")).toBe(
      "generate_next_week_training_plan",
    );
  });

  it("round-trips every advertised tool name", () => {
    for (const def of INTELLIGENCE_TOOL_DEFINITIONS) {
      expect(parseToolName(def.name)).toBe(def.name);
    }
  });

  it("throws on an unknown tool name", () => {
    expect(() => parseToolName("get_secret_data")).toThrow(/Unknown tool/);
    expect(() => parseToolName("")).toThrow(/Unknown tool/);
  });
});

describe("INTELLIGENCE_TOOL_DEFINITIONS", () => {
  it("advertises unique tool names", () => {
    const names = INTELLIGENCE_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tool a description and an object input schema", () => {
    for (const def of INTELLIGENCE_TOOL_DEFINITIONS) {
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.input_schema).toMatchObject({ type: "object" });
    }
  });

  it("includes the core and F1 session tools the Coach relies on", () => {
    const names = INTELLIGENCE_TOOL_DEFINITIONS.map((t) => t.name);
    for (const required of [
      "get_coach_brief",
      "get_readiness",
      "get_predictions",
      "get_week_plan",
      "recommend_today_session",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("constrains enum-typed args to their allowed values", () => {
    const strategy = INTELLIGENCE_TOOL_DEFINITIONS.find((t) => t.name === "get_race_strategy");
    const modeEnum = (
      strategy?.input_schema as unknown as {
        properties?: { mode?: { enum?: readonly string[] } };
      }
    )?.properties?.mode?.enum;
    expect(modeEnum).toEqual(["even", "negative", "conservative", "aggressive"]);
  });
});
