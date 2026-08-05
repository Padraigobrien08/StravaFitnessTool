import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodTypeAny } from "zod";
import { callIntelligenceTool } from "./client.js";
import { INTELLIGENCE_TOOLS, type ToolArgSpec } from "./intelligence-tools.js";

type TextResult = { content: { type: "text"; text: string }[] };

/** Turn a table arg spec into the zod shape the MCP SDK wants. */
function zodFor(spec: ToolArgSpec): ZodTypeAny {
  if (spec.enum && spec.enum.length > 0) {
    // Numeric enums (e.g. windowDays: 14 | 21 | 28) cannot use z.enum.
    if (spec.enum.every((v) => typeof v === "number")) {
      return z
        .union(
          spec.enum.map((v) => z.literal(v as number)) as unknown as [
            ZodTypeAny,
            ZodTypeAny,
            ...ZodTypeAny[],
          ],
        )
        .optional();
    }
    return z.enum(spec.enum.map(String) as [string, ...string[]]).optional();
  }
  switch (spec.type) {
    case "number":
      return z.number().optional();
    case "boolean":
      return z.boolean().optional();
    case "array":
      return z.array(z.string()).optional();
    default:
      return z.string().optional();
  }
}

/**
 * Register every intelligence tool from the shared table.
 *
 * Previously 15 of these were written out by hand, which is why the list fell 29
 * tools behind the registry. Driving it from data means adding a tool to the table
 * is the only step, and the main repo's parity test fails if the table itself
 * drifts from `lib/intelligence/tools.ts`.
 */
export function registerIntelligenceTools(
  server: McpServer,
  textResult: (data: unknown) => TextResult,
) {
  for (const tool of INTELLIGENCE_TOOLS) {
    const shape: Record<string, ZodTypeAny> = {};
    for (const [name, spec] of Object.entries(tool.args)) {
      shape[name] = zodFor(spec);
    }

    server.tool(tool.name, tool.description, shape, async (args: Record<string, unknown>) => {
      // Drop unset optionals so the server sees only what the caller actually passed.
      const provided = Object.fromEntries(
        Object.entries(args ?? {}).filter(([, v]) => v !== undefined),
      );
      return textResult(await callIntelligenceTool(tool.name, provided));
    });
  }
}
