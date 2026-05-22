# @strideiq/mcp

MCP server exposing StrideIQ **deterministic training intelligence** to Claude Desktop, Cursor, and other MCP clients.

Requires a running StrideIQ app (`npm run dev`) with Strava connected and data synced.

## Setup

1. Apply DB migration `db/migrations/002_coach.sql` in Neon.
2. Set race goal on **Goals** and open **Coach** once (syncs preferences to server).
3. Build the server:

```bash
cd packages/strideiq-mcp
npm install
npm run build
```

## Auth (pick one)

### Session cookie (local dev)

1. Sign in via Strava in the browser.
2. Copy `strideiq_session` cookie value from DevTools.
3. Set env:

```bash
export STRIDEIQ_SESSION_COOKIE="your-cookie-value"
export STRIDEIQ_BASE_URL="http://localhost:3000"
```

### API key (automation)

In `.env.local` on the Next app:

```bash
STRIDEIQ_API_KEY=your-secret-key
STRIDEIQ_API_KEY_USER_ID=uuid-of-your-user-in-neon
```

MCP env:

```bash
export STRIDEIQ_API_KEY=your-secret-key
```

## Claude Desktop config

```json
{
  "mcpServers": {
    "strideiq": {
      "command": "node",
      "args": ["/absolute/path/to/StravaFitnessTool/packages/strideiq-mcp/dist/index.js"],
      "env": {
        "STRIDEIQ_BASE_URL": "http://localhost:3000",
        "STRIDEIQ_SESSION_COOKIE": "paste-session-token-here"
      }
    }
  }
}
```

## Tools

| Tool | Maps to |
|------|---------|
| `get_coach_brief` | `GET /api/me/intelligence?section=brief` |
| `get_readiness` | `?section=readiness` |
| `get_predictions` | `?section=predictions` |
| `get_week_plan` | `?section=plan` |
| `get_race_strategy` | `?section=strategy&strategyMode=even` |
| `get_fatigue_load` | `?section=fatigue` |
| `list_recent_runs` | `?section=runs&limit=10` |
| `get_data_quality` | `?section=quality` |
| `get_connection_status` | `?section=status` |
| `compare_sessions` | `?section=compare_sessions&type=tempo&n=3` |
| `explain_readiness_delta` | `?section=readiness_delta&weeks=1` |
| `find_best_phase` | `?section=best_phase&metric=aerobic` |
| `attribute_improvement` | `?section=attribute&metric=pace` |
| `analyze_fade_pattern` | `?section=fade&distanceKm=15` |
| `pr_context` | `?section=pr_context&bucket=hm` |

### Example questions (reasoning)

- Why did my readiness drop this week?
- Compare my last 3 threshold sessions
- When was my strongest aerobic block?
- Why do I fade after 15 km?
- What changed before my HM PR?
