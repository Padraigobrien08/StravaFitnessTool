# StrideIQ — Complete feature catalog

This document lists **every user-facing and system feature** in StrideIQ as of the current codebase. For setup and architecture, see [README.md](../README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Table of contents

1. [Product overview](#1-product-overview)
2. [Data ingestion & storage](#2-data-ingestion--storage)
3. [Analytics engines](#3-analytics-engines)
4. [Insight engine](#4-insight-engine)
5. [Application pages](#5-application-pages)
6. [Goals & race forecasting](#6-goals--race-forecasting)
7. [Athlete Intelligence Model](#7-athlete-intelligence-model)
8. [Coach investigation workspace](#8-coach-investigation-workspace)
9. [Route replay & run detail](#9-route-replay--run-detail)
10. [API & server capabilities](#10-api--server-capabilities)
11. [Intelligence tools (deterministic)](#11-intelligence-tools-deterministic)
12. [MCP package](#12-mcp-package)
13. [Developer & internal tools](#13-developer--internal-tools)
14. [Settings & preferences](#14-settings--preferences)
15. [Quality, privacy & confidence](#15-quality-privacy--confidence)
16. [Testing & verification](#16-testing--verification)
17. [Feature index by route](#17-feature-index-by-route)

---

## 1. Product overview

| Concept | Description |
|---------|-------------|
| **Positioning** | Private training intelligence for runners — not a chart warehouse |
| **Core loop** | Import Strava data → deterministic analytics → narrative insights → investigate with Coach |
| **Design rule** | LLMs orchestrate; engines compute metrics. Coach must not invent numbers. |
| **Two data paths** | Local export (browser-only) vs Strava OAuth + Neon (full Coach/MCP) |

**Primary user questions** (from [PRODUCT.md](../PRODUCT.md)):

| Question | Main surfaces |
|----------|----------------|
| Am I improving? | Home, Performance, Records, Trends |
| Am I training correctly? | Training, Effort, intensity advice |
| Am I ready for my goal? | Goals, readiness, predictions |
| What should I do next? | Home recommendations, week plan |
| What changed recently? | Home, Report |
| What does the system believe? | Intelligence (`/intelligence`) |
| Why / compare / investigate? | Coach (`/coach`) |

---

## 2. Data ingestion & storage

### 2.1 Strava export import (local)

| Feature | Description | Location |
|---------|-------------|----------|
| **CSV activities import** | Upload Strava `activities.csv` from export folder | `lib/strava/parseActivities.ts`, `/import` |
| **Profile / zones files** | Optional companion CSVs from export | Import flow |
| **Export folder validation** | Checks required files, row counts, date span | `lib/quality/assessImport.ts` |
| **localStorage snapshot** | Persists parsed import for return visits | `lib/storage/local.ts` |
| **Clear data** | Resets client import + insights from header | `StravaProvider.clearData` |
| **Data source labeling** | Shows “Strava export”, “Strava API”, or merged | `lib/data/mergeImport.ts` |

### 2.2 FIT file import

| Feature | Description | Location |
|---------|-------------|----------|
| **FIT upload (step 2)** | Match `activities/<id>.fit.gz` via `Filename` column | `/import`, `lib/strava/parseFit.ts` |
| **Best efforts from FIT** | Lap blocks and device best efforts for predictions | `lib/strava/fitTypes.ts` |
| **IndexedDB storage** | Stream-rich detail stored per activity | `lib/storage/fit-db.ts` |
| **Merge with API runs** | FIT detail enriches Strava API activities | `enrichImportWithFitDetails` |

### 2.3 Strava OAuth & API sync

| Feature | Description | Location |
|---------|-------------|----------|
| **OAuth connect** | Connect Strava account | `/api/auth/strava/*`, `/import` |
| **Activity sync** | Pull activities into Neon Postgres | `lib/sync/stravaSync.ts` |
| **Stream sync** | GPS, HR, cadence, elevation streams | `lib/sync/stravaStreams.ts` |
| **Manual re-sync** | Refresh activities from API | `/api/sync/strava`, Import UI |
| **Session auth** | Signed cookie for API routes | `lib/auth/session.ts` |
| **GET /api/me/import** | Hydrates browser with server activities | Used on load when connected |

### 2.4 Webhooks

| Feature | Description | Location |
|---------|-------------|----------|
| **Webhook verification** | Strava subscription challenge | `/api/webhooks/strava` |
| **Activity create/update/delete** | Upsert or remove activities on push | Webhook handler |
| **Subscription management** | Enable/disable from Settings | `/api/webhooks/strava/subscribe`, Settings card |

### 2.5 Domain model

| Feature | Description | Location |
|---------|-------------|----------|
| **RunActivity** | Normalized run shape for all features | `lib/strava/types.ts`, `lib/domain/` |
| **NormalizedActivity** | Cross-sport shape for ecosystem | `lib/ecosystem/types.ts` |
| **No raw CSV in UI** | Parsers isolated in `lib/strava` | Enforced by architecture |

---

## 3. Analytics engines

All metrics flow through `computeInsights()` → `DashboardInsights` (`lib/analytics/index.ts`).

### 3.1 Volume & consistency

| Engine | Output | Module |
|--------|--------|--------|
| Weekly / monthly volume | km and run counts by period | `lib/analytics/volume.ts` |
| Last 7 days summary | Recent distance and run count | `volume.ts` |
| Rolling 4-week blocks | Training block labels, distance, longest run | `lib/analytics/block.ts` |
| Best training block | Peak block identification | `block.ts` |
| Consistency score | Rhythm vs target frequency | `lib/analytics/consistency.ts` |
| Week snapshots | Current vs previous ISO week | `lib/analytics/week.ts` |
| Weekly narrative | Deterministic prose week-in-review | `lib/analytics/narrative.ts` |

### 3.2 Pace, HR & efficiency

| Engine | Output | Module |
|--------|--------|--------|
| Pace trend | Rolling pace over time | `lib/analytics/trends.ts` |
| HR trend | Average HR trend | `trends.ts` |
| HR zones | Time in zones, easy/hard split | `lib/analytics/hrZones.ts` |
| Aerobic efficiency | Pace per HR trend | `lib/analytics/efficiency.ts` |
| Efficiency month-over-month | MoM narrative | `efficiency.ts` |
| Elevation per km | Climbing load | `lib/analytics/elevation.ts` |

### 3.3 Load & fatigue

| Engine | Output | Module |
|--------|--------|--------|
| Training load by run | Per-run load score | `lib/analytics/trainingLoad.ts` |
| Fitness index | Composite fitness signal | `trainingLoad.ts` |
| CTL / ATL / TSB | Acute-chronic workload | `lib/analytics/fatigue.ts` |
| Fatigue snapshot | Freshness score, label | `fatigue.ts` |
| Weekly load series | History for charts | `fatigue.ts` |

### 3.4 Intensity & workout typing

| Engine | Output | Module |
|--------|--------|--------|
| Workout classification | Easy, tempo, interval, long, race-like | `lib/analytics/workoutType.ts` |
| Intensity advice | Hard runs in 14d, easy %, status | `lib/analytics/intensityAdvisor.ts` |
| Easy/hard distribution | HR-based split | `hrZones.ts` |

### 3.5 Records & predictions (V1)

| Engine | Output | Module |
|--------|--------|--------|
| Personal records | 5K, 10K, HM, long buckets | `lib/analytics/records.ts` |
| Race predictions (legacy) | Riegel-style table | `records.ts` |
| Race prediction analysis | Power-law regression, model consensus, 120+ efforts | `lib/analytics/predictions.ts` |
| Prediction timeline | Weekly consensus HM/10K over time | `lib/analytics/progression.ts` |
| PR timeline | PR events over time | `progression.ts` |

### 3.6 Readiness & goals

| Engine | Output | Module |
|--------|--------|--------|
| Half marathon readiness (legacy) | Score from long run + volume | `lib/analytics/readiness.ts` |
| Race readiness (multi-distance) | 5K, 10K, HM, marathon configs | `readiness.ts` |
| Long run vs race distance | % of official race distance (21.1 km HM) | `readiness.ts` |
| Goal progress | Weekly run target vs actual | `lib/analytics/goals.ts` |
| Gap analysis | Metric vs target for race prep | `readiness.ts` |

### 3.7 Race execution

| Engine | Output | Module |
|--------|--------|--------|
| Race strategy simulation | Even / negative / conservative / aggressive pacing | `lib/analytics/raceStrategy.ts` |
| Segment pacing table | Per-km or per-mile targets | `raceStrategy.ts` |
| Fade risk | Low / medium / high | `raceStrategy.ts` |

### 3.8 Training ecosystem (multi-sport)

| Engine | Output | Module |
|--------|--------|--------|
| Modality detection | Run, ride, strength, etc. from Strava types | `lib/ecosystem/modality.ts` |
| Cross-training load | Non-run volume context | `lib/ecosystem/aggregates.ts` |
| Interference risks | Strength/cycle crowding race prep | `lib/ecosystem/interference.ts` |
| Athlete archetype | Training profile label | `lib/ecosystem/archetype.ts` |
| Ecosystem insights | Narrative cards for insights engine | `lib/ecosystem/insights.ts` |

### 3.9 Context & mix

| Engine | Output | Module |
|--------|--------|--------|
| Activity type mix | Sport distribution | `lib/analytics/context.ts` |
| Data confidence | low / medium / high from import quality | Set in `computeInsights` |

---

## 4. Insight engine

| Feature | Description | Location |
|---------|-------------|----------|
| **Question tags** | `improving`, `training`, `ready`, `next`, `changed` | `lib/insights/types.ts` |
| **Insight cards** | Title, severity, evidence[], recommendation, confidence | `generateInsights()` |
| **Rule-based generation** | PRs, efficiency, fatigue, intensity, readiness, ecosystem | `lib/insights/generate.ts` |
| **Home filtering** | Rows grouped by question on `/home` | `lib/home/dashboardData.ts` |
| **Import quality coupling** | Confidence capped by data quality | `assessImportQuality` |

---

## 5. Application pages

### 5.1 Home (`/home`)

| Feature | Description |
|---------|-------------|
| Hero intelligence | Top insight summary and severity |
| This week / next week ops | Volume, runs, intensity operational cards |
| Insights engine | Cards by question (improving, training, ready, …) |
| Progression momentum | PR and prediction trajectory sparklines |
| Goal mission control | Quick link to race goal state |
| Data quality footer | Import completeness |
| Strava sync button | When API connected |

### 5.2 Training (`/training`)

| Feature | Description |
|---------|-------------|
| Volume charts | Weekly distance trends |
| Training blocks | 4-week rolling blocks |
| Efficiency panel | Aerobic efficiency trend |
| Intensity distribution | Easy vs hard |
| Fatigue / load | CTL, ATL, TSB visualization |
| Training ecosystem summary | Multi-sport context |
| Week plan preview | Next-week structure from plan engine |

### 5.3 Performance (`/performance`)

| Feature | Description |
|---------|-------------|
| Pace & HR trends | Longitudinal charts |
| Personal records | Best times by distance |
| Race projection | V1 corridor and models |
| Effort curve | Power-law fit visualization |
| Efficiency summary | Trend and evidence |
| Insight cards | Performance-tagged narratives |

### 5.4 Goals (`/goals`)

See [§6 Goals & race forecasting](#6-goals--race-forecasting).

### 5.5 Runs (`/runs`, `/runs/[id]`)

| Feature | Description |
|---------|-------------|
| Activity log | Searchable, sortable run list |
| Workout labels | Type classification per run |
| Single-run detail | Pace, HR, splits, execution score |
| Link to route replay | When streams available |

### 5.6 Report (`/report`)

| Feature | Description |
|---------|-------------|
| Printable summary | What changed — readiness, predictions, risks |
| Intelligence report layout | Composed from view models |
| Export-friendly styling | Print CSS |

### 5.7 Import (`/import`)

| Feature | Description |
|---------|-------------|
| CSV upload | Drag/drop or file picker |
| FIT folder upload | Second-step stream enrichment |
| Strava OAuth | Connect and sync |
| Import quality report | Warnings and completeness |
| Sync status | Run counts, stream counts |

### 5.8 Legacy / chart routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | Redirects or legacy dashboard |
| `/trends` | Pace/volume trend charts |
| `/effort` | Effort distribution |
| `/records` | PR table and timeline |
| `/context` | Activity mix |
| `/activity-mix` | Sport type breakdown |

---

## 6. Goals & race forecasting

### 6.1 Race goal configuration

| Feature | Description | Location |
|---------|-------------|----------|
| Race distance | 5K, 10K, HM, marathon | `stores/goal-store.ts` |
| Race date | Countdown on hero | Goal picker |
| Target time | Optional goal time | Goal picker |
| Server sync | Preferences stored in Neon when connected | `lib/db/user-preferences.ts` |

### 6.2 AI-native race briefing (primary UI when V2 available)

| Feature | Description | Location |
|---------|-------------|----------|
| **Current belief** | Narrative tying key efforts to forecast | `lib/goals/goalsRaceBrief.ts` |
| **Primary action** | V2 recommendation (trimmed) | `GoalsRaceBrief` component |
| **Evidence bullets** | Contributors + uncertainty drivers | `components/goals/goals-race-brief.tsx` |
| **Confidence line** | Label + why (drivers) | Brief view model |
| **Ask Coach chips** | Deep links with `investigate=1` | `components/goals/goals-coach-prompts.tsx` |
| **See models & math** | Collapsible drawer with full V2 panel | `components/goals/goals-evidence-drawer.tsx` |
| **Legacy V1 toggle** | Optional comparison to old 2h14m-style integrity | Page link |

### 6.3 Forecasting Engine V2

| Component | Description | Location |
|-----------|-------------|----------|
| Capability models | Riegel, power-law, multi-effort, recent anchor | `lib/forecasting-v2/capabilityModels.ts` |
| Durability | Long-run support vs race distance | `durabilityModel.ts` |
| Freshness | TSB/fatigue time adjustment | `freshnessModel.ts` |
| Specificity | Distance-relevant efforts and volume | `specificityModel.ts` |
| Execution | Fade/pacing risk, conservative padding | `executionModel.ts` |
| Uncertainty | Interval width, confidence label | `uncertaintyModel.ts` |
| Contributors | Positive/negative/neutral factors | `contributionModel.ts` |
| Scenarios | Expected / conservative / optimistic / fade | `scenarioModel.ts` |
| Observability | Model weights, evidence chain, warnings | `forecastObservability.ts` |
| Near-race cap | ≥90% race-distance efforts cap headline time | `forecastEngine.ts` |
| Key efforts | Top 3 relevant runs for narrative | `forecastV2ViewModel.ts` |

### 6.4 Goals page panels (supporting)

| Panel | Description |
|-------|-------------|
| Readiness intelligence | Dimension scores: long run, volume, freshness, … |
| Execution intelligence | Pacing mode picker + segment chart |
| Trajectory forecast | Prediction timeline chart (goal distance) |
| Projection curve | V1 power-law curve |
| Goal risks | Ranked risks with mitigation |
| Historical readiness | Best block, trajectory bullets |
| Explainability | Assumptions and limitations footer |

### 6.5 Forecast evaluation workbench (internal)

| Feature | Description | Location |
|---------|-------------|----------|
| `evaluateForecastV2` | Sanity + recommendation rules | `lib/forecasting-v2/evaluation/` |
| Fixture athletes | 10 synthetic profiles | `evaluation/fixtures.ts` |
| Production readiness gate | All fixtures must pass expectations | `evaluateAllForecastFixtures()` |
| Forecast Lab UI | `/dev/forecast-lab` | `app/dev/forecast-lab/` |

---

## 7. Athlete Intelligence Model

**Route:** `/intelligence`

| Section | Feature |
|---------|---------|
| **Hero** | Current belief, primary action, readiness/freshness/confidence |
| **State evolution** | Sparklines: readiness, freshness, efficiency, volume, intensity |
| **Signal board** | Primary + secondary signals, watchlist |
| **Decision support** | Risks, opportunities, actions with Coach links |
| **Athlete memory** | Learned patterns from training history |
| **Training ecosystem** | Multi-sport interpretation, interference detail |
| **Investigate cards** | Deep links to Coach domains |

**Key modules:** `lib/intelligence/athleteState.ts`, `lib/intelligence/presentation.ts`, `lib/coach/activeIntelligence.ts`

---

## 8. Coach investigation workspace

**Route:** `/coach`

| Feature | Description |
|---------|-------------|
| **Threaded conversations** | Multiple investigations in sidebar |
| **localStorage persistence** | Threads survive refresh |
| **Structured responses** | Summary, recommendation, evidence, risks (parsed) |
| **Tool-grounded answers** | LLM calls deterministic intelligence tools |
| **Domain starters** | Race prep, readiness, performance, … |
| **URL deep links** | `?domain=`, `?q=`, `?investigate=1` |
| **Context rail** | Readiness, race, risks snapshot |
| **Mini context (desktop)** | Collapsible right rail |
| **Mobile sidebar** | Thread list overlay |
| **Analysis loader** | Shows active tool names while thinking |
| **Follow-up chips** | Suggested next questions |

**Requirements:** Neon sync, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, race goal recommended.

**API:** `POST /api/chat` → `lib/intelligence/chat.ts`

---

## 9. Route replay & run detail

### 9.1 Route replay (`/runs/[id]/route`)

| Feature | Description | Location |
|---------|-------------|----------|
| MapLibre map | GPS track on basemap | `components/route-replay/` |
| Playback controls | Play/pause, scrub timeline | `lib/route-intelligence/replay.ts` |
| Pace overlay | Color by pace | `overlays.ts` |
| HR overlay | Color by heart rate | `overlays.ts` |
| Elevation profile | Chart synced to position | `elevation.ts` |
| Timeline | Unified time/distance index | `timeline.ts` |
| Stream downsampling | Performance for long activities | `lib/strava/downsample.ts` |

### 9.2 Workout detail (`/runs/[id]`)

| Feature | Description |
|---------|-------------|
| Execution analysis | Pace consistency, HR drift |
| Workout naming | Friendly title from type + distance |
| FIT-backed splits | When lap data available |

---

## 10. API & server capabilities

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/auth/strava/authorize` | Start OAuth |
| GET | `/api/auth/strava/callback` | OAuth callback + sync |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/sync/strava` | Manual activity sync |
| POST | `/api/sync/strava/streams` | Batch stream sync |
| GET | `/api/me/import` | Activity bundle for client |
| GET | `/api/me/status` | Connection status |
| GET | `/api/me/athlete-stats` | Athlete metadata |
| GET | `/api/me/fit-details` | All FIT/stream details |
| GET | `/api/me/fit-details/[activityId]` | Single activity streams |
| GET/POST | `/api/me/preferences` | Race goal + coach prefs |
| GET | `/api/me/intelligence` | Tool execution / brief sections |
| POST | `/api/chat` | Coach LLM + tool loop |
| GET/POST | `/api/webhooks/strava` | Strava push events |
| GET/POST | `/api/webhooks/strava/subscribe` | Webhook subscription |

**Auth modes:** Session cookie (browser) or `STRIDEIQ_API_KEY` + `STRIDEIQ_API_KEY_USER_ID` (automation/MCP).

---

## 11. Intelligence tools (deterministic)

Used by Coach (`POST /api/chat`) and MCP (`GET /api/me/intelligence`). Defined in `lib/intelligence/types.ts`.

### Core tools

| Tool | Purpose |
|------|---------|
| `get_coach_brief` | High-level training brief |
| `get_readiness` | Race readiness score, gaps, signals |
| `get_predictions` | V1 race prediction analysis |
| `get_week_plan` | Suggested next-week structure |
| `get_race_strategy` | Pacing strategy for goal distance |
| `get_fatigue_load` | CTL/ATL/TSB and freshness |
| `list_recent_runs` | Recent activities with metadata |
| `get_data_quality` | Import completeness |
| `get_connection_status` | Strava connection state |

### Reasoning tools

| Tool | Purpose |
|------|---------|
| `compare_sessions` | Compare recent workouts by type |
| `explain_readiness_delta` | Why readiness changed |
| `find_best_phase` | Strongest training block |
| `attribute_improvement` | What preceded gains |
| `analyze_fade_pattern` | Late-run pace fade |
| `pr_context` | Training before PRs |

### Ecosystem tools

| Tool | Purpose |
|------|---------|
| `get_training_ecosystem` | Full ecosystem payload |
| `get_training_ecosystem_summary` | Short summary |
| `get_modality_distribution` | Sport mix |
| `get_cross_training_support` | How non-run helps/hurts |
| `get_interference_risks` | Crowding risks |
| `get_athlete_archetype` | Profile label |
| `compare_modality_blocks` | Compare two blocks |
| `get_race_week_interference_check` | Race-week cross-training check |
| `get_strength_mobility_support` | Strength/mobility context |

---

## 12. MCP package

**Package:** `packages/strideiq-mcp`

| Feature | Description |
|---------|-------------|
| MCP server | Intelligence + full Strava API proxy (strava-mcp parity, 25+ tools) |
| Session or API key auth | Cookie or `STRIDEIQ_API_KEY` |
| Tool parity | Same deterministic outputs as web Coach |
| Strava MCP | Built-in — no external `@r-huijts/strava-mcp-server` required |

See [packages/strideiq-mcp/README.md](../packages/strideiq-mcp/README.md), [MCP_INTEGRATION.md](./MCP_INTEGRATION.md), [MCP_STRAVA_SMOKE.md](./MCP_STRAVA_SMOKE.md).

---

## 13. Developer & internal tools

| Feature | Route / location | Purpose |
|---------|------------------|---------|
| **Forecast Lab** | `/dev/forecast-lab` | V2 fixture evaluation UI (dev; prod needs `NEXT_PUBLIC_FORECAST_LAB=1`) |
| **Evaluation harness** | `lib/forecasting-v2/evaluation/` | Automated forecast validation |
| **Vitest suite** | `npm test` | Unit tests across analytics, forecasting, reasoning |
| **AGENTS.md** | Repo root | Agent-oriented codebase guide |

---

## 14. Settings & preferences

**Route:** `/settings`

| Setting | Storage |
|---------|---------|
| Distance unit | km / mi (Zustand + localStorage) |
| Pace unit | min/km / min/mi |
| Default weekly runs | Target frequency |
| Max weekly km | Volume cap hint |
| Race goal | Goal store + server preferences |
| Strava webhooks | Enable auto-sync |
| Clear all data | Client + optional server |

---

## 15. Quality, privacy & confidence

| Feature | Description | Location |
|---------|-------------|----------|
| Import quality report | Missing streams, date span, HR coverage | `lib/quality/assessImport.ts` |
| Data quality panel | Shown on major pages | `components/layout/data-quality-panel.tsx` |
| Per-insight confidence | low / medium / high | Insight type |
| Analytics data confidence | Derived from import | `DashboardInsights.dataConfidence` |
| Profile email excluded | Not loaded from `profile.csv` | Parser policy |
| `.gitignore` for exports | Prevents committing Strava dumps | `.gitignore` |

---

## 16. Testing & verification

| Area | Test location |
|------|----------------|
| Analytics (readiness, fatigue, predictions, …) | `lib/analytics/__tests__/` |
| Forecasting V2 | `lib/forecasting-v2/__tests__/` |
| Forecast evaluation | `lib/forecasting-v2/evaluation/__tests__/` |
| Goals race brief | `lib/goals/__tests__/` |
| Reasoning tools | `lib/reasoning/__tests__/` |
| Intelligence tools | `lib/intelligence/__tests__/` |
| Ecosystem | `lib/ecosystem/__tests__/` |
| Route intelligence | `lib/route-intelligence/__tests__/` |
| Charts | `lib/charts/__tests__/` |

```bash
npm test
npm run build
```

---

## 17. Feature index by route

| Route | Features |
|-------|----------|
| `/` | Landing / redirect |
| `/home` | Hero, week ops, insights, progression, goal mission, sync |
| `/training` | Volume, blocks, efficiency, fatigue, ecosystem, plan |
| `/performance` | Trends, records, projections, insights |
| `/goals` | Race briefing (V2), readiness, execution, trajectory, risks |
| `/runs` | Activity list |
| `/runs/[id]` | Workout detail |
| `/runs/[id]/route` | Map replay, pace/HR/elevation |
| `/intelligence` | Athlete belief model, signals, memory, ecosystem |
| `/coach` | Investigation chat, tools, threads |
| `/report` | Printable change report |
| `/import` | CSV, FIT, OAuth, quality |
| `/settings` | Units, goal, webhooks, privacy |
| `/dev/forecast-lab` | Forecast V2 validation workbench |
| `/dashboard`, `/trends`, `/effort`, `/records`, `/context`, `/activity-mix` | Legacy chart views |

---

## Related documentation

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, data flow, API |
| [COACH_AND_INTELLIGENCE.md](COACH_AND_INTELLIGENCE.md) | Intelligence vs Coach UX |
| [PRODUCT.md](../PRODUCT.md) | Product contract |
| [DIFFERENTIATION_NORTH_STAR.md](DIFFERENTIATION_NORTH_STAR.md) | Future moat features |
| [ROADMAP_10_FEATURES.md](ROADMAP_10_FEATURES.md) | Planned feature waves |

---

*This catalog reflects the repository state at documentation time. When adding a feature, update this file and the relevant section in [README.md](../README.md).*
