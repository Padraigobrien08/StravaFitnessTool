# @strideiq/mcp

MCP server exposing StrideIQ **training intelligence** and **full Strava API v3 proxy** (strava-mcp parity) for Claude Desktop, Cursor, and other MCP clients.

Requires a running StrideIQ app with Strava connected. See [docs/MCP_INTEGRATION.md](../../docs/MCP_INTEGRATION.md) and [docs/MCP_STRAVA_SMOKE.md](../../docs/MCP_STRAVA_SMOKE.md).

## Setup

```bash
cd packages/strideiq-mcp
npm install
npm run build
```

Auth: `STRIDEIQ_API_KEY` + `STRIDEIQ_BASE_URL`, or `STRIDEIQ_SESSION_COOKIE`. See [docs/MCP_INTEGRATION.md](../../docs/MCP_INTEGRATION.md).

## Intelligence tools

| Tool | Section |
|------|---------|
| `get_coach_brief` | `brief` |
| `get_readiness` | `readiness` |
| `get_predictions` | `predictions` |
| `get_week_plan` | `plan` |
| `get_race_strategy` | `strategy` |
| `get_fatigue_load` | `fatigue` |
| `list_recent_runs` | `runs` |
| `get_data_quality` | `quality` |
| `get_connection_status` | `status` |
| `compare_sessions` | `compare_sessions` |
| `explain_readiness_delta` | `readiness_delta` |
| `find_best_phase` | `best_phase` |
| `attribute_improvement` | `attribute` |
| `analyze_fade_pattern` | `fade` |
| `pr_context` | `pr_context` |

## Strava tools (parity)

| Tool | Action |
|------|--------|
| `strideiq_mcp_version` | — |
| `strava_connection_status` | `connection_status` |
| `strava_list_activities` | `activities` |
| `strava_list_all_activities` | `activities_all` |
| `strava_get_activity` | `activity` |
| `strava_get_activity_laps` | `laps` |
| `strava_get_activity_photos` | `photos` |
| `strava_get_activity_streams` | `streams` |
| `strava_get_athlete` | `athlete` |
| `strava_get_athlete_stats` | `stats` |
| `strava_get_athlete_zones` | `zones` |
| `strava_get_athlete_shoes` | `shoes` |
| `strava_explore_segments` | `segments_explore` |
| `strava_list_starred_segments` | `segments_starred` |
| `strava_get_segment` | `segment` |
| `strava_get_segment_leaderboard` | `segment_leaderboard` |
| `strava_get_segment_effort` | `segment_effort` |
| `strava_list_segment_efforts` | `segment_efforts` |
| `strava_star_segment` | `segment_star` (POST) |
| `strava_list_routes` | `routes` |
| `strava_get_route` | `route` |
| `strava_export_route_gpx` | `route_export_gpx` |
| `strava_export_route_tcx` | `route_export_tcx` |
| `strava_list_clubs` | `clubs` |
| `strava_format_workout_file` | `workout_gpx` |

### Composite tools (Phase 5)

| Tool | Action |
|------|--------|
| `analyze_last_run_with_readiness` | `last_run_analysis` |
| `race_week_snapshot` | `race_week_snapshot` |
| `pr_and_segments_snapshot` | `pr_and_segments` |
| `long_run_route_suggestions` | `long_run_route_suggestions` |

### Resources

| URI | Content |
|-----|---------|
| `strideiq://activity/{activityId}/gpx` | Activity GPX |
