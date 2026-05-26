# MCP integration — StrideIQ (full Strava surface)

StrideIQ ships a **single MCP server** ([`packages/strideiq-mcp`](../packages/strideiq-mcp)) that exposes:

1. **Training intelligence** — readiness, plan, fatigue, compare sessions, etc. (`GET /api/me/intelligence`)
2. **Strava API v3 proxy** — parity with [strava-mcp](https://github.com/r-huijts/strava-mcp) tools, using your **app OAuth** (`GET|POST /api/me/strava`)

No need to install `@r-huijts/strava-mcp-server` separately.

**Roadmap history:** [MCP_STRAVA_ROADMAP.md](./MCP_STRAVA_ROADMAP.md) · **Smoke tests:** [MCP_STRAVA_SMOKE.md](./MCP_STRAVA_SMOKE.md)

## Prerequisites

1. Running app (`npm run dev` or production URL).
2. Strava connected in the UI (OAuth in `strava_connections`).
3. MCP auth: session cookie **or** `STRIDEIQ_API_KEY` + `STRIDEIQ_API_KEY_USER_ID` (see [packages/strideiq-mcp/README.md](../packages/strideiq-mcp/README.md)).

## Build

```bash
cd packages/strideiq-mcp
npm install
npm run build
```

## Claude Desktop / Cursor

Example: [config/mcp/claude-desktop.example.json](../config/mcp/claude-desktop.example.json)

```json
{
  "mcpServers": {
    "strideiq": {
      "command": "node",
      "args": ["/absolute/path/to/StravaFitnessTool/packages/strideiq-mcp/dist/index.js"],
      "env": {
        "STRIDEIQ_BASE_URL": "http://localhost:3000",
        "STRIDEIQ_API_KEY": "your-secret-key"
      }
    }
  }
}
```

## Strava proxy tools

All use the connected user's Strava token from Neon.

| MCP tool | API |
|----------|-----|
| `strava_connection_status` | `?action=connection_status` |
| `strava_list_activities` | `?action=activities` |
| `strava_list_all_activities` | `?action=activities_all` |
| `strava_get_activity` | `?action=activity&id=` |
| `strava_get_activity_laps` | `?action=laps&id=` |
| `strava_get_activity_photos` | `?action=photos&id=` |
| `strava_get_activity_streams` | `?action=streams&id=` |
| `strava_get_athlete` | `?action=athlete` |
| `strava_get_athlete_stats` | `?action=stats` |
| `strava_get_athlete_zones` | `?action=zones` |
| `strava_get_athlete_shoes` | `?action=shoes` |
| `strava_explore_segments` | `?action=segments_explore&south=&west=&north=&east=` |
| `strava_list_starred_segments` | `?action=segments_starred` |
| `strava_get_segment` | `?action=segment&id=` |
| `strava_get_segment_leaderboard` | `?action=segment_leaderboard&id=` |
| `strava_get_segment_effort` | `?action=segment_effort&id=` |
| `strava_list_segment_efforts` | `?action=segment_efforts&id=` |
| `strava_star_segment` | `POST` body `{ action, id, starred }` |
| `strava_list_routes` | `?action=routes` |
| `strava_get_route` | `?action=route&id=` |
| `strava_export_route_gpx` | `?action=route_export_gpx&id=` |
| `strava_export_route_tcx` | `?action=route_export_tcx&id=` |
| `strava_list_clubs` | `?action=clubs` |
| `strava_format_workout_file` | `?action=workout_gpx&id=` |
| `strideiq_mcp_version` | (local package version) |

### Composite coach tools (Phase 5)

Single MCP calls that blend intelligence + Strava:

| MCP tool | API |
|----------|-----|
| `analyze_last_run_with_readiness` | `?action=last_run_analysis` |
| `race_week_snapshot` | `?action=race_week_snapshot` |
| `pr_and_segments_snapshot` | `?action=pr_and_segments` |
| `long_run_route_suggestions` | `?action=long_run_route_suggestions` |

`strava_list_activities` prefers **Neon** when last sync is &lt;24h old; otherwise live Strava API.

### MCP resources

- `strideiq://activity/{activityId}/gpx` — GPX from activity streams

Intelligence tools unchanged — see [COACH_AND_INTELLIGENCE.md](./COACH_AND_INTELLIGENCE.md).

## HTTP examples

```bash
curl -s -H "x-strideiq-api-key: $STRIDEIQ_API_KEY" \
  "http://localhost:3000/api/me/strava?action=activities&per_page=5"
```

```bash
curl -s -X POST -H "x-strideiq-api-key: $STRIDEIQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"segment_star","id":12345,"starred":true}' \
  "http://localhost:3000/api/me/strava"
```

## Security

- Tokens stay server-side; MCP receives JSON only.
- Scope `STRIDEIQ_API_KEY` to one `STRIDEIQ_API_KEY_USER_ID` in production.
- Do not commit API keys or session cookies.
