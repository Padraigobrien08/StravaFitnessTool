# StrideIQ architecture

StrideIQ is a **Next.js 16** application that ingests Strava activities, normalizes them into a stable domain model, runs deterministic analytics, and exposes results through dashboard pages, an **Athlete Intelligence Model**, and a **Coach** reasoning interface.

## Design principles

1. **UI never reads raw Strava CSV shapes** — parsing stays in `lib/strava`; features consume `lib/domain` and view models.
2. **Insights before charts** — narrative cards include evidence, severity, and confidence.
3. **LLMs orchestrate; engines decide** — Coach and MCP call tools backed by `lib/analytics`, `lib/reasoning`, and `lib/ecosystem`; the model must not invent metrics.
4. **Running vs ecosystem** — race performance and readiness are run-centric; bike/strength/yoga inform fatigue and interference context only unless explicitly scoped.

## Data paths

### Path A — Local import (privacy-first baseline)

```
Strava export folder (activities.csv + optional activities/*.fit.gz)
        ↓
lib/strava/* parsers
        ↓
lib/domain/mapFromStrava → RunActivity[]
        ↓
lib/analytics (client) + lib/insights
        ↓
React context (StravaProvider) + optional localStorage snapshot
```

- FIT streams: matched via `Filename` in CSV → parsed into **IndexedDB** (`lib/fit/`).
- Works without Neon or API keys; Coach chat requires server sync for tool-backed answers.

### Path B — Strava API + Neon (hosted sync)

```
OAuth → lib/sync/stravaSync → Neon (users, activities, streams, preferences)
        ↓
GET /api/me/import → StravaImport JSON for browser session
        ↓
Same analytics pipeline in browser (merged with local FIT if present)
```

- Webhooks (`/api/webhooks/strava`) can upsert/delete activities on push events.
- Coach (`POST /api/chat`), MCP, and `GET /api/me/intelligence` require this path (session or API key).

Both paths converge on the same **in-memory analytics** shape (`DashboardInsights`) inside the client after import load.

## Layer map

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Ingest | `lib/strava/`, `lib/sync/`, `lib/fit/` | CSV, API, FIT → raw then domain |
| Domain | `lib/domain/` | `RunActivity`, normalized fields |
| Analytics | `lib/analytics/` | Volume, fatigue, readiness, predictions, efficiency |
| Insights | `lib/insights/` | Question-tagged narrative cards |
| Reasoning | `lib/reasoning/` | compare_sessions, readiness delta, best phase, fade, PR context |
| Ecosystem | `lib/ecosystem/` | Multi-sport load, interference, archetype |
| Intelligence service | `lib/intelligence/` | Server bundle, tools, chat loop, API auth |
| Coach UI state | `lib/coach/`, `hooks/use-coach-thread.ts` | Workspace state, threads, response parsing |
| Athlete model UI | `lib/intelligence/athleteState.ts`, `presentation.ts` | Shared selectors for `/intelligence` and Coach context |
| View models | `lib/training/`, `lib/goals/`, `lib/report/` | Page-specific DTOs |
| Route intelligence | `lib/route-intelligence/` | GPS replay timeline, overlays |
| DB | `lib/db/`, `db/migrations/` | Neon schema, connections, preferences |

## Application surfaces

### Training dashboard (question-led IA)

| Route | Primary question |
|-------|------------------|
| `/home` | Summary across improving, training, ready, next, changed |
| `/training` | Am I training correctly? |
| `/performance` | Am I improving? |
| `/goals` | Am I ready for my goal? |
| `/runs`, `/runs/[id]` | Activity log and execution detail |
| `/runs/[id]/route` | GPS replay (pace, HR, elevation) |
| `/report` | What changed? (printable) |
| `/import`, `/settings` | Data load and preferences |

Legacy routes (`/dashboard`, `/trends`, `/effort`, `/records`, `/context`, `/activity-mix`) remain for bookmarks.

### Intelligence + Coach (reasoning layer)

| Route | Role |
|-------|------|
| `/intelligence` | **Persistent athlete model** — curated belief, signals, risks, memory, ecosystem, trajectory |
| `/coach` | **Investigation workspace** — threaded chat, tool-grounded answers, sidebar threads |

See [COACH_AND_INTELLIGENCE.md](COACH_AND_INTELLIGENCE.md).

## API overview

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/auth/strava/authorize` | — | Start OAuth |
| GET | `/api/auth/strava/callback` | — | OAuth callback + initial sync |
| POST | `/api/auth/logout` | session | Sign out |
| POST | `/api/sync/strava` | session | Manual re-sync |
| POST | `/api/sync/strava/streams` | session | Batch stream/lap sync |
| GET | `/api/me/import` | session | Activity bundle for client |
| GET | `/api/me/status` | session | Connection + counts |
| GET | `/api/me/fit-details` | session | Stream/lap payloads |
| GET/POST | `/api/me/preferences` | session | Race goal + coach settings |
| GET | `/api/me/intelligence` | session or API key | Tool execution / brief sections |
| POST | `/api/chat` | session | Coach LLM + tool loop |
| GET/POST | `/api/webhooks/strava` | Strava verify token | Push events |
| GET | `/api/health` | — | Health check |

## Intelligence tools (deterministic)

Registered in `lib/intelligence/tools.ts` and exposed to Coach chat and MCP:

**Core:** `get_coach_brief`, `get_readiness`, `get_predictions`, `get_week_plan`, `get_race_strategy`, `get_fatigue_load`, `list_recent_runs`, `get_data_quality`, `get_connection_status`

**Reasoning:** `compare_sessions`, `explain_readiness_delta`, `find_best_phase`, `attribute_improvement`, `analyze_fade_pattern`, `pr_context`

**Ecosystem:** `get_training_ecosystem`, `get_training_ecosystem_summary`, `get_modality_distribution`, `get_cross_training_support`, `get_interference_risks`, `get_athlete_archetype`, `compare_modality_blocks`, `get_race_week_interference_check`, `get_strength_mobility_support`

## Database migrations

Apply in order on Neon:

1. `001_initial.sql` — users, activities, streams
2. `002_coach.sql` — preferences, race goals
3. `003_route_geometry.sql` — route/GPS storage (PostGIS-ready)

Coach preferences auto-ensure via `lib/db/ensure-coach-schema.ts` when missing.

## Frontend conventions

- **App shell:** `components/app-shell.tsx` → `AppWorkspaceShell` (nav height, coach route body lock).
- **Data hook:** `hooks/useTrainingIntelligence()` — analytics + generated insights for most pages.
- **Shared intelligence:** `hooks/useAthleteIntelligence()` — workspace state for Intelligence + Coach.
- **Styling:** Tailwind v4, dark operational UI, teal accent, amber for risk.

## Testing

```bash
npm test      # vitest — parsers, analytics, reasoning units
npm run build # production typecheck + compile
```

## Related packages

- `packages/strideiq-mcp` — MCP server proxying `/api/me/intelligence` tools for external agents.
