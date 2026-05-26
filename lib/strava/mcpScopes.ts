/** Strava OAuth scopes and which MCP surfaces need them. */
export const STRAVA_SCOPE_GROUPS = [
  {
    scope: "read",
    description: "Basic read access",
    tools: [
      "strava_get_athlete",
      "strava_connection_status",
      "get_connection_status",
    ],
  },
  {
    scope: "activity:read_all",
    description: "Private activities, streams, laps, photos",
    tools: [
      "strava_list_activities",
      "strava_list_all_activities",
      "strava_get_activity",
      "strava_get_activity_laps",
      "strava_get_activity_streams",
      "strava_get_activity_photos",
      "strava_format_workout_file",
      "analyze_last_run_with_readiness",
    ],
  },
  {
    scope: "profile:read_all",
    description: "Athlete profile, stats, zones, shoes",
    tools: [
      "strava_get_athlete_stats",
      "strava_get_athlete_zones",
      "strava_get_athlete_shoes",
    ],
  },
] as const;

export const STRAVA_OPTIONAL_FEATURES = [
  {
    feature: "Segments (explore, starred, leaderboard, efforts, star)",
    note: "Uses activity:read_all; starring may require segment write on some accounts",
    tools: [
      "strava_explore_segments",
      "strava_list_starred_segments",
      "strava_get_segment",
      "strava_get_segment_leaderboard",
      "strava_get_segment_effort",
      "strava_list_segment_efforts",
      "strava_star_segment",
      "pr_and_segments_snapshot",
    ],
  },
  {
    feature: "Saved routes & GPX/TCX export",
    tools: [
      "strava_list_routes",
      "strava_get_route",
      "strava_export_route_gpx",
      "strava_export_route_tcx",
      "long_run_route_suggestions",
    ],
  },
  {
    feature: "Clubs",
    tools: ["strava_list_clubs"],
  },
] as const;

export const DEFAULT_STRAVA_SCOPES =
  "read,activity:read_all,profile:read_all";
