#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchIntelligence } from "./client.js";
import { registerStravaTools } from "./strava-tools.js";
import { registerCompositeTools } from "./composite-tools.js";
import { registerMcpResources } from "./resources.js";

const server = new McpServer({
  name: "strideiq",
  version: "0.5.0",
});

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

server.tool(
  "get_coach_brief",
  "Compact training intelligence: readiness, week plan, predictions, fatigue, data quality.",
  {},
  async () => textResult(await fetchIntelligence("brief")),
);

server.tool(
  "get_readiness",
  "Race or half-marathon readiness score, gaps, and risks.",
  {},
  async () => textResult(await fetchIntelligence("readiness")),
);

server.tool("get_predictions", "Consensus race time predictions with confidence.", {}, async () =>
  textResult(await fetchIntelligence("predictions")),
);

server.tool("get_week_plan", "Recommended next week sessions from the plan engine.", {}, async () =>
  textResult(await fetchIntelligence("plan")),
);

server.tool(
  "get_race_strategy",
  "Pacing strategy splits for race goal.",
  {
    mode: z
      .enum(["even", "negative", "conservative", "aggressive"])
      .optional()
      .describe("Strategy mode"),
  },
  async ({ mode }) =>
    textResult(await fetchIntelligence("strategy", mode ? { strategyMode: mode } : undefined)),
);

server.tool("get_fatigue_load", "Freshness, TSB, CTL/ATL, load interpretation.", {}, async () =>
  textResult(await fetchIntelligence("fatigue")),
);

server.tool(
  "list_recent_runs",
  "Recent runs with workout classification.",
  { limit: z.number().optional().describe("Max runs, default 10") },
  async ({ limit }) =>
    textResult(
      await fetchIntelligence("runs", {
        limit: limit ? String(limit) : "10",
      }),
    ),
);

server.tool("get_data_quality", "Import field coverage and warnings.", {}, async () =>
  textResult(await fetchIntelligence("quality")),
);

server.tool("get_connection_status", "Strava connection and stream sync status.", {}, async () =>
  textResult(await fetchIntelligence("status")),
);

server.tool(
  "compare_sessions",
  "Compare recent sessions by type (tempo, interval, long, race) with execution scores.",
  {
    type: z.enum(["tempo", "interval", "long", "race"]).optional().describe("Workout type"),
    n: z.number().optional().describe("Number of sessions (default 3)"),
  },
  async ({ type, n }) =>
    textResult(
      await fetchIntelligence("compare_sessions", {
        ...(type ? { type } : {}),
        ...(n != null ? { n: String(n) } : {}),
      }),
    ),
);

server.tool(
  "explain_readiness_delta",
  "Why readiness changed over the last N weeks (1-4).",
  { weeks: z.number().optional().describe("Weeks lookback, default 1") },
  async ({ weeks }) =>
    textResult(
      await fetchIntelligence("readiness_delta", {
        ...(weeks != null ? { weeks: String(weeks) } : {}),
      }),
    ),
);

server.tool(
  "find_best_phase",
  "Strongest historical 4-week phase (aerobic, volume, consistency, efficiency).",
  {
    metric: z.enum(["aerobic", "volume", "consistency", "efficiency"]).optional(),
  },
  async ({ metric }) =>
    textResult(
      await fetchIntelligence("best_phase", {
        ...(metric ? { metric } : {}),
      }),
    ),
);

server.tool(
  "attribute_improvement",
  "Training patterns historically associated with pace, efficiency, or volume gains.",
  {
    metric: z.enum(["pace", "efficiency", "volume"]).optional(),
  },
  async ({ metric }) =>
    textResult(
      await fetchIntelligence("attribute", {
        ...(metric ? { metric } : {}),
      }),
    ),
);

server.tool(
  "analyze_fade_pattern",
  "Late-session pace fade on long runs at or above distanceKm (default 15).",
  { distanceKm: z.number().optional() },
  async ({ distanceKm }) =>
    textResult(
      await fetchIntelligence("fade", {
        ...(distanceKm != null ? { distanceKm: String(distanceKm) } : {}),
      }),
    ),
);

server.tool(
  "pr_context",
  "What changed in training before a PR vs the prior 8 weeks.",
  {
    bucket: z.enum(["5k", "10k", "hm", "long"]).optional(),
    runId: z.string().optional(),
  },
  async ({ bucket, runId }) =>
    textResult(
      await fetchIntelligence("pr_context", {
        ...(bucket ? { bucket } : {}),
        ...(runId ? { runId } : {}),
      }),
    ),
);

registerStravaTools(server, textResult);
registerCompositeTools(server, textResult);
registerMcpResources(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("StrideIQ MCP server running on stdio");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
