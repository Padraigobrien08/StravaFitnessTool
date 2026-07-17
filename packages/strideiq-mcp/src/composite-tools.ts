import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchCompositeCoach, stravaQuery } from "./client.js";

type TextResult = {
  content: { type: "text"; text: string }[];
};

export function registerCompositeTools(
  server: McpServer,
  textResult: (data: unknown) => TextResult
) {
  server.tool(
    "analyze_last_run_with_readiness",
    "Readiness score + coach brief + last activity summary and downsampled streams (one call).",
    { downsample: z.number().optional().describe("Max stream points, default 200") },
    async ({ downsample }) =>
      textResult(
        await fetchCompositeCoach(
          "last_run_analysis",
          stravaQuery({
            downsample: downsample != null ? String(downsample) : "200",
          })
        )
      )
  );

  server.tool(
    "race_week_snapshot",
    "Coach brief, AI weekly plan, fatigue load, and Strava connection status.",
    {},
    async () => textResult(await fetchCompositeCoach("race_week_snapshot"))
  );

  server.tool(
    "pr_and_segments_snapshot",
    "PR context from training analytics plus starred Strava segments.",
    {
      bucket: z.enum(["5k", "10k", "hm", "long"]).optional(),
    },
    async ({ bucket }) =>
      textResult(
        await fetchCompositeCoach(
          "pr_and_segments",
          stravaQuery(bucket ? { bucket } : {})
        )
      )
  );

  server.tool(
    "long_run_route_suggestions",
    "Match saved Strava routes to this week's long run distance from the plan engine.",
    {},
    async () =>
      textResult(await fetchCompositeCoach("long_run_route_suggestions"))
  );
}
