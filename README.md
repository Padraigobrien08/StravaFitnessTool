# StrideIQ

**Private training intelligence for runners** — import Strava data, get evidence-backed insights, explore a persistent **Athlete Intelligence Model**, and investigate training questions with a tool-grounded **Coach**.

StrideIQ answers *why* things changed and *what to do next*, not only *what happened*. Analytics and reasoning run on deterministic engines; language layers (Coach, MCP) orchestrate tools and must not invent metrics.

📄 **Product contract:** [PRODUCT.md](PRODUCT.md)  
📚 **Full docs index:** [docs/README.md](docs/README.md)

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
cp .env.example .env.local   # optional for Strava sync + Coach
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Load data (choose one or both)

| Method | Best for | Coach / server tools |
|--------|----------|----------------------|
| **Strava export folder** | Offline, privacy-first | Limited (local analytics only) |
| **Connect Strava (OAuth)** | Live sync, Coach, MCP | Full |

**Export import:** Strava → Settings → Download account data → unzip → upload in **Import** (`activities.csv` required).

**API sync:** Set `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `DATABASE_URL` (Neon) in `.env.local` → **Import → Connect Strava** → sync activities.

### 3. Optional — Coach chat

```bash
# .env.local
OPENAI_API_KEY=sk-...          # preferred
# or ANTHROPIC_API_KEY=...

DATABASE_URL=postgresql://...  # Neon
SESSION_SECRET=$(openssl rand -hex 32)
```

Apply DB migrations (`db/migrations/001_initial.sql`, `002_coach.sql`, `003_route_geometry.sql`). Set a race goal on **Goals**, sync runs, then open **Coach**.

### 4. Verify

```bash
npm test
npm run build
```

Run as **separate** commands (do not paste shell comments on the same line as `npm`).

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

Copy [`.env.example`](.env.example) → `.env.local`.

| Variable | Required for |
|----------|----------------|
| `DATABASE_URL` | Strava sync, Coach, MCP |
| `SESSION_SECRET` | Signed session cookies |
| `STRAVA_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | OAuth |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Coach chat |
| `STRAVA_WEBHOOK_*` | Push auto-sync |
| `STRIDEIQ_API_KEY` | MCP / automation (optional) |

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
