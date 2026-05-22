# StrideIQ — Strava Running Insights

Private **training intelligence dashboard** for runners. Import your Strava export locally, get narrative insights first (not just charts), then drill into performance, training, runs, goals, and reports.

See [PRODUCT.md](PRODUCT.md) for the product contract and roadmap phases.

**Your data never leaves your browser.** Parsing and analytics run client-side; an optional anonymized snapshot is saved to `localStorage`.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Connect Strava** (API sync) and/or upload your unzipped export folder (`activities.csv`). Both sources merge in the app.

## Get your Strava export

1. Strava → **Settings** → **My Account** → **Download or Delete Your Account**
2. Request your archive — Strava emails a download link when ready
3. Unzip the folder and upload it in the app

## Verify with sample data

If you have `export_105352925/` locally (gitignored), the dashboard should show **57 runs** and a longest run around **20.5 km**.

```bash
npm test
npm run build
```

Run these as separate commands (do not paste inline `#` comments on the same line — shells may pass `#` to Next.js as a directory).

## Pages (customer-facing IA)

| Route | Question it answers |
|-------|---------------------|
| `/home` | All five: improving, training, ready, next, changed |
| `/import` | Load CSV + FIT data |
| `/training` | Am I training correctly? (volume, blocks, efficiency) |
| `/performance` | Am I improving? (hub → trends, records, effort) |
| `/runs` | Searchable activity log |
| `/goals` | Am I ready? (HM readiness, predictions, weekly goal) |
| `/report` | What changed? (printable summary) |
| `/settings` | Import, privacy, units, data quality |
| `/coach` | Tool-grounded AI coach chat (Anthropic) |

## Route intelligence (movement replay)

- **Surface:** `/runs/[id]/route` — GPS replay with synchronized pace, HR, and elevation (MapLibre dark map).
- **Library:** `lib/route-intelligence/` — timeline merge, replay state, workout overlays, terrain segments (PostGIS-ready; see `db/migrations/003_route_geometry.sql`).
- **Data:** `gpsStream` on FIT/Strava streams — re-sync activities after upgrade to pull `latlng` + `altitude` from Strava API.

Legacy chart routes (`/dashboard`, `/trends`, …) still work.

## Coach chat & MCP

- **In-app:** `/coach` — LLM tool-use over deterministic intelligence. Set `OPENAI_API_KEY` (preferred) or `ANTHROPIC_API_KEY` in `.env.local`.
- **Reasoning tools:** compare sessions, explain readiness deltas, find best training phase, attribute improvement, analyze fade, PR context — see `docs/DIFFERENTIATION_NORTH_STAR.md`.
- **MCP:** `packages/strideiq-mcp` v0.2 — same tools for Claude Desktop (see package README).
- **API:** `GET /api/me/intelligence?section=brief|readiness|compare_sessions|readiness_delta|best_phase|…` — requires session or API key.
- **DB:** apply `db/migrations/002_coach.sql` so race goals sync server-side for coach/MCP parity.

## FIT files (V1.5) — two-step import

Strava’s CSV export references `activities/<id>.fit.gz` but often omits that folder.

1. **Step 1:** Upload your export folder (needs `activities.csv`)
2. **Step 2:** Upload only the `activities/` folder from the full Strava archive (or re-upload the whole unzipped export)

FIT streams are stored in **IndexedDB** on your device. Match uses the `Filename` column in `activities.csv` (e.g. `activities/19543214110.fit.gz` → your run).

## Architecture

```
lib/strava/      # Raw export parsers only
lib/domain/      # Normalized RunActivity models
lib/analytics/   # Metrics (charts evidence)
lib/insights/    # Narrative insight engine
lib/quality/     # Import validation & confidence
stores/          # Zustand (settings)
hooks/           # useTrainingIntelligence()
```

**Rule:** UI never reads raw Strava CSV shapes — only domain + insights.

**V2 (hosted):** Neon Postgres + Strava OAuth sync. Copy `.env.example` → `.env.local`, set `DATABASE_URL` from [Neon console](https://console.neon.tech), then use **Import → Connect with Strava**.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/auth/strava/authorize` | Start OAuth |
| `GET /api/auth/strava/callback` | Exchange code, initial sync |
| `POST /api/sync/strava` | Re-sync activities |
| `GET /api/me/import` | `StravaImport` JSON for the session user |
| `GET /api/me/fit-details` | Run stream/lap detail (same shape as FIT import) |
| `GET /api/me/status` | Connection + activity/stream counts |
| `GET /api/me/athlete-stats` | Strava YTD / recent run totals |
| `POST /api/sync/strava/streams` | Batch stream+laps sync (up to 40 runs) |
| `GET/POST /api/webhooks/strava` | Hub challenge + activity create/update/delete |
| `GET/POST /api/webhooks/strava/subscribe` | List or create Strava push subscription |

Schema: `db/migrations/001_initial.sql`. Sync fetches **activities**, then **streams + laps** (up to 40 runs per sync; rate-limit friendly). Legacy bulk export + FIT import still works.

### Auto-sync (webhooks)

1. Set `STRAVA_WEBHOOK_VERIFY_TOKEN` (any secret string) and `STRAVA_WEBHOOK_CALLBACK_URL` to your public `https://…/api/webhooks/strava` in `.env.local`.
2. For local dev, expose port 3000 with [ngrok](https://ngrok.com) (or similar) and use that HTTPS URL.
3. In **Settings**, click **Enable auto-sync** (requires Strava API connected). Strava will POST activity events; the server upserts or deletes runs in Neon.
4. Refresh the dashboard after a webhook sync to pull merged data into the browser (client does not live-push yet).

## Privacy

- Do not commit `export_*/` folders (see `.gitignore`)
- `profile.csv` email is never loaded into app state
- Clear data anytime from the header

## Tech stack

Next.js 16 · TypeScript · Tailwind CSS · Recharts · Zod · Papa Parse
