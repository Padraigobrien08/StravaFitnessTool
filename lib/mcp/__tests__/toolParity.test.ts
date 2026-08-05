import { describe, expect, it } from "vitest";
import { INTELLIGENCE_TOOL_DEFINITIONS } from "@/lib/intelligence/tools";
import {
  INTELLIGENCE_TOOLS,
  INTELLIGENCE_TOOL_NAMES,
} from "../../../packages/strideiq-mcp/src/intelligence-tools";

/**
 * Registry ↔ MCP parity.
 *
 * `packages/strideiq-mcp` is standalone — its own dependencies and tsconfig, no imports
 * from the app — so it cannot read `INTELLIGENCE_TOOL_DEFINITIONS` directly and instead
 * carries a hand-maintained table. That is exactly how it fell **29 tools behind** while
 * `FEATURES.md` §12 advertised "tool parity: same deterministic outputs as web Coach".
 *
 * This test is the enforcement. Add a tool to the registry and it fails until the MCP
 * table is updated, which is the only mechanism available short of a build step.
 */

const registryNames: string[] = INTELLIGENCE_TOOL_DEFINITIONS.map((t) => t.name as string).sort();
const mcpNames = [...INTELLIGENCE_TOOL_NAMES].sort();

describe("registry ↔ MCP tool parity", () => {
  it("exposes every registered tool", () => {
    const missing = registryNames.filter((n) => !mcpNames.includes(n));
    expect(missing, `MCP table is missing: ${missing.join(", ")}`).toEqual([]);
  });

  it("invents no tool the server cannot execute", () => {
    const extra = mcpNames.filter((n) => !registryNames.includes(n));
    expect(extra, `MCP table has unknown tools: ${extra.join(", ")}`).toEqual([]);
  });

  it("matches exactly, name for name", () => {
    expect(mcpNames).toEqual(registryNames);
    expect(mcpNames).toHaveLength(44);
  });

  it("carries a usable description for each tool", () => {
    for (const tool of INTELLIGENCE_TOOLS) {
      expect(tool.description.length, `${tool.name} description`).toBeGreaterThan(20);
    }
  });

  it("declares no duplicate names", () => {
    expect(new Set(mcpNames).size).toBe(mcpNames.length);
  });
});

describe("argument specs agree with the registry schemas", () => {
  const schemaFor = (name: string) =>
    INTELLIGENCE_TOOL_DEFINITIONS.find((t) => (t.name as string) === name)?.input_schema as
      { properties?: Record<string, { type?: string; enum?: (string | number)[] }> } | undefined;

  it("declares the same argument names the registry accepts", () => {
    for (const tool of INTELLIGENCE_TOOLS) {
      const expected = Object.keys(schemaFor(tool.name)?.properties ?? {}).sort();
      expect(Object.keys(tool.args).sort(), `args for ${tool.name}`).toEqual(expected);
    }
  });

  it("declares the same types and enums", () => {
    for (const tool of INTELLIGENCE_TOOLS) {
      const props = schemaFor(tool.name)?.properties ?? {};
      for (const [arg, spec] of Object.entries(tool.args)) {
        expect(spec.type, `${tool.name}.${arg} type`).toBe(props[arg]?.type);
        if (props[arg]?.enum) {
          expect(spec.enum, `${tool.name}.${arg} enum`).toEqual(props[arg].enum);
        }
      }
    }
  });

  // The ecosystem tools were the largest single block the old section map omitted.
  it("includes the ecosystem tools that were previously unreachable", () => {
    for (const name of [
      "get_training_ecosystem",
      "get_training_ecosystem_summary",
      "get_modality_distribution",
      "get_cross_training_support",
      "get_interference_risks",
      "get_athlete_archetype",
      "compare_modality_blocks",
      "get_race_week_interference_check",
      "get_strength_mobility_support",
    ]) {
      expect(mcpNames, `${name} should be exposed`).toContain(name);
    }
  });

  it("includes the adaptive-stack and planning tools", () => {
    for (const name of [
      "get_athlete_memory",
      "generate_next_week_training_plan",
      "get_forecast_accuracy",
      "get_recommendation_outcomes",
      "recommend_today_session",
      "get_goal_scenarios",
      "get_physiology",
      "get_capability_radar",
      "get_uncertainty",
      "get_risk_patterns",
    ]) {
      expect(mcpNames, `${name} should be exposed`).toContain(name);
    }
  });
});
