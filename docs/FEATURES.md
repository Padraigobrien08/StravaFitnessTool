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
9. [AI planning & training calendar](#9-ai-planning--training-calendar)
10. [Adaptive & learning stack](#10-adaptive--learning-stack)
11. [Wellness & leg-feel](#11-wellness--leg-feel)
12. [Return-to-running mode](#12-return-to-running-mode)
13. [Route replay & run detail](#13-route-replay--run-detail)
14. [API & server capabilities](#14-api--server-capabilities)
15. [Intelligence tools (deterministic)](#15-intelligence-tools-deterministic)
16. [MCP package](#16-mcp-package)
17. [Developer & internal tools](#17-developer--internal-tools)
18. [Settings & preferences](#18-settings--preferences)
19. [Quality, privacy & confidence](#19-quality-privacy--confidence)
20. [Testing & verification](#20-testing--verification)
21. [Feature index by route](#21-feature-index-by-route)

---

## 1. Product overview

| Concept            | Description                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| **Positioning**    | Private training intelligence for runners — not a chart warehouse                          |
| **Core loop**      | Import Strava data → deterministic analytics → narrative insights → investigate with Coach |
| **Design rule**    | LLMs orchestrate; engines compute metrics. Coach must not invent numbers.                  |
| **Two data paths** | Local export (browser-only) vs Strava OAuth + Postgres (full Coach/MCP)                    |

**Primary user questions** (from [PRODUCT.md](../PRODUCT.md)):

| Question                      | Main surfaces                      |
| ----------------------------- | ---------------------------------- |
| Am I improving?               | Home, Performance, Records, Trends |
| Am I training correctly?      | Training, Effort, intensity advice |
| Am I ready for my goal?       | Goals, readiness, predictions      |
| What should I do next?        | Home recommendations, `/plan`      |
| What changed recently?        | Home, Report                       |
| What does the system believe? | Intelligence (`/intelligence`)     |
| Why / compare / investigate?  | Coach (`/coach`)                   |

---

## 2. Data ingestion & storage

### 2.1 Strava export import (local)

| Feature                      | Description                                       | Location                                   |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------ |
| **CSV activities import**    | Upload Strava `activities.csv` from export folder | `lib/strava/parseActivities.ts`, `/import` |
| **Profile / zones files**    | Optional companion CSVs from export               | Import flow                                |
| **Export folder validation** | Checks required files, row counts, date span      | `lib/quality/assessImport.ts`              |
| **localStorage snapshot**    | Persists parsed import for return visits          | `lib/storage/local.ts`                     |
| **Clear data**               | Resets client import + insights from header       | `StravaProvider.clearData`                 |
| **Data source labeling**     | Shows “Strava export”, “Strava API”, or merged    | `lib/data/mergeImport.ts`                  |

### 2.2 FIT file import

| Feature                   | Description                                          | Location                            |
| ------------------------- | ---------------------------------------------------- | ----------------------------------- |
| **FIT upload (step 2)**   | Match `activities/<id>.fit.gz` via `Filename` column | `/import`, `lib/strava/parseFit.ts` |
| **Best efforts from FIT** | Lap blocks and device best efforts for predictions   | `lib/strava/fitTypes.ts`            |
| **IndexedDB storage**     | Stream-rich detail stored per activity               | `lib/storage/fit-db.ts`             |
| **Merge with API runs**   | FIT detail enriches Strava API activities            | `enrichImportWithFitDetails`        |

### 2.3 Strava OAuth & API sync

| Feature                | Description                             | Location                        |
| ---------------------- | --------------------------------------- | ------------------------------- |
| **OAuth connect**      | Connect Strava account                  | `/api/auth/strava/*`, `/import` |
| **OAuth CSRF state**   | Random 128-bit state, cookie-verified   | `authorize` + `callback`        |
| **Activity sync**      | Pull activities into Postgres           | `lib/sync/stravaSync.ts`        |
| **Stream sync**        | GPS, HR, cadence, elevation streams     | `lib/sync/stravaStreams.ts`     |
| **Manual re-sync**     | Refresh activities from API             | `/api/sync/strava`, Import UI   |
| **Session auth**       | Signed cookie for API routes            | `lib/auth/session.ts`           |
| **GET /api/me/import** | Hydrates browser with server activities | Used on load when connected     |

### 2.4 Source merge & precedence

The export and the API carry **different fields**. `mapActivity` cannot supply
`trainingLoad`, `gradeAdjustedPaceSecPerKm`, `totalSteps`, `weatherTempC` or `fitFilename`
— the Strava API does not expose them — while the CSV export populates all five.

| Rule                      | Behaviour                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Field-wise overlay**    | The newer import wins on every field it carries; the older is kept where the newer has nothing |
| **No record replacement** | Records shared by both sources are merged field by field, never wholesale                      |
| **Order-independent**     | Import-then-sync and sync-then-import preserve the same union of data                          |
| **FIT is id-only**        | `enrichImportWithFitDetails` unions FIT ids; stream detail stays in IndexedDB                  |

Location: `lib/data/mergeImport.ts`.

### 2.5 Webhooks

| Feature                           | Description                                                                               | Location                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Subscription challenge**        | Strava `hub.challenge` verification (GET)                                                 | `/api/webhooks/strava`                          |
| **Signature verification**        | `X-Strava-Signature: t=…,v1=…`, HMAC-SHA256 over `<t>.<raw body>`, 300 s freshness window | `lib/strava/webhooks/verify.ts`                 |
| **Activity create/update/delete** | Upsert or remove activities on push                                                       | Webhook handler                                 |
| **Subscription management**       | Enable/disable from Settings (auth required)                                              | `/api/webhooks/strava/subscribe`, Settings card |

Requires `STRAVA_WEBHOOK_SIGNING_SECRET`. Deliveries are rejected with 403 while it is
unset — the delete branch removes activities, so unsigned input is not trusted. Rejections
are logged as `[strava webhook] rejected: <reason>`.

### 2.6 Storage & migrations

| Layer            | What lives there                                                     |
| ---------------- | -------------------------------------------------------------------- |
| **localStorage** | Parsed import snapshot, goal store, settings, leg-feel reports       |
| **IndexedDB**    | FIT stream detail per activity (`lib/storage/fit-db.ts`)             |
| **Postgres**     | Activities, streams, sessions, coach threads, calendar, memory, logs |

Migrations live in `db/migrations/` and are applied in order by `npm run db:migrate`, which
tracks applied files in a `_migrations` table and is safe to re-run.

| Migration                    | Adds                                |
| ---------------------------- | ----------------------------------- |
| `001_initial.sql`            | Users, activities, sessions         |
| `002_coach.sql`              | Coach threads and messages          |
| `003_route_geometry.sql`     | Route geometry for replay           |
| `004_training_calendar.sql`  | Saved plan weeks                    |
| `005_recommendation_log.sql` | Recommendation logging for outcomes |
| `006_athlete_memory.sql`     | Persisted athlete beliefs           |
| `007_forecast_log.sql`       | Forecast logging for calibration    |
| `008_leg_feel.sql`           | Daily leg-feel reports              |

### 2.7 Domain model

| Feature                | Description                           | Location                             |
| ---------------------- | ------------------------------------- | ------------------------------------ |
| **RunActivity**        | Normalized run shape for all features | `lib/strava/types.ts`, `lib/domain/` |
| **NormalizedActivity** | Cross-sport shape for ecosystem       | `lib/ecosystem/types.ts`             |
| **No raw CSV in UI**   | Parsers isolated in `lib/strava`      | Enforced by architecture             |

---

## 3. Analytics engines

All metrics flow through `computeInsights()` → `DashboardInsights` (`lib/analytics/index.ts`).

### 3.1 Volume & consistency

| Engine                  | Output                                       | Module                         |
| ----------------------- | -------------------------------------------- | ------------------------------ |
| Weekly / monthly volume | km and run counts by period                  | `lib/analytics/volume.ts`      |
| Last 7 days summary     | Recent distance and run count                | `volume.ts`                    |
| Rolling 4-week blocks   | Training block labels, distance, longest run | `lib/analytics/block.ts`       |
| Best training block     | Peak block identification                    | `block.ts`                     |
| Consistency score       | Rhythm vs target frequency                   | `lib/analytics/consistency.ts` |
| Week snapshots          | Current vs previous ISO week                 | `lib/analytics/week.ts`        |
| Weekly narrative        | Deterministic prose week-in-review           | `lib/analytics/narrative.ts`   |

### 3.2 Pace, HR & efficiency

| Engine                      | Output                         | Module                        |
| --------------------------- | ------------------------------ | ----------------------------- |
| Pace trend                  | Rolling pace over time         | `lib/analytics/trends.ts`     |
| HR trend                    | Average HR trend               | `trends.ts`                   |
| HR zones                    | Time in zones, easy/hard split | `lib/analytics/hrZones.ts`    |
| Aerobic efficiency          | Pace per HR trend              | `lib/analytics/efficiency.ts` |
| Efficiency month-over-month | MoM narrative                  | `efficiency.ts`               |
| Elevation per km            | Climbing load                  | `lib/analytics/elevation.ts`  |

### 3.3 Load & fatigue

| Engine               | Output                   | Module                          |
| -------------------- | ------------------------ | ------------------------------- |
| Training load by run | Per-run load score       | `lib/analytics/trainingLoad.ts` |
| Fitness index        | Composite fitness signal | `trainingLoad.ts`               |
| CTL / ATL / TSB      | Acute-chronic workload   | `lib/analytics/fatigue.ts`      |
| Fatigue snapshot     | Freshness score, label   | `fatigue.ts`                    |
| Weekly load series   | History for charts       | `fatigue.ts`                    |

Load uses Strava's own `trainingLoad` when present and falls back to a distance-derived
proxy once more than half the runs lack it — the snapshot says which, in its evidence.

### 3.4 Intensity & workout typing

| Engine                 | Output                                      | Module                              |
| ---------------------- | ------------------------------------------- | ----------------------------------- |
| Workout classification | Easy, recovery, tempo, interval, long, race | `lib/analytics/workoutType.ts`      |
| Intensity advice       | Hard runs in 14d, easy %, status            | `lib/analytics/intensityAdvisor.ts` |
| Easy/hard distribution | HR-based split                              | `hrZones.ts`                        |

### 3.5 Records & predictions (V1)

| Engine                    | Output                                                          | Module                         |
| ------------------------- | --------------------------------------------------------------- | ------------------------------ |
| Personal records          | 5K, 10K, HM, long buckets                                       | `lib/analytics/records.ts`     |
| Race predictions (legacy) | Riegel-style table                                              | `records.ts`                   |
| Race prediction analysis  | Riegel, Cameron, personalized power-law, multi-anchor consensus | `lib/analytics/predictions.ts` |
| Prediction timeline       | Weekly consensus HM/10K over time                               | `lib/analytics/progression.ts` |
| PR timeline               | PR events over time                                             | `progression.ts`               |

**Effort quality.** The power-law fit and the consensus draw on _comparable efforts_: personal
bests, FIT lap blocks and best-effort windows, plus whole activities the classifier marked as
raced, tempo or interval work. Easy, recovery and long runs are excluded — including them
flattens the fitted exponent toward "pace never fades with distance". Callers without workout
classifications fall back to a pace gate, and the explanation text says which filter applied.

### 3.6 Physiology & capability

| Engine                | Output                                            | Module                                  |
| --------------------- | ------------------------------------------------- | --------------------------------------- |
| Critical speed / D′   | Aerobic ceiling and anaerobic reserve, with R²    | `lib/analytics/physiology.ts`           |
| Capability radar      | Dimension scores with limiter identification      | `lib/analytics/capabilityRadar.ts`      |
| Uncertainty estimates | Confidence intervals on key metrics               | `lib/analytics/uncertaintyEstimates.ts` |
| Personal z-scores     | Session ratings against the athlete's own history | `lib/analytics/personalZScores.ts`      |
| Anomalies             | Outlier sessions                                  | `lib/analytics/anomalies.ts`            |
| Change points         | Structural shifts in a trend                      | `lib/analytics/changePoints.ts`         |
| Correlations          | Relationships between training variables          | `lib/analytics/correlations.ts`         |
| Training phases       | Base / build / peak / taper segmentation          | `lib/analytics/trainingPhases.ts`       |
| Risk patterns         | Ranked training-risk signals                      | `lib/analytics/riskPatterns.ts`         |

### 3.7 Readiness & goals

| Engine                           | Output                                         | Module                       |
| -------------------------------- | ---------------------------------------------- | ---------------------------- |
| Half marathon readiness (legacy) | Score from long run + volume                   | `lib/analytics/readiness.ts` |
| Race readiness (multi-distance)  | 5K, 10K, HM, marathon configs                  | `readiness.ts`               |
| Long run vs race distance        | % of official race distance (21.1 km HM)       | `readiness.ts`               |
| Training currency                | Whether recent training still supports a claim | `readiness.ts`               |
| Goal progress                    | Weekly run target vs actual                    | `lib/analytics/goals.ts`     |
| Gap analysis                     | Metric vs target for race prep                 | `readiness.ts`               |

### 3.8 Race execution

| Engine                   | Output                                             | Module                          |
| ------------------------ | -------------------------------------------------- | ------------------------------- |
| Race strategy simulation | Even / negative / conservative / aggressive pacing | `lib/analytics/raceStrategy.ts` |
| Segment pacing table     | Per-km or per-mile targets                         | `raceStrategy.ts`               |
| Fade risk                | Low / medium / high                                | `raceStrategy.ts`               |

### 3.9 Training ecosystem (multi-sport)

| Engine              | Output                                      | Module                          |
| ------------------- | ------------------------------------------- | ------------------------------- |
| Modality detection  | Run, ride, strength, etc. from Strava types | `lib/ecosystem/modality.ts`     |
| Cross-training load | Non-run volume context                      | `lib/ecosystem/aggregates.ts`   |
| Interference risks  | Strength/cycle crowding race prep           | `lib/ecosystem/interference.ts` |
| Athlete archetype   | Training profile label                      | `lib/ecosystem/archetype.ts`    |
| Ecosystem insights  | Narrative cards for insights engine         | `lib/ecosystem/insights.ts`     |

### 3.10 Context & mix

| Engine            | Output                                  | Module                     |
| ----------------- | --------------------------------------- | -------------------------- |
| Activity type mix | Sport distribution                      | `lib/analytics/context.ts` |
| Data confidence   | low / medium / high from import quality | Set in `computeInsights`   |

---

## 4. Insight engine

| Feature                     | Description                                                        | Location                      |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| **Question tags**           | `improving`, `training`, `ready`, `next`, `changed`                | `lib/insights/types.ts`       |
| **Insight cards**           | Title, severity, evidence[], recommendation, confidence            | `generateInsights()`          |
| **Rule-based generation**   | PRs, efficiency, fatigue, intensity, readiness, ecosystem          | `lib/insights/generate.ts`    |
| **Currency reconciliation** | Claims are suppressed when recent training no longer supports them | `lib/insights/consistency.ts` |
| **Home filtering**          | Rows grouped by question on `/home`                                | `lib/home/dashboardData.ts`   |
| **Import quality coupling** | Confidence capped by data quality                                  | `assessImportQuality`         |

---

## 5. Application pages

### 5.1 Home (`/home`)

| Feature                   | Description                                       |
| ------------------------- | ------------------------------------------------- |
| Hero intelligence         | Top insight summary and severity                  |
| This week / next week ops | Volume, runs, intensity operational cards         |
| Insights engine           | Cards by question (improving, training, ready, …) |
| Progression momentum      | PR and prediction trajectory sparklines           |
| Goal mission control      | Quick link to race goal state                     |
| Leg-feel card             | Daily subjective check-in                         |
| Data quality footer       | Import completeness                               |
| Strava sync button        | When API connected                                |

### 5.2 Training (`/training`)

| Feature                    | Description                          |
| -------------------------- | ------------------------------------ |
| Volume charts              | Weekly distance trends               |
| Training blocks            | 4-week rolling blocks                |
| Efficiency panel           | Aerobic efficiency trend             |
| Intensity distribution     | Easy vs hard                         |
| Fatigue / load             | CTL, ATL, TSB visualization          |
| Training ecosystem summary | Multi-sport context                  |
| Week plan preview          | Next-week structure from plan engine |

### 5.3 Plan (`/plan`)

See [§9 AI planning & training calendar](#9-ai-planning--training-calendar).

### 5.4 Performance (`/performance`)

| Feature            | Description                   |
| ------------------ | ----------------------------- |
| Pace & HR trends   | Longitudinal charts           |
| Personal records   | Best times by distance        |
| Race projection    | V1 corridor and models        |
| Effort curve       | Power-law fit visualization   |
| Efficiency summary | Trend and evidence            |
| Insight cards      | Performance-tagged narratives |

### 5.5 Goals (`/goals`)

See [§6 Goals & race forecasting](#6-goals--race-forecasting).

### 5.6 Runs (`/runs`, `/runs/[id]`)

| Feature              | Description                       |
| -------------------- | --------------------------------- |
| Activity log         | Searchable, sortable run list     |
| Workout labels       | Type classification per run       |
| Single-run detail    | Pace, HR, splits, execution score |
| Post-run leg-feel    | Subjective check-in after a run   |
| Link to route replay | When streams available            |

### 5.7 Report (`/report`)

| Feature                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| Printable summary          | What changed — readiness, predictions, risks |
| Intelligence report layout | Composed from view models                    |
| Export-friendly styling    | Print CSS                                    |

### 5.8 Import (`/import`)

| Feature               | Description                   |
| --------------------- | ----------------------------- |
| CSV upload            | Drag/drop or file picker      |
| FIT folder upload     | Second-step stream enrichment |
| Strava OAuth          | Connect and sync              |
| Import quality report | Warnings and completeness     |
| Sync status           | Run counts, stream counts     |

### 5.9 Activity ecosystem route

| Route      | Purpose                                             |
| ---------- | --------------------------------------------------- |
| `/context` | Cross-training / activity ecosystem (Advanced menu) |

The former legacy chart routes (`/dashboard`, `/trends`, `/effort`, `/records`, `/activity-mix`) were retired in favor of `/home` and `/performance`.

---

## 6. Goals & race forecasting

### 6.1 Race goal configuration

| Feature       | Description                                   | Location                     |
| ------------- | --------------------------------------------- | ---------------------------- |
| Race distance | 5K, 10K, HM, marathon                         | `stores/goal-store.ts`       |
| Race date     | Countdown on hero                             | Goal picker                  |
| Target time   | Optional goal time                            | Goal picker                  |
| Lapsed goals  | A past race stops driving taper/projection    | `isRaceUpcoming`             |
| Server sync   | Preferences stored in Postgres when connected | `lib/db/user-preferences.ts` |

### 6.2 AI-native race briefing (primary UI when V2 available)

| Feature               | Description                                      | Location                                     |
| --------------------- | ------------------------------------------------ | -------------------------------------------- |
| **Current belief**    | Narrative tying key efforts to forecast          | `lib/goals/goalsRaceBrief.ts`                |
| **Primary action**    | V2 recommendation (trimmed)                      | `GoalsRaceBrief` component                   |
| **Evidence bullets**  | Contributors + uncertainty drivers               | `components/goals/goals-race-brief.tsx`      |
| **Confidence line**   | Label + why (drivers)                            | Brief view model                             |
| **Ask Coach chips**   | Deep links with `investigate=1`                  | `components/goals/goals-coach-prompts.tsx`   |
| **See models & math** | Collapsible drawer with full V2 panel            | `components/goals/goals-evidence-drawer.tsx` |
| **Legacy V1 toggle**  | Optional comparison to old 2h14m-style integrity | Page link                                    |

### 6.3 Forecasting Engine V2

| Component         | Description                                    | Location                                 |
| ----------------- | ---------------------------------------------- | ---------------------------------------- |
| Capability models | Riegel, power-law, multi-effort, recent anchor | `lib/forecasting-v2/capabilityModels.ts` |
| Durability        | Long-run support vs race distance              | `durabilityModel.ts`                     |
| Freshness         | TSB/fatigue time adjustment                    | `freshnessModel.ts`                      |
| Specificity       | Distance-relevant efforts and volume           | `specificityModel.ts`                    |
| Execution         | Fade/pacing risk, conservative padding         | `executionModel.ts`                      |
| Uncertainty       | Interval width, confidence label               | `uncertaintyModel.ts`                    |
| Contributors      | Positive/negative/neutral factors              | `contributionModel.ts`                   |
| Scenarios         | Expected / conservative / optimistic / fade    | `scenarioModel.ts`                       |
| Sensitivity       | How the forecast moves with each input         | `sensitivity.ts`                         |
| Observability     | Model weights, evidence chain, warnings        | `forecastObservability.ts`               |
| Near-race cap     | ≥90% race-distance efforts cap headline time   | `forecastEngine.ts`                      |
| Key efforts       | Top 3 relevant runs for narrative              | `lib/goals/forecastV2ViewModel.ts`       |

### 6.4 Forecast accuracy tracking

The forecaster grades itself: each forecast is logged when issued, then scored against a
later real effort at that distance.

| Stage     | Behaviour                                                                                                                                                                              | Location                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Log       | Recorded on issue; never breaks the forecast if logging fails                                                                                                                          | `lib/forecasting-v2/calibrationService.ts`                   |
| Score     | Matched against the earliest **plausible race attempt** after the issue date — within ±7% of the distance and no slower than p90 × 1.15, so training runs are not read as race results | `calibration.ts`                                             |
| Summarize | Interval hit rate, median signed error, mean absolute error                                                                                                                            | `summarizeCalibration`                                       |
| Surface   | Shown in `/intelligence`                                                                                                                                                               | `components/intelligence/intelligence-forecast-accuracy.tsx` |

Requires a database: in export-only mode nothing is logged and the panel stays empty.

### 6.5 Goals page panels (supporting)

| Panel                  | Description                                      |
| ---------------------- | ------------------------------------------------ |
| Readiness intelligence | Dimension scores: long run, volume, freshness, … |
| Execution intelligence | Pacing mode picker + segment chart               |
| Trajectory forecast    | Prediction timeline chart (goal distance)        |
| Projection curve       | V1 power-law curve                               |
| Goal risks             | Ranked risks with mitigation                     |
| Goal scenarios         | What-if outcomes for the target                  |
| Historical readiness   | Best block, trajectory bullets                   |
| Explainability         | Assumptions and limitations footer               |

### 6.6 Forecast evaluation workbench (internal)

| Feature                   | Description                         | Location                         |
| ------------------------- | ----------------------------------- | -------------------------------- |
| `evaluateForecastV2`      | Sanity + recommendation rules       | `lib/forecasting-v2/evaluation/` |
| Fixture athletes          | 10 synthetic profiles               | `evaluation/fixtures.ts`         |
| Production readiness gate | All fixtures must pass expectations | `evaluateAllForecastFixtures()`  |
| Forecast Lab UI           | `/dev/forecast-lab`                 | `app/dev/forecast-lab/`          |

---

## 7. Athlete Intelligence Model

**Route:** `/intelligence`

| Section                | Feature                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Hero**               | Current belief, primary action, readiness/freshness/confidence                    |
| **State evolution**    | Sparklines: readiness, freshness, efficiency, volume, intensity                   |
| **Signal board**       | Primary + secondary signals, watchlist                                            |
| **Decision support**   | Risks, opportunities, actions with Coach links                                    |
| **Athlete memory**     | Learned patterns from training history (see [§10](#10-adaptive--learning-stack))  |
| **Forecast accuracy**  | How well past forecasts have held up (see [§6.4](#64-forecast-accuracy-tracking)) |
| **Training ecosystem** | Multi-sport interpretation, interference detail                                   |
| **Investigate cards**  | Deep links to Coach domains                                                       |

**Key modules:** `lib/intelligence/athleteState.ts`, `lib/intelligence/presentation.ts`, `lib/coach/activeIntelligence.ts`

---

## 8. Coach investigation workspace

**Route:** `/coach`

| Feature                      | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| **Threaded conversations**   | Multiple investigations in sidebar                |
| **localStorage persistence** | Threads survive refresh                           |
| **Structured responses**     | Summary, recommendation, evidence, risks (parsed) |
| **Tool-grounded answers**    | LLM calls deterministic intelligence tools        |
| **Stale-claim guard**        | Answers reconciled against training currency      |
| **Domain starters**          | Race prep, readiness, performance, …              |
| **URL deep links**           | `?domain=`, `?q=`, `?investigate=1`               |
| **Context rail**             | Readiness, race, risks snapshot                   |
| **Mini context (desktop)**   | Collapsible right rail                            |
| **Mobile sidebar**           | Thread list overlay                               |
| **Analysis loader**          | Shows active tool names while thinking            |
| **Follow-up chips**          | Suggested next questions                          |

**Requirements:** Postgres sync, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, race goal recommended.

**API:** `POST /api/chat` → `lib/intelligence/chat.ts`. All 44 tools in [§15](#15-intelligence-tools-deterministic) are offered to the model.

---

## 9. AI planning & training calendar

**Route:** `/plan`

### 9.1 Weekly plan generation

| Feature           | Description                                               | Location                                  |
| ----------------- | --------------------------------------------------------- | ----------------------------------------- |
| Planning context  | Free-text athlete context, parsed for hints               | `lib/plan/inferPlanHintsFromContext.ts`   |
| Guardrails        | Max hard sessions, weekly km cap, long-run cap, race week | `lib/ai-planning/weeklyPlanGuardrails.ts` |
| LLM generation    | Structured-output plan from coaching context              | `lib/ai-planning/generateWeeklyPlan.ts`   |
| Schema validation | Zod + strict OpenAI JSON schema                           | `lib/ai-planning/weeklyPlanSchema.ts`     |
| Plan preference   | Conservative / balanced / aggressive                      | `applyPlanPreference.ts`                  |
| Plan modification | Adjust an existing week                                   | `modifyWeeklyPlan.ts`                     |
| Observability     | What the model was given and what changed                 | `planObservability.ts`                    |

### 9.2 The safety ladder

Every generated plan passes through the same sequence, and **no unvalidated plan reaches
the athlete**:

1. **Soften** — medical wording rewritten where a safe equivalent exists (`stripMedicalLanguage`).
2. **Validate** — against the guardrails; failures go to `repairWeeklyPlan`.
3. **Integrity** — evidence, contradiction, safety and confidence checks (`lib/recommendation-integrity/`); failures go to `repairPlanFromIntegrity`.
4. **Fallback** — if validation or integrity still fails, `buildSafeFallbackWeeklyPlan` replaces the plan entirely with a deterministic rule-based week.

The fallback also triggers when there is no LLM key, when the call throws, and when the
response is not schema-valid. The result carries `source: "llm" | "repaired" | "fallback"`
so the surface can say which happened.

### 9.3 Training calendar

| Feature             | Description                              | Location                                  |
| ------------------- | ---------------------------------------- | ----------------------------------------- |
| Plan → calendar     | Convert a generated week into saved days | `lib/training-calendar/planToCalendar.ts` |
| Drag-and-drop board | Reorder sessions across days             | `swapWorkoutDays.ts`                      |
| Hard-session rules  | Spacing constraints enforced on reorder  | `hardSessionRules.ts`                     |
| Planned vs actual   | Match completed runs against the plan    | `matchPlannedVsActual.ts`                 |
| Race-week handling  | Race week overrides normal structure     | `calendarValidation.ts`                   |
| Server persistence  | Saved weeks per athlete                  | `lib/db/training-calendar.ts`             |
| History             | Previously saved weeks                   | `calendarHistory.ts`                      |

---

## 10. Adaptive & learning stack

The layer that turns repeated observation into durable belief. Every claim carries evidence,
counter-evidence and a stability rating, and hedged language is deliberate.

### 10.1 Athlete memory

| Feature                 | Description                                                                | Location                                          |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| Belief profile          | Adaptation, fatigue, pacing, taper, modality, durability, outcome patterns | `lib/athlete-memory/buildAthleteMemoryProfile.ts` |
| Confidence downgrade    | Thin evidence caps a belief's confidence                                   | `inferAdaptationPatterns.ts` and siblings         |
| Relevance selection     | Which beliefs matter for the current question                              | `selectRelevantBeliefs.ts`                        |
| Serialization for Coach | Compact form for the LLM                                                   | `memorySerialization.ts`                          |
| Persistence             | Stored per athlete                                                         | `lib/db/athlete-memory.ts`                        |

### 10.2 Adaptation engine

`lib/adaptation-engine/` — infers adaptation signals, durability changes, fatigue responses,
taper response and training sensitivity, each with supporting and contradictory evidence.

### 10.3 Causal reasoning

`lib/causal-reasoning/` — likely drivers for readiness, fatigue, forecast, efficiency,
execution and pacing, with a narrative builder. Returns "insufficient context" rather than
inventing a cause when the evidence is not there.

### 10.4 Recommendation integrity

`lib/recommendation-integrity/` — evidence checks, contradiction checks, safety checks and
confidence calibration over both free-text recommendations and whole weekly plans. Medical
claims are high severity and fail the report.

### 10.5 Recommendation learning & outcomes

| Feature               | Description                       | Location                                                  |
| --------------------- | --------------------------------- | --------------------------------------------------------- |
| Recommendation log    | What was suggested, when          | `lib/db/recommendation-log.ts`                            |
| Adherence             | Did the athlete follow it         | `lib/recommendation-outcomes/evaluateAdherence.ts`        |
| Signal / volume trend | Did the intended effect appear    | `evaluateSignal.ts`, `evaluateVolumeTrend.ts`             |
| Belief update         | Feed the outcome back into memory | `lib/recommendation-learning/updateBeliefsFromOutcome.ts` |
| Learning report       | Observability over the loop       | `lib/learning-observability/`                             |

### 10.6 Session intelligence

`lib/session-intelligence/` — per-session execution grading, comparison to historical
sessions, likely adaptation, and an effectiveness score.

### 10.7 Medical-language safety

`lib/safety/medicalLanguage.ts` is the single vocabulary used by both the plan scrubber and
the integrity checks. Terms with a safe training-language equivalent are rewritten; named
clinical conditions and treatment claims are flagged instead, because they cannot be
rewritten into safety — a flagged plan falls back rather than shipping.

---

## 11. Wellness & leg-feel

| Feature            | Description                                       | Location                                    |
| ------------------ | ------------------------------------------------- | ------------------------------------------- |
| Daily check-in     | Fresh / normal / heavy, morning or post-run       | `components/home/console/leg-feel-card.tsx` |
| Niggle flag        | Area + severity 1–3. **A flag, not a diagnosis**  | `lib/wellness/types.ts`                     |
| Local-first store  | Zustand + localStorage, keyed by day              | `stores/feel-store.ts`                      |
| Server persistence | `/api/me/leg-feel`, session-authenticated         | `lib/db/leg-feel.ts`                        |
| Feeds fatigue      | Threads into the fatigue snapshot and calibration | `lib/analytics/fatigue.ts`                  |
| Calibration        | How well subjective feel tracks measured outcomes | `lib/wellness/outcomeCalibration.ts`        |

**Reconciliation policy.** Reports are merged **by recency**: the report with the newer
`reportedAt` wins, whichever side it came from, so two devices converge on the same day's
value. Ties keep the incumbent, and an unorderable timestamp cannot win. Writes are tracked
in `pendingDates` and retried on mount, so a save that fails offline is not lost. The store
degrades to local-only when there is no database or no session.

---

## 12. Return-to-running mode

After a training gap, the app stops presenting the pre-gap athlete as the current one.

| Feature             | Description                                            | Location                           |
| ------------------- | ------------------------------------------------------ | ---------------------------------- |
| Gap detection       | Identifies a layoff and its length                     | `lib/returning/returnToRunning.ts` |
| Retention estimate  | What fitness likely remains                            | `estimateRetention()`              |
| Comeback baseline   | A target built from the athlete's own post-gap running | `ReturnBaseline`                   |
| Graduated weeks     | Ramp back rather than resuming the old load            | `ReturnWeek`                       |
| Surface consistency | Insights, readiness and plan all respect the gap       | `lib/insights/consistency.ts`      |

The pre-gap baseline is deliberately **not** shown as a current target, and the comeback ramp
outranks race-week logic when both apply.

---

## 13. Route replay & run detail

### 13.1 Route replay (`/runs/[id]/route`)

| Feature             | Description                     | Location                           |
| ------------------- | ------------------------------- | ---------------------------------- |
| MapLibre map        | GPS track on basemap            | `components/route/`                |
| Playback controls   | Play/pause, scrub timeline      | `lib/route-intelligence/replay.ts` |
| Pace overlay        | Color by pace                   | `overlays.ts`                      |
| HR overlay          | Color by heart rate             | `overlays.ts`                      |
| Elevation profile   | Chart synced to position        | `elevation.ts`                     |
| Timeline            | Unified time/distance index     | `timeline.ts`                      |
| Stream downsampling | Performance for long activities | `lib/strava/downsample.ts`         |

### 13.2 Workout detail (`/runs/[id]`)

| Feature            | Description                         |
| ------------------ | ----------------------------------- |
| Execution analysis | Pace consistency, HR drift          |
| Workout naming     | Friendly title from type + distance |
| FIT-backed splits  | When lap data available             |
| Session narrative  | What the session says about fitness |

---

## 14. API & server capabilities

**Auth modes:** `session` = signed cookie only. `session + key` = cookie or
`STRIDEIQ_API_KEY` + `STRIDEIQ_API_KEY_USER_ID` (automation/MCP). The key path resolves the
user from the **server environment**, never from the request, so it cannot act as another
athlete.

| Method          | Path                               | Auth          | Purpose                                                |
| --------------- | ---------------------------------- | ------------- | ------------------------------------------------------ |
| GET             | `/api/health`                      | public        | Health check                                           |
| GET             | `/api/auth/strava/authorize`       | public        | Start OAuth (issues CSRF state)                        |
| GET             | `/api/auth/strava/callback`        | public        | OAuth callback, creates session                        |
| POST            | `/api/auth/logout`                 | public        | Sign out                                               |
| POST            | `/api/chat`                        | session + key | Coach LLM + tool loop                                  |
| GET             | `/api/me/intelligence`             | session + key | Tool execution, brief, discovery                       |
| GET             | `/api/me/coach-composite`          | session + key | Bundled coach payloads                                 |
| POST            | `/api/me/coach/memory`             | session + key | Athlete memory for Coach                               |
| POST            | `/api/me/coach/plan`               | session + key | Plan tool for Coach                                    |
| GET/POST        | `/api/me/weekly-plan`              | session + key | AI weekly plan                                         |
| GET             | `/api/me/forecast-accuracy`        | session + key | Forecast calibration summary                           |
| GET             | `/api/me/recommendation-outcomes`  | session + key | Recommendation outcome evaluation                      |
| GET             | `/api/me/learning/observability`   | session + key | Learning-loop report                                   |
| GET/POST        | `/api/me/strava`                   | session + key | Strava API proxy (MCP)                                 |
| GET             | `/api/me/import`                   | session       | Activity bundle for client                             |
| GET             | `/api/me/status`                   | public\*      | Connection status (`{connected}` only when signed out) |
| GET             | `/api/me/athlete-stats`            | session       | Athlete metadata                                       |
| GET             | `/api/me/fit-details`              | session       | All FIT/stream details                                 |
| GET             | `/api/me/fit-details/[activityId]` | session       | Single activity streams                                |
| GET/POST        | `/api/me/preferences`              | session       | Race goal + coach prefs                                |
| GET/POST        | `/api/me/leg-feel`                 | session       | Daily leg-feel report                                  |
| GET/POST/DELETE | `/api/me/training-calendar`        | session       | Saved plan weeks                                       |
| POST            | `/api/sync/strava`                 | session       | Manual activity sync                                   |
| POST            | `/api/sync/strava/streams`         | session       | Batch stream sync                                      |
| GET/POST        | `/api/webhooks/strava`             | signature     | Strava push events                                     |
| GET/POST        | `/api/webhooks/strava/subscribe`   | session       | Webhook subscription                                   |

\* `/api/me/status` answers `{ connected: false }` to an unauthenticated caller by design —
the client uses it to decide whether to show "Connect Strava" — and discloses nothing else.

---

## 15. Intelligence tools (deterministic)

**44 tools.** Defined in `lib/intelligence/tools.ts` (`INTELLIGENCE_TOOL_DEFINITIONS`), with
the name union in `lib/intelligence/types.ts`.

Every tool is offered to the Coach (`POST /api/chat`) **and** addressable over HTTP via
`GET /api/me/intelligence?tool=<name>`, with arguments as JSON in `&args=`. A set of short
`?section=` aliases is kept for compatibility, and `?section=tools` returns the whole
registry for discovery.

### Core & planning

| Tool                               | Purpose                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `get_coach_brief`                  | High-level training brief                                         |
| `get_readiness`                    | Race readiness score, gaps, signals                               |
| `get_predictions`                  | V1 race prediction analysis                                       |
| `explain_prediction`               | Why the prediction says what it says                              |
| `get_week_plan`                    | Suggested next-week structure                                     |
| `generate_next_week_training_plan` | Full AI weekly plan (see [§9](#9-ai-planning--training-calendar)) |
| `recommend_today_session`          | What to do today                                                  |
| `get_goal_scenarios`               | What-if outcomes for the goal                                     |
| `get_race_strategy`                | Pacing strategy for goal distance                                 |
| `get_fatigue_load`                 | CTL/ATL/TSB and freshness                                         |
| `list_recent_runs`                 | Recent activities with metadata                                   |
| `get_run_detail`                   | One run in depth                                                  |
| `get_data_quality`                 | Import completeness                                               |
| `get_connection_status`            | Strava connection state                                           |

### Physiology, capability & risk

| Tool                       | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| `get_physiology`           | Critical speed and anaerobic reserve         |
| `get_capability_radar`     | Dimension scores and limiter                 |
| `get_progression_burndown` | Progress toward the goal over time           |
| `get_session_zscores`      | Sessions rated against the athlete's history |
| `get_anomalies`            | Outlier sessions                             |
| `get_uncertainty`          | Confidence intervals on key metrics          |
| `get_correlations`         | Relationships between training variables     |
| `get_change_points`        | Structural shifts in a trend                 |
| `get_risk_patterns`        | Ranked training risks                        |
| `get_training_phases`      | Base / build / peak / taper segmentation     |

### Narrative & self-assessment

| Tool                          | Purpose                              |
| ----------------------------- | ------------------------------------ |
| `get_monthly_narrative`       | Month in review                      |
| `get_pre_race_narrative`      | Race-eve framing                     |
| `get_forecast_accuracy`       | How past forecasts held up           |
| `get_recommendation_outcomes` | Whether past advice worked           |
| `get_athlete_memory`          | Learned beliefs, optionally by topic |

### Reasoning

| Tool                      | Purpose                         |
| ------------------------- | ------------------------------- |
| `compare_sessions`        | Compare recent workouts by type |
| `explain_readiness_delta` | Why readiness changed           |
| `find_best_phase`         | Strongest training block        |
| `attribute_improvement`   | What preceded gains             |
| `analyze_fade_pattern`    | Late-run pace fade              |
| `pr_context`              | Training before PRs             |

### Ecosystem

| Tool                               | Purpose                        |
| ---------------------------------- | ------------------------------ |
| `get_training_ecosystem`           | Full ecosystem payload         |
| `get_training_ecosystem_summary`   | Short summary                  |
| `get_modality_distribution`        | Sport mix                      |
| `get_cross_training_support`       | How non-run helps/hurts        |
| `get_interference_risks`           | Crowding risks                 |
| `get_athlete_archetype`            | Profile label                  |
| `compare_modality_blocks`          | Compare two blocks             |
| `get_race_week_interference_check` | Race-week cross-training check |
| `get_strength_mobility_support`    | Strength/mobility context      |

---

## 16. MCP package

**Package:** `packages/strideiq-mcp`

| Feature                 | Description                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| MCP server              | Intelligence + Strava parity + composite coach tools                                                   |
| **Tool parity**         | **All 44** intelligence tools, enforced by a test                                                      |
| Composite tools         | Bundled multi-call shortcuts (last-run analysis, race-week snapshot, PR + segments, route suggestions) |
| Strava tools            | Athlete, stats, zones, shoes, clubs, segments, routes                                                  |
| MCP resources           | `strideiq://activity/{id}/gpx`                                                                         |
| Session or API key auth | Cookie or `STRIDEIQ_API_KEY`                                                                           |
| Strava MCP              | Built-in — no external `@r-huijts/strava-mcp-server` required                                          |

The package is standalone — its own dependencies and `tsconfig`, no imports from the app —
so it carries a declarative tool table in `src/intelligence-tools.ts` rather than importing
the registry. `lib/mcp/__tests__/toolParity.test.ts` asserts that table matches
`INTELLIGENCE_TOOL_DEFINITIONS` exactly, name for name and argument for argument, so the two
cannot drift apart unnoticed.

Configure with `STRIDEIQ_BASE_URL`, plus `STRIDEIQ_API_KEY` or `STRIDEIQ_SESSION_COOKIE`.

See [packages/strideiq-mcp/README.md](../packages/strideiq-mcp/README.md), [MCP_INTEGRATION.md](./MCP_INTEGRATION.md), [MCP_STRAVA_SMOKE.md](./MCP_STRAVA_SMOKE.md).

---

## 17. Developer & internal tools

| Feature                | Route / location                 | Purpose                                                                                                                                                                          |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Demo athlete**       | "Try the demo" on `/`            | Full synthetic 12-month athlete — 230 runs, 294 activities, multi-sport, mid-build for a sub-1:45 half. Exercises every client-side surface with no account, database or API key |
| **Forecast Lab**       | `/dev/forecast-lab`              | V2 fixture evaluation UI (dev; prod needs `NEXT_PUBLIC_FORECAST_LAB=1`)                                                                                                          |
| **Evaluation harness** | `lib/forecasting-v2/evaluation/` | Automated forecast validation                                                                                                                                                    |
| **Vitest suite**       | `npm test`                       | Unit tests across every subsystem                                                                                                                                                |
| **AGENTS.md**          | Repo root                        | Agent-oriented codebase guide                                                                                                                                                    |

The demo athlete is generated by `lib/demo/generateDemoData.ts` and labelled
`"Demo athlete"`; **Exit demo** in the header clears it.

---

## 18. Settings & preferences

**Route:** `/settings`

| Setting             | Storage                          |
| ------------------- | -------------------------------- |
| Distance unit       | km / mi (Zustand + localStorage) |
| Pace unit           | min/km / min/mi                  |
| Default weekly runs | Target frequency                 |
| Max weekly km       | Volume cap hint                  |
| Race goal           | Goal store + server preferences  |
| Strava webhooks     | Enable auto-sync                 |
| Clear all data      | Client + optional server         |

---

## 19. Quality, privacy & confidence

| Feature                   | Description                             | Location                                   |
| ------------------------- | --------------------------------------- | ------------------------------------------ |
| Import quality report     | Missing streams, date span, HR coverage | `lib/quality/assessImport.ts`              |
| Data quality panel        | Shown on major pages                    | `components/layout/data-quality-panel.tsx` |
| Per-insight confidence    | low / medium / high                     | Insight type                               |
| Analytics data confidence | Derived from import                     | `DashboardInsights.dataConfidence`         |
| Medical-language guard    | Not a clinical tool; claims are flagged | `lib/safety/medicalLanguage.ts`            |
| Profile email excluded    | Not loaded from `profile.csv`           | Parser policy                              |
| `.gitignore` for exports  | Prevents committing Strava dumps        | `.gitignore`                               |

---

## 20. Testing & verification

**1,800+ Vitest tests** across 55 test directories. Counts drift with every commit; `npm test` is the authority.

| Area                                       | Test location                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Analytics                                  | `lib/analytics/__tests__/`                                                                             |
| Forecasting V2 + evaluation                | `lib/forecasting-v2/__tests__/`, `lib/forecasting-v2/evaluation/__tests__/`                            |
| Goals                                      | `lib/goals/__tests__/`                                                                                 |
| AI planning                                | `lib/ai-planning/__tests__/`, `lib/plan/__tests__/`                                                    |
| Training calendar                          | `lib/training-calendar/__tests__/`, `lib/training/__tests__/`                                          |
| Adaptive stack                             | `lib/athlete-memory/__tests__/`, `lib/adaptation-engine/__tests__/`, `lib/causal-reasoning/__tests__/` |
| Recommendation integrity/learning/outcomes | `lib/recommendation-*/__tests__/`                                                                      |
| Medical-language safety                    | `lib/safety/__tests__/`                                                                                |
| Wellness + leg-feel store                  | `lib/wellness/__tests__/`, `stores/__tests__/`                                                         |
| Return-to-running                          | `lib/returning/__tests__/`                                                                             |
| Insights                                   | `lib/insights/__tests__/`                                                                              |
| Intelligence tools + auth                  | `lib/intelligence/__tests__/`                                                                          |
| Reasoning                                  | `lib/reasoning/__tests__/`                                                                             |
| Coach + coaching context                   | `lib/coach/__tests__/`, `lib/coaching-context/__tests__/`                                              |
| Ecosystem                                  | `lib/ecosystem/__tests__/`                                                                             |
| Ingestion + merge                          | `lib/strava/__tests__/`, `lib/strava/api/__tests__/`, `lib/data/__tests__/`                            |
| Webhook signature                          | `lib/strava/webhooks/__tests__/`                                                                       |
| API routes + session auth                  | `app/api/__tests__/`, `app/api/webhooks/strava/__tests__/`, `lib/auth/__tests__/`                      |
| MCP client + parity                        | `lib/mcp/__tests__/`                                                                                   |
| Database round-trips                       | `lib/db/__tests__/` (opt-in, see below)                                                                |
| Demo athlete                               | `lib/demo/__tests__/`                                                                                  |
| Route intelligence, charts                 | `lib/route-intelligence/__tests__/`, `lib/charts/__tests__/`                                           |

```bash
npm run check   # tsc + prettier + eslint + vitest
npm run build
```

**Database tests are opt-in.** The suites in `lib/db/__tests__/` round-trip against a real
Postgres and `DELETE` rows, so they are gated on `TEST_DATABASE_URL` — deliberately _not_
`DATABASE_URL` — and a non-local host makes them fail loudly rather than skip:

```bash
docker compose up -d
TEST_DATABASE_URL=postgresql://strideiq:strideiq@localhost:5432/strideiq npx vitest run lib/db
```

A handful of ingestion tests read a git-ignored Strava export fixture and self-skip when it
is absent, which is the normal state in CI.

---

## 21. Feature index by route

| Route               | Features                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| `/`                 | Landing, "Try the demo"                                                 |
| `/home`             | Hero, week ops, insights, progression, goal mission, leg-feel, sync     |
| `/training`         | Volume, blocks, efficiency, fatigue, ecosystem, plan preview            |
| `/plan`             | Planning context, AI/rule-based week, calendar board, planned vs actual |
| `/performance`      | Trends, records, projections, insights                                  |
| `/goals`            | Race briefing (V2), readiness, execution, trajectory, risks, scenarios  |
| `/runs`             | Activity list                                                           |
| `/runs/[id]`        | Workout detail, session narrative, post-run feel                        |
| `/runs/[id]/route`  | Map replay, pace/HR/elevation                                           |
| `/intelligence`     | Athlete belief model, signals, memory, forecast accuracy, ecosystem     |
| `/coach`            | Investigation chat, tools, threads                                      |
| `/report`           | Printable change report                                                 |
| `/import`           | CSV, FIT, OAuth, quality                                                |
| `/settings`         | Units, goal, webhooks, privacy                                          |
| `/context`          | Cross-training / activity ecosystem                                     |
| `/dev/forecast-lab` | Forecast V2 validation workbench                                        |

---

## Related documentation

| Document                                                                         | Contents                 |
| -------------------------------------------------------------------------------- | ------------------------ |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                               | Layers, data flow, API   |
| [COACH_AND_INTELLIGENCE.md](COACH_AND_INTELLIGENCE.md)                           | Intelligence vs Coach UX |
| [DEPLOYMENT.md](DEPLOYMENT.md)                                                   | Production setup         |
| [PRODUCT.md](../PRODUCT.md)                                                      | Product contract         |
| [internal/DIFFERENTIATION_NORTH_STAR.md](internal/DIFFERENTIATION_NORTH_STAR.md) | Future moat features     |
| [internal/ROADMAP_10_FEATURES.md](internal/ROADMAP_10_FEATURES.md)               | Planned feature waves    |

---

_This catalog reflects the repository state at documentation time. When adding a feature, update this file and the relevant section in [README.md](../README.md)._
