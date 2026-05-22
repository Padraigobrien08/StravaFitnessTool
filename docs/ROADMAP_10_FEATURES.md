# StrideIQ — 10 Feature Implementation Plans

Plans for the feasibility-ranked product ideas. Each section maps to **existing code** where possible and lists **new modules**, **UI**, **tests**, and **acceptance criteria**.

**Suggested build order:** 1 → 2 → 3 → 4 (high) → 5 → 6 → 7 → 8 (medium) → 9 → 10 (complex).

**Architecture rule (from `PRODUCT.md`):** `lib/strava` → `lib/domain` → `lib/analytics` → `lib/insights` → UI. No CSV parsing in components.

---

## Shared foundation (do once, before Wave 2+)

| Item | Purpose | Location |
|------|---------|----------|
| `WeekSnapshot` type | Canonical “this week vs last week” struct | `lib/analytics/week.ts` |
| `getCurrentWeekBounds()` | ISO week Mon–Sun in user TZ | `lib/analytics/week.ts` |
| Settings: race goal | Distance + target date + optional target time | `stores/settings-store.ts` or `stores/goal-store.ts` |
| Insight question `changed` | Already in types — use for weekly narrative | `lib/insights/types.ts` |
| Chart primitives | Sparkline / multi-series for progression | `components/charts.tsx` or `components/charts/` |

```ts
// lib/analytics/week.ts (proposed)
export interface WeekSnapshot {
  weekStart: string;       // yyyy-MM-dd
  runCount: number;
  distanceKm: number;
  longestRunKm: number;
  easyCount: number;
  hardCount: number;
  avgPaceSecPerKm: number | null;
}
```

Wire new analytics fields through `computeInsights()` in `lib/analytics/index.ts` and expose via `useTrainingIntelligence()`.

---

## Wave 1 — High feasibility

### 1. Weekly training narrative

**User value:** Plain-English “week in review” — volume, longest run, intensity, vs last week.

**Already exists**
- `weeklyVolume`, `lastNDaysVolume`, `easyHardSplit`, `goalProgress`
- Rule insights in `lib/insights/generate.ts` (fragments, not one narrative)
- `/report` — static bullets, not prose

**New analytics**
| File | Function | Output |
|------|----------|--------|
| `lib/analytics/week.ts` | `buildWeekSnapshot(runs, weekStart)` | `WeekSnapshot` |
| `lib/analytics/week.ts` | `compareWeeks(current, previous)` | deltas: km, runs, easy/hard ratio |
| `lib/analytics/narrative.ts` | `buildWeeklyNarrative(analytics, weekOffset=0)` | `WeeklyNarrative` |

```ts
export interface WeeklyNarrative {
  weekLabel: string;           // "May 12 – May 18"
  paragraphs: string[];        // 3–5 sentences
  bullets: string[];           // optional scannable lines
  severity: "positive" | "neutral" | "warning";
  confidence: "low" | "medium" | "high";
}
```

**Narrative template (deterministic, no LLM v1)**

1. Frequency vs Strava weekly goal (`goalProgress`) or settings default (3 runs/week).
2. Volume vs prior week (`compareWeeks`).
3. Longest run vs 4-week max.
4. Intensity: `easyHard` for current week only (filter runs by date).
5. Optional: efficiency one-liner if `efficiencySummary.trend` set.

Example output (matches your spec):

> You trained 3 times this week, matching your target.  
> Volume was 25.5 km, down from 36.4 km last week (−30%).  
> Intensity was high: 2 of 2 runs this week were hard (≥80% max HR).

**UI**
| Surface | Component |
|---------|-----------|
| Home | `WeeklyNarrativeCard` at top of `/home` (question: `changed`) |
| Reports | Full narrative + prior 4 weeks table in `/report` |
| Training | Collapsed “Last week” in `/training` |

**Insights integration**
- `generateInsights()` → push `id: "weekly-narrative"` with `question: "changed"`, `evidence: narrative.bullets`.

