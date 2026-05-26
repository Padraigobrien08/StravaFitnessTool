import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchStravaApi, postStravaApi, stravaQuery } from "./client.js";

type TextResult = {
  content: { type: "text"; text: string }[];
};

export function registerStravaTools(
  server: McpServer,
  textResult: (data: unknown) => TextResult
) {
  server.tool(
    "strideiq_mcp_version",
    "StrideIQ MCP server version.",
    {},
    async () => textResult({ name: "strideiq", version: "0.5.0" })
  );

  server.tool(
    "strava_connection_status",
    "Strava OAuth connection status for the StrideIQ user.",
    {},
    async () => textResult(await fetchStravaApi("connection_status"))
  );

  server.tool(
    "strava_list_activities",
    "List Strava activities (paginated).",
    {
      page: z.number().optional(),
      per_page: z.number().optional(),
      limit: z.number().optional().describe("Alias for per_page"),
      after: z.number().optional(),
      before: z.number().optional(),
    },
    async (p) =>
      textResult(
        await fetchStravaApi(
          "activities",
          stravaQuery({
            page: p.page != null ? String(p.page) : undefined,
            per_page: p.per_page != null ? String(p.per_page) : undefined,
            limit: p.limit != null ? String(p.limit) : undefined,
            after: p.after != null ? String(p.after) : undefined,
            before: p.before != null ? String(p.before) : undefined,
          })
        )
      )
  );

  server.tool(
    "strava_list_all_activities",
    "Fetch multiple pages of activities (capped).",
    {
      after: z.number().optional(),
      before: z.number().optional(),
      max_pages: z.number().optional(),
    },
    async (p) =>
      textResult(
        await fetchStravaApi(
          "activities_all",
          stravaQuery({
            after: p.after != null ? String(p.after) : undefined,
            before: p.before != null ? String(p.before) : undefined,
            max_pages: p.max_pages != null ? String(p.max_pages) : undefined,
          })
        )
      )
  );

  server.tool(
    "strava_get_activity",
    "Full Strava activity detail by id.",
    {
      id: z.number(),
      summary: z.boolean().optional().describe("Include human-readable summary"),
    },
    async ({ id, summary }) =>
      textResult(
        await fetchStravaApi(
          "activity",
          stravaQuery({
            id: String(id),
            ...(summary ? { format: "summary" } : {}),
          })
        )
      )
  );

  server.tool(
    "strava_get_activity_laps",
    "Lap splits for an activity.",
    { id: z.number() },
    async ({ id }) =>
      textResult(await fetchStravaApi("laps", { id: String(id) }))
  );

  server.tool(
    "strava_get_activity_photos",
    "Photos for an activity.",
    { id: z.number() },
    async ({ id }) =>
      textResult(await fetchStravaApi("photos", { id: String(id) }))
  );

  server.tool(
    "strava_get_activity_streams",
    "Activity streams — compact by default; optional chunk/downsample/verbose.",
    {
      id: z.number(),
      include_laps: z.boolean().optional(),
      verbose: z.boolean().optional(),
      chunk: z.string().optional().describe("Chunk index or 'all'"),
      downsample: z.number().optional(),
    },
    async ({ id, include_laps, verbose, chunk, downsample }) =>
      textResult(
        await fetchStravaApi(
          "streams",
          stravaQuery({
            id: String(id),
            compact: verbose ? "false" : "true",
            ...(verbose ? { verbose: "true" } : {}),
            ...(include_laps === false ? { include_laps: "false" } : {}),
            ...(chunk ? { chunk } : {}),
            ...(downsample != null ? { downsample: String(downsample) } : {}),
          })
        )
      )
  );

  server.tool(
    "strava_get_athlete",
    "Connected Strava athlete profile.",
    {},
    async () => textResult(await fetchStravaApi("athlete"))
  );

  server.tool(
    "strava_get_athlete_stats",
    "YTD and all-time athlete stats.",
    {},
    async () => textResult(await fetchStravaApi("stats"))
  );

  server.tool(
    "strava_get_athlete_zones",
    "Heart rate and power zones.",
    {},
    async () => textResult(await fetchStravaApi("zones"))
  );

  server.tool(
    "strava_get_athlete_shoes",
    "Shoes and bikes on the athlete profile.",
    {},
    async () => textResult(await fetchStravaApi("shoes"))
  );

  server.tool(
    "strava_explore_segments",
    "Find popular segments in a bounding box.",
    {
      south: z.number(),
      west: z.number(),
      north: z.number(),
      east: z.number(),
      activity_type: z.string().optional(),
    },
    async (p) =>
      textResult(
        await fetchStravaApi(
          "segments_explore",
          stravaQuery({
            south: String(p.south),
            west: String(p.west),
            north: String(p.north),
            east: String(p.east),
            activity_type: p.activity_type,
          })
        )
      )
  );

  server.tool(
    "strava_list_starred_segments",
    "Starred segments.",
    {},
    async () => textResult(await fetchStravaApi("segments_starred"))
  );

  server.tool(
    "strava_get_segment",
    "Segment details by id.",
    { id: z.number() },
    async ({ id }) =>
      textResult(await fetchStravaApi("segment", { id: String(id) }))
  );

  server.tool(
    "strava_get_segment_leaderboard",
    "Leaderboard for a segment.",
    {
      id: z.number(),
      gender: z.enum(["M", "F"]).optional(),
      following: z.boolean().optional(),
    },
    async (p) =>
      textResult(
        await fetchStravaApi(
          "segment_leaderboard",
          stravaQuery({
            id: String(p.id),
            gender: p.gender,
            following: p.following != null ? String(p.following) : undefined,
          })
        )
      )
  );

  server.tool(
    "strava_get_segment_effort",
    "Single segment effort by id.",
    { id: z.number() },
    async ({ id }) =>
      textResult(await fetchStravaApi("segment_effort", { id: String(id) }))
  );

  server.tool(
    "strava_list_segment_efforts",
    "All efforts on a segment for the athlete.",
    { id: z.number(), per_page: z.number().optional() },
    async (p) =>
      textResult(
        await fetchStravaApi(
          "segment_efforts",
          stravaQuery({
            id: String(p.id),
            per_page: p.per_page != null ? String(p.per_page) : undefined,
          })
        )
      )
  );

  server.tool(
    "strava_star_segment",
    "Star or unstar a segment.",
    { id: z.number(), starred: z.boolean().optional() },
    async ({ id, starred }) =>
      textResult(
        await postStravaApi("segment_star", {
          id,
          starred: starred !== false,
        })
      )
  );

  server.tool(
    "strava_list_routes",
    "Saved routes for the athlete.",
    { page: z.number().optional(), per_page: z.number().optional() },
    async (p) =>
      textResult(
        await fetchStravaApi(
          "routes",
          stravaQuery({
            page: p.page != null ? String(p.page) : undefined,
            per_page: p.per_page != null ? String(p.per_page) : undefined,
          })
        )
      )
  );

  server.tool(
    "strava_get_route",
    "Route details by id.",
    { id: z.number() },
    async ({ id }) =>
      textResult(await fetchStravaApi("route", { id: String(id) }))
  );

  server.tool(
    "strava_export_route_gpx",
    "Export a saved route as GPX (base64).",
    { id: z.number() },
    async ({ id }) =>
      textResult(await fetchStravaApi("route_export_gpx", { id: String(id) }))
  );

  server.tool(
    "strava_export_route_tcx",
    "Export a saved route as TCX (base64).",
    { id: z.number() },
    async ({ id }) =>
      textResult(await fetchStravaApi("route_export_tcx", { id: String(id) }))
  );

  server.tool(
    "strava_list_clubs",
    "Clubs the athlete belongs to.",
    {},
    async () => textResult(await fetchStravaApi("clubs"))
  );

  server.tool(
    "strava_format_workout_file",
    "Build GPX from activity GPS streams.",
    { id: z.number() },
    async ({ id }) =>
      textResult(await fetchStravaApi("workout_gpx", { id: String(id) }))
  );
}
