# StrideIQ

**Private training intelligence for runners** — import Strava data, get evidence-backed insights, explore a persistent **Athlete Intelligence Model**, and investigate training questions with a tool-grounded **Coach**.

StrideIQ answers *why* things changed and *what to do next*, not only *what happened*. Analytics and reasoning run on deterministic engines; language layers (Coach, MCP) orchestrate tools and must not invent metrics.

📄 **Product contract:** [PRODUCT.md](PRODUCT.md)  
📚 **Full docs index:** [docs/README.md](docs/README.md)  
📋 **Every feature:** [docs/FEATURES.md](docs/FEATURES.md)  
🚀 **Deploy:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · **Smoke test:** [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md) · **MVP release:** [docs/RELEASE_MVP.md](docs/RELEASE_MVP.md)

---

## What StrideIQ is

| Layer | What you get |
|-------|----------------|
| **Dashboard** | Question-led pages: training load, performance, goals, runs, reports |
| **Intelligence** (`/intelligence`) | Curated **belief state** — signals, risks, memory, ecosystem, trajectory |
| **Coach** (`/coach`) | **Investigation chat** — threaded reasoning with server-backed tools |
| **Route replay** | GPS workspace with pace, HR, elevation (`/runs/[id]/route`) |
| **MCP** | Same intelligence tools in Claude Desktop via `packages/strideiq-mcp` |

---

## Quick start

### 1. Install and run

```bash
npm install
cp .env.example .env.local   # optional — see paths below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Choose a data path

| Path | `.env.local` | What works |
|------|----------------|------------|
| **A — Export only** | Empty or omit file | Home, Training, Goals, Plan (local), Runs, Report, Intelligence (client) |
| **B — Full stack** | Strava + Neon + LLM keys | Everything including OAuth sync, Coach, webhooks |

Details: [docs/RELEASE_MVP.md](docs/RELEASE_MVP.md) (what needs the API).

#### Path A — Export only (clean machine, ~5 min)

1. Strava → **Settings → My Account → Download or Delete Your Account** → request export → unzip.
2. App → **Import** → upload export folder (must include `activities.csv`).
3. Optional: second step — upload the `activities/` folder for FIT streams.
4. **Home** → confirm runs load.
5. **Goals** → set a race date.
6. **Plan** → optional context → **Generate** → **Save week**.
7. **Settings** → toggle theme; optional **Clear data** (confirmation dialog).

No `DATABASE_URL` or Strava API app required.

#### Path B — OAuth + Coach (~20 min first time)

1. Create [Neon](https://neon.tech) database; run migrations:

   ```bash
   psql "$DATABASE_URL" -f db/migrations/001_initial.sql
   psql "$DATABASE_URL" -f db/migrations/002_coach.sql
   psql "$DATABASE_URL" -f db/migrations/003_route_geometry.sql
   ```

2. Create [Strava API application](https://www.strava.com/settings/api); set callback domain to `localhost` for dev.

3. Fill `.env.local` from [`.env.example`](.env.example):

   ```bash
   DATABASE_URL=postgresql://...
   SESSION_SECRET=$(openssl rand -hex 32)
   STRAVA_CLIENT_ID=...
   STRAVA_CLIENT_SECRET=...
   STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/strava/callback
   OPENAI_API_KEY=sk-...
   ```

4. Restart `npm run dev` → **Import → Connect Strava** → sync.
5. **Goals** → race goal → **Plan** → generate + save → **Coach** → ask a training question.

### 3. Verify (CI gate)

```bash
npm run verify
```

Runs `npm test` then `npm run build`. For manual QA, use [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md).

### 4. Production deploy

[Vercel + Neon + Strava URLs](docs/DEPLOYMENT.md) — set production `STRAVA_REDIRECT_URI` and optional webhook callback, then run smoke Path C in [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md).

---

## Main routes

### Training dashboard

| Route | Question |
|-------|----------|
| `/home` | Am I improving, training well, ready, what next, what changed? |
| `/training` | Volume, blocks, efficiency, intensity |
| `/performance` | Trends, records, effort |
| `/goals` | Race readiness, predictions, weekly target |
| `/runs` | Activity log |
| `/runs/[id]` | Single-run execution analysis |
| `/runs/[id]/route` | Map replay + streams |
| `/report` | Printable change summary |
| `/import` | CSV / FIT / Strava OAuth |
| `/settings` | Units, privacy, webhooks, data quality |

### Intelligence & Coach

| Route | Role |
|-------|------|
| `/intelligence` | **Athlete Intelligence Model** — what the system currently believes (not a chat UI) |
| `/coach` | **Investigation workspace** — ask why, compare blocks, challenge recommendations |

Deep link from Intelligence → Coach: `?domain=…`, `?q=…`, `?topic=…`, `&investigate=1`.

Details: [docs/COACH_AND_INTELLIGENCE.md](docs/COACH_AND_INTELLIGENCE.md).

Legacy chart URLs (`/dashboard`, `/trends`, `/effort`, `/records`, `/context`) still work.

---

## Data & privacy

### Two data paths (same analytics in the browser)

```
Local export (CSV + optional FIT)  →  parsers  →  domain  →  analytics  →  UI
Strava OAuth + Neon                →  sync API  →  /api/me/import  →  same pipeline
```

- **Local:** Parsing runs in the browser; optional `localStorage` snapshot; FIT streams in **IndexedDB**. No account required.
- **Hosted:** Activities and streams in **Neon**; session cookie for API; required for Coach tool loop and MCP.

**Privacy notes**

- Do not commit `export_*/` folders ([`.gitignore`](.gitignore)).
- `profile.csv` email is not loaded into app state.
- **Clear data** from the app header resets client state.
- When Strava sync is enabled, activity data is stored server-side for your account only.

---

## Coach, API, and MCP

### In-app Coach (`/coach`)

- Fixed-height chat UI: scrollable thread, sticky composer, investigation sidebar, context rail.
- `POST /api/chat` — OpenAI (preferred) or Anthropic with **tool-use** over deterministic intelligence.
- Threads stored in **browser localStorage** (`lib/coach/threadStorage.ts`).

### HTTP intelligence API

```http
GET /api/me/intelligence?section=brief|readiness|compare_sessions|...
```

Auth: session cookie (browser) or `STRIDEIQ_API_KEY` + `STRIDEIQ_API_KEY_USER_ID` (automation).

### Reasoning tools (engines, not LLM guesses)

| Tool | Purpose |
|------|---------|
| `compare_sessions` | Compare recent workouts |
| `explain_readiness_delta` | Why readiness moved |
| `find_best_phase` | Strongest training phases |
| `attribute_improvement` | What preceded gains |
| `analyze_fade_pattern` | Late-run pace fade |
| `pr_context` | Training before PRs |
| `get_training_ecosystem` | Multi-sport fatigue context |
| + core | readiness, predictions, week plan, fatigue, data quality, … |

Full list: [docs/ARCHITECTURE.md](ARCHITECTURE.md).

### MCP package

```bash
cd packages/strideiq-mcp && npm install && npm run build
```

See [packages/strideiq-mcp/README.md](packages/strideiq-mcp/README.md) for Claude Desktop config.

---

## FIT import (two-step)

Strava’s CSV often references `activities/<id>.fit.gz` without including files.

1. Upload export folder (must include `activities.csv`).
2. Upload the `activities/` folder from the full archive (or the whole unzip).

FIT data is matched via the `Filename` column and stored in IndexedDB for stream-rich run detail.

---

## Strava webhooks (auto-sync)

1. Set `STRAVA_WEBHOOK_VERIFY_TOKEN` and public `STRAVA_WEBHOOK_CALLBACK_URL` (e.g. ngrok → `https://….ngrok-free.app/api/webhooks/strava`).
2. **Settings → Enable auto-sync** (requires API connection).
3. Refresh the app after webhook events (client does not live-push yet).

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/webhooks/strava` | Challenge + activity events |
| `GET/POST /api/webhooks/strava/subscribe` | Manage subscription |

---

## Environment variables

Copy [`.env.example`](.env.example) → `.env.local` (never commit `.env.local`).

| Variable | Required for |
|----------|----------------|
| `DATABASE_URL` | Strava sync, Coach, MCP |
| `SESSION_SECRET` | Signed session cookies (when using DB) |
| `STRAVA_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | OAuth |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Coach chat + AI plan |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` / `STRAVA_WEBHOOK_CALLBACK_URL` | Push auto-sync |
| `STRIDEIQ_API_KEY` + `STRIDEIQ_API_KEY_USER_ID` | MCP / automation (optional) |
| `NEXT_PUBLIC_FORECAST_LAB=1` | Forecast lab in production (optional) |

Full comments and production examples: [`.env.example`](.env.example), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Project structure

```
app/                    # Next.js routes (pages + API)
components/
  intelligence/         # Athlete Intelligence Model UI
  coach/                # Coach workspace UI
  training/ goals/ …    # Dashboard feature UI