**Tests**
- `lib/analytics/__tests__/narrative.test.ts` — fixture runs spanning 2 weeks; assert sentences contain counts/km.

**Acceptance criteria**
- [ ] Narrative updates when import refreshes
- [ ] Handles zero-run week without crashing
- [ ] Shows confidence low if &lt; 2 runs in week

**Effort:** S (1–2 days)

---

### 2. Consistency score

**User value:** Single motivational score: frequency, volume stability, streaks.

**Already exists**
- `runGoalProgress` — % weeks meeting Strava run-count goal only
- No streaks or volume coefficient of variation

**New analytics**
| File | Function |
|------|----------|
| `lib/analytics/consistency.ts` | `weeklyRunStreak(runs)` |
| `lib/analytics/consistency.ts` | `volumeStabilityScore(weeklyVolume)` — 0–100 from CV of last 8 weeks |
| `lib/analytics/consistency.ts` | `frequencyScore(goalProgress \| settings)` |
| `lib/analytics/consistency.ts` | `buildConsistencyScore(runs, goals, settings)` → `ConsistencyScore` |

```ts
export interface ConsistencyScore {
  overall: number;              // 0–100
  label: string;                // "Steady" | "Building" | "Irregular"
  frequency: number;            // 0–100
  volumeStability: number;
  streakWeeks: number;          // consecutive weeks ≥1 run
  evidence: string[];
}
```

**Scoring (v1, transparent)**

| Component | Weight | Logic |
|-----------|--------|--------|
| Frequency | 40% | % of last 8 weeks with runs ≥ target (default 3 if no Strava goal) |
| Volume stability | 30% | `100 - min(100, CV * 200)` on weekly km (last 8 weeks) |
| Streak | 30% | `min(100, streakWeeks * 12.5)` capped at 8 weeks |

**UI**
| Surface | Component |
|---------|-----------|
| Home | KPI: “Consistency 72” with `ConfidenceBadge` |
| Goals | Card next to weekly run goal |
| Dashboard (legacy) | Optional duplicate |

**Tests**
- Perfect 8-week streak → overall ≥ 85
- One zero week breaks streak component

**Acceptance criteria**
- [ ] Score 0–100 with explainable breakdown
- [ ] Works without Strava goals (settings fallback)

**Effort:** S (1 day)

---

### 3. Easy/hard balance advisor

**User value:** Actionable guidance beyond “you’re too hard” — what to do this week.

**Already exists**
- `easyHardSplit`, `hrZoneDistribution` in `lib/analytics/hrZones.ts`
- Insights `intensity-heavy`, `easy-balance` in `generate.ts`
- `/effort` page with zone chart

**New analytics**
| File | Function |
|------|----------|
| `lib/analytics/intensityAdvisor.ts` | `analyzeIntensityBalance(easyHard, recentWeeks)` |
| `lib/analytics/intensityAdvisor.ts` | `buildIntensityAdvice(...)` → `IntensityAdvice` |

```ts
export interface IntensityAdvice {
  status: "balanced" | "too_hard" | "too_easy" | "insufficient_data";
  easyTargetPct: number;        // 70–80 polarized default
  currentEasyPct: number;
  hardRunsLast14d: number;
  recommendations: string[];    // ordered actions
  suggestedWeekPlan: { type: string; description: string }[];
}
```

**Rules (v1)**

