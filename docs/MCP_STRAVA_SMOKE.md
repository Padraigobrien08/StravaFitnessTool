# MCP Strava parity — smoke prompts

Requires: app running, Strava connected, `STRIDEIQ_API_KEY` + `STRIDEIQ_API_KEY_USER_ID` (or session cookie) for MCP.

## Activities and athlete

- List my last 5 Strava activities (`strava_list_activities` with `limit: 5`)
- Show full detail for activity `{id}` (`strava_get_activity`)
- Summarize activity `{id}` (`strava_get_activity` with `summary: true`)
- What are my YTD run stats? (`strava_get_athlete_stats`)
- What are my heart rate zones? (`strava_get_athlete_zones`)
- What shoes are on my profile? (`strava_get_athlete_shoes`)

## Streams and laps

- Show lap splits for activity `{id}` (`strava_get_activity_laps`)
- Get compact HR/pace streams for activity `{id}` (`strava_get_activity_streams`)
- Export activity `{id}` as GPX from streams (`strava_format_workout_file`)

## Segments

- Explore run segments near bounds south=53.3 west=-6.4 north=53.4 east=-6.2 (`strava_explore_segments`)
- List my starred segments (`strava_list_starred_segments`)
- Leaderboard for segment `{id}` (`strava_get_segment_leaderboard`)

## Routes and clubs

- List my saved routes (`strava_list_routes`)
- Export route `{id}` as GPX base64 (`strava_export_route_gpx`)
- What clubs am I in? (`strava_list_clubs`)

## Intelligence (StrideIQ-only)

- Give me my coach brief (`get_coach_brief`)
- Am I connected to Strava? (`strava_connection_status` or `get_connection_status`)

## HTTP curl

```bash
curl -s -H "x-strideiq-api-key: $STRIDEIQ_API_KEY" \
  "http://localhost:3000/api/me/strava?action=zones"
```