lib/
  strava/ domain/       # Ingest + normalized activities
  analytics/ insights/  # Metrics + narrative engine
  reasoning/            # Deterministic reasoning primitives
  ecosystem/            # Multi-sport context
  intelligence/         # Server bundle, tools, chat
  coach/                # Workspace state, threads, parsing
  route-intelligence/   # GPS replay
  db/ sync/             # Neon + Strava sync
hooks/                  # useTrainingIntelligence, useAthleteIntelligence, …
db/migrations/          # SQL schema
packages/strideiq-mcp/  # MCP server
docs/                   # Architecture + product deep dives
```

**Rule:** UI consumes domain models and view models — never raw Strava CSV rows.

Architecture detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Tech stack

- **Framework:** Next.js 16, React 19, TypeScript
- **UI:** Tailwind CSS v4, Recharts, MapLibre GL
- **Data:** Papa Parse, fit-file-parser, Zod, Zustand
- **Database:** Neon Postgres (`@neondatabase/serverless`)
- **Testing:** Vitest

---

## Differentiation roadmap

StrideIQ is evolving from “dashboard + chat” toward **interactive endurance reasoning** and **personal adaptation intelligence**.

North star and gap analysis: [docs/DIFFERENTIATION_NORTH_STAR.md](docs/DIFFERENTIATION_NORTH_STAR.md).

---

## License

Private project — not licensed for public redistribution unless otherwise noted.