| Condition | Recommendation |
|-----------|----------------|
| easy &lt; 30% and ≥2 hard in 14d | “Next 7 days: cap hard sessions at 1; add 2 easy runs 30–45 min Z1–Z2” |
| 0 runs in 7d | “Resume with 1 easy 30–40 min” |
| easy ≥ 60% and load rising | “Maintain; add strides or 1 tempo only if freshness &gt; 60” (ties to #6 later) |
| HR missing on &gt;50% runs | “Import with HR for better advice” |

**UI**
| Surface | Change |
|---------|--------|
| `/effort` | Replace static copy with `IntensityAdvisorPanel` |
| Home | Insight `question: "next"` when status `too_hard` |
| Training | Link “See effort balance” |

**Tests**
- 80% hard runs → `too_hard` + ≥2 recommendations

**Acceptance criteria**
- [ ] Advice references actual easy/hard counts from last 14 days
- [ ] Degrades gracefully when no HR

**Effort:** S (1 day) — builds on existing `easyHard`

---

### 4. Personal best progression

**User value:** See how PRs and race predictions evolved over time — engagement loop.

**Already exists**
- `findPersonalRecords` — **current** bests only
- `buildRacePredictionAnalysis` — **current** consensus only
- No historical snapshots

**Approach: recompute timeline (no server DB v1)**

| File | Function |
|------|----------|
| `lib/analytics/progression.ts` | `buildPrTimeline(runs, fitDetails)` |
| `lib/analytics/progression.ts` | `buildPredictionTimeline(runs, fitDetails, sampleEveryNWeeks=4)` |

```ts
export interface PrTimelinePoint {
  date: string;
  bucket: "5k" | "10k" | "hm" | "long";
  timeSec: number;
  runId: string;
  isNewPr: boolean;             // strictly faster than all prior
}

export interface PredictionTimelinePoint {
  weekStart: string;
  consensus5kSec: number;
  consensus10kSec: number;
  consensusHmSec: number;
}
```

**Algorithm**
1. Sort runs by date ascending.
2. For each run date, compute PRs using only runs ≤ that date (reuse `findPersonalRecords` on slice — cache by index for perf).
3. Emit point when time improves for bucket.
4. Predictions: every 4 weeks, `buildRacePredictionAnalysis(slice)` — cap at ~15 points for perf.

**UI**
| Surface | Component |
|---------|-----------|
| `/records` | `PrProgressionChart` — step line per distance |
| `/goals` | `PredictionTrendChart` — 5K/10K/HM lines over time |
| Home insight | “New 5K PR on Mar 12” when latest point `isNewPr` within 14d |

**Tests**
- Two runs, second faster 5K → 2 timeline points, second `isNewPr: true`

**Acceptance criteria**
- [ ] Chart loads in &lt;500ms for 60 runs (memoize slices or incremental PR update)
- [ ] FIT segments count in timeline

**Effort:** M (2–3 days) — perf care on incremental PR

---

## Wave 2 — Medium feasibility

### 5. Aerobic efficiency trend (enhance)

**User value:** “Running faster at similar HR vs February” — clear longitudinal story.

**Already exists (strong)**
- `aerobicEfficiencyTrend`, `efficiencySummary` in `lib/analytics/efficiency.ts`
- `/training` chart, insights `pace-efficiency-up/down`

**Enhancements**
| File | Addition |
|------|----------|
| `lib/analytics/efficiency.ts` | `efficiencyMonthOverMonth(points)` → `{ currentMonth, priorMonth, pctChange, narrative }` |
| `lib/analytics/efficiency.ts` | `comparableEffortSubset` — filter runs with HR in band 140–155 (settings: maxHR) |
| `lib/insights/generate.ts` | Richer evidence strings with month names |

**UI**
- Home: one sentence under KPI when trend improving
- Training: subtitle on efficiency chart + `WhatThisMeans` with formula `pace / HR`

**Acceptance criteria**
- [ ] Narrative cites two calendar months when ≥8 runs span 60+ days
- [ ] Insight confidence tied to HR coverage from `assessImportQuality`

**Effort:** S (0.5–1 day) — mostly polish

---

### 6. Fatigue / freshness estimate

**User value:** Am I carrying load or ready for quality?

**Already exists**
- `fitnessIndex` — CTL-style EMA on weekly `trainingLoad` only
- `hrDriftPct` on `FitRunDetail` — not in `DashboardInsights`
- No ATL / TSB

**New analytics**
| File | Function |
|------|----------|
| `lib/analytics/fatigue.ts` | `acuteChronicLoad(weeklyLoad)` → CTL, ATL (7d EMA), TSB = CTL − ATL |
| `lib/analytics/fatigue.ts` | `freshnessScore(tsb, recentIntensity, restDays)` → 0–100 |
| `lib/analytics/index.ts` | Add `fatigue: FatigueSnapshot` to `DashboardInsights` |

```ts
export interface FatigueSnapshot {
  ctl: number;
  atl: number;
  tsb: number;
  freshness: number;            // 0–100 mapped from TSB
  label: string;                // "Fresh" | "Neutral" | "Fatigued"
  restDaysSinceLastRun: number;
  evidence: string[];
}
```

**Freshness mapping (v1)**

| TSB | Label | Freshness |
|-----|-------|-----------|
| &gt; +10 | Fresh | 75–100 |
| −10 to +10 | Neutral | 40–74 |
| &lt; −10 | Fatigued | 0–39 |

Boost freshness +10 if ≥2 rest days after last hard run.

**UI**
- `/training` — `FreshnessGauge` + CTL/ATL sparkline (extend `FitnessChart`)
- Home insight when `freshness &lt; 35` → recommend easy week
- Run detail: show `hrDriftPct` when FIT present (already partial)

**Tests**
- Rising load 3 weeks → ATL &gt; CTL, negative TSB

**Acceptance criteria**
- [ ] Works with partial load data (fallback to run count × distance proxy)
- [ ] Disclaimer in `WhatThisMeans`: not medical advice

**Effort:** M (2 days)

---

### 7. Goal readiness engine

**User value:** Pick a race (5K / 10K / HM / marathon + date) → readiness % and gaps.

**Already exists**
- `halfMarathonReadiness` — HM only, fixed 160 km / 4wk
- Goals page shows HM card + predictions

**New modules**
| File | Function |
|------|----------|
| `stores/goal-store.ts` | `raceGoal: { distance: RaceDistance, date: string, targetTimeSec?: number }` |
| `lib/analytics/readiness.ts` | `raceReadiness(runs, goal, predictions)` → generalize HM logic |

**Readiness model (v1, per distance)**

| Distance | Long run target | 4-week volume target | Pace signal |
|----------|-----------------|----------------------|-------------|
| 5K | 8 km | 40 km | Best 5K effort vs prediction |
| 10K | 12 km | 60 km | Best 10K effort |
| HM | 18 km | 160 km | Existing HM score |
| Marathon | 32 km | 220 km | Long run + volume |

```ts
export interface RaceReadiness {
  distance: string;
  daysUntilRace: number;
  score: number;                // 0–100
  label: string;
  gaps: { metric: string; current: string; target: string }[];
  probabilityBand?: string;     // "Likely finish" | "Stretch" — heuristic from score
}
```

**UI**
- `/goals` — goal picker (Zustand persist), readiness card replaces HM-only when set
- Countdown + “Add 1 long run of X km” gap list
- Link to predictions panel

**Tests**
- HM goal 21 days out with 20 km long run → score ≥ 80

**Acceptance criteria**
- [ ] User can set/clear race goal in Settings or Goals
- [ ] Readiness updates on re-import

**Effort:** M (2–3 days)

---

### 8. Workout type classifier

**User value:** Auto labels: easy, tempo, interval, long, recovery, race.

**Already exists**
- Binary `easyHardSplit` via avg HR vs max HR
- FIT `laps`, `bestEfforts`, pace streams

**New analytics**
| File | Function |
|------|----------|
| `lib/analytics/workoutType.ts` | `classifyRun(run, fit?, maxHr)` → `WorkoutType` |

```ts
export type WorkoutType =
  | "easy" | "recovery" | "tempo" | "interval" | "long" | "race" | "unknown";

export interface WorkoutClassification {
  type: WorkoutType;
  confidence: "low" | "medium" | "high";
  signals: string[];           // "High HR variability", "5+ pace spikes"
}
```

**Decision tree (v1)**

1. **Name hints** — regex: `interval|tempo|fartlek|long run|race|parkrun` (boost confidence).
2. **Distance** — ≥18 km → `long` unless HR very high.
3. **HR** — avg &lt; 75% max → `easy`; 75–85% → `tempo`; ≥85% → check laps.
4. **FIT laps** — ≥4 laps with CV(pace) &gt; 15% and lap pace alternating → `interval`.
5. **Recovery** — &lt;6 km and easy HR after previous day hard.

**UI**
- `/runs` table — column `Type` with badge
- `/runs/[id]` — classification + signals
- `/effort` — stacked bar: % of runs by type last 8 weeks
- Filter runs by type (client-side)

**Tests**
- Mock interval session with lap variance → `interval`
- Easy 10K Z2 → `easy`

**Acceptance criteria**
- [ ] ≥70% of labeled runs have medium+ confidence when HR + distance present
- [ ] Unknown when HR missing and name generic

**Effort:** M (3 days) — FIT lap logic needs fixtures

---

## Wave 3 — High complexity

### 9. Adaptive training recommendation engine

**User value:** Next-week prescription from fatigue, goal, and history — with guardrails.

**Dependencies:** #2 consistency, #3 intensity advisor, #6 fatigue, #7 race goal, #8 workout types (soft).

**New modules**
| File | Function |
|------|----------|
| `lib/training/planEngine.ts` | `buildNextWeekPlan(context)` → `WeekPlan` |
| `lib/training/safety.ts` | `validatePlan(plan, history)` — max +10% volume, max 2 hard sessions |

```ts
export interface WeekPlan {
  weekStart: string;
  totalKmRange: [number, number];
  sessions: PlannedSession[];
  warnings: string[];
  rationale: string[];
}

export interface PlannedSession {
  day?: string;                 // "Tue" optional
  type: WorkoutType;
  distanceKmRange: [number, number];
  description: string;          // "3 × 8 min @ threshold"
}
```

**Engine inputs (`PlanContext`)**
- `fatigue.freshness`, `fatigue.tsb`
- `raceReadiness` + `daysUntilRace`
- Last 4 weeks volume, easy/hard ratio
- `consistency.overall`
- User settings: max weekly km, runs per week

**Rules (v1 — template library, not ML)**

| State | Template |
|-------|----------|
| Fatigued (freshness &lt; 40) | 3 easy runs, 1 optional strides, −10% volume cap |
| Race in 7–14d | Taper: −30% volume, 1 short tempo, 1 easy long |
| Base building | 1 long easy, 2 easy, 1 tempo OR intervals |
| Too hard recent | No intervals; 4 easy runs |

**UI**
- Home `question: "next"` — hero card “Recommended next week”
- `/training` — expandable week plan with checkboxes (local only, no sync v1)
- Export to `/report`

**Safety (`lib/training/safety.ts`)**
- Reject plan if `proposedKm &gt; lastWeekKm * 1.15`
- Reject if &gt;2 hard sessions when TSB &lt; −15
- Always append: “Not a substitute for coach/medical advice”

**Tests**
- Fatigued context → no interval session
- Race in 10 days → volume reduction

**Acceptance criteria**
- [ ] Every recommendation traceable to `rationale[]`
- [ ] Plan never exceeds safety caps

**Effort:** L (4–5 days)

---

### 10. Race strategy simulator

**User value:** Target splits, fade risk, pacing strategy for goal race — not just finish time.

**Dependencies:** #7 race goal, `buildRacePredictionAnalysis`, optional #6 fatigue.

**New modules**
| File | Function |
|------|----------|
| `lib/analytics/raceStrategy.ts` | `simulateRaceStrategy(goal, prediction, profile)` |
| `lib/analytics/raceStrategy.ts` | `evenSplitPlan(distance, targetTimeSec)` |
| `lib/analytics/raceStrategy.ts` | `negativeSplitPlan(...)` |
| `lib/analytics/raceStrategy.ts` | `fadeRiskScore(exponent, tsb, longestRunRatio)` |

```ts
export interface RaceStrategy {
  targetTimeSec: number;
  strategy: "even" | "negative" | "conservative";
  splits: { km: number; cumulativeSec: number; paceSecPerKm: number }[];
  fadeRisk: "low" | "medium" | "high";
  narrative: string[];
  warnings: string[];
}
```

**Model (v1)**
1. **Target time** — user goal or consensus prediction for distance.
2. **Even splits** — `pace = targetTime / distance` with slight +2% drift second half for HM+.
3. **Fade risk** — high if regression exponent &gt; 1.08, TSB &lt; −5, longest run &lt; 80% race distance.
4. **Conservative** — +3% pace first half, −1% second half vs even.

**UI**
- `/goals` — “Race day strategy” section when race goal set
- Table: km markers 5, 10, 15… + cumulative time
- Chart: pace profile line (Recharts)
- Compare even vs negative toggle

**Tests**
- HM 1h50 target → 21.1 km splits sum to ~6600s ±30s
- Low longest run → fadeRisk high

**Acceptance criteria**
- [ ] Splits monotonic cumulative time
- [ ] Uncertainty copy: “±2–4 min typical error at HM”

**Effort:** L (4–6 days)

---

## Cross-cutting: insights & PRODUCT.md

After each feature, extend `lib/insights/generate.ts` with 1–2 cards max (avoid noise). Map questions:

| Feature | Insight `question` |
|---------|-------------------|
| 1 Weekly narrative | `changed` |
| 2 Consistency | `training` |
| 3 Intensity advisor | `next` / `training` |
| 4 PB progression | `improving` |
| 5 Efficiency | `improving` (exists) |
| 6 Fatigue | `next` |
| 7 Race readiness | `ready` |
| 8 Workout types | `training` |
| 9 Plan engine | `next` |
| 10 Race strategy | `ready` |

Update `PRODUCT.md` roadmap checklist when a wave ships.

---

## Implementation matrix

| # | Feature | Effort | New lib files | Primary UI | Depends on |
|---|---------|--------|---------------|------------|------------|
| 1 | Weekly narrative | S | `week.ts`, `narrative.ts` | Home, Report | volume, easyHard |
| 2 | Consistency score | S | `consistency.ts` | Home, Goals | volume, goals |
| 3 | Easy/hard advisor | S | `intensityAdvisor.ts` | Effort, Home | easyHard |
| 4 | PB progression | M | `progression.ts` | Records, Goals | records, predictions |
| 5 | Efficiency enhance | S | `efficiency.ts` Δ | Training, Home | existing |
| 6 | Fatigue/freshness | M | `fatigue.ts` | Training, Home | trainingLoad |
| 7 | Goal readiness | M | `readiness.ts` Δ, `goal-store` | Goals, Settings | volume, PRs |
| 8 | Workout classifier | M | `workoutType.ts` | Runs, Effort | HR, FIT laps |
| 9 | Adaptive plan | L | `training/planEngine.ts`, `safety.ts` | Home, Training | 2,3,6,7 |
| 10 | Race strategy | L | `raceStrategy.ts` | Goals | 7, predictions |

**Total rough estimate:** ~22–30 dev days for all ten (solo), or **3–4 weeks** focused.

---

## Phase rollout (recommended PRs)

| PR | Scope | User-visible win |
|----|--------|------------------|
| PR-A | #1 + `week.ts` | Home “This week” story |
| PR-B | #2 + #3 | Consistency KPI + Effort advisor |
| PR-C | #4 | Records progression charts |
| PR-D | #5 + #6 | Training freshness + efficiency copy |
| PR-E | #7 + `goal-store` | Custom race readiness |
| PR-F | #8 | Run type badges |
| PR-G | #9 | Next-week plan card |
| PR-H | #10 | Race split simulator |

---

## Out of scope for v1 (all features)

- LLM-generated prose (use templates first)
- Weather-adjusted pace
- Cloud sync / multi-device goals
- Push notifications
- Coach marketplace integrations

---

## Next step

Pick a wave or PR (e.g. **PR-A: weekly narrative**) and we can implement against this plan file-by-file.
