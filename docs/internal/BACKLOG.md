# StrideIQ engineering backlog

Prioritized from a three-pass codebase survey (product gaps · code health · UX completeness). Ranked by value ÷ effort. Sizes: **S** ≈ hours, **M** ≈ a day or two, **L** ≈ multi-day.

Status: `todo` unless noted. Update as items ship.

## Quick wins — small, high leverage

**All shipped** (polish + prune pass, PRs #34–#35).

| #      | Item                                                            | Size | Notes                                                        |
| ------ | --------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| ~~Q1~~ | ✅ Retire the 5 legacy routes + nav — **done** (#35)            | M    | ~450 dead LOC removed; IA confusion + blank-body bug cleared |
| ~~Q2~~ | ✅ Mobile nav accessibility — **done** (#34)                    | S    | `aria-label`/`title` on icon nav items                       |
| ~~Q3~~ | ✅ Coach send button `aria-label` — **done** (#34)              | S    |                                                              |
| ~~Q4~~ | ✅ Delete orphaned `components/runs-table.tsx` — **done** (#34) | S    |                                                              |
| ~~Q5~~ | ✅ `run-explorer` ref-in-render fix — **done** (#34)            | S    | `intelCache` moved to a `useMemo`-derived value              |
| ~~Q6~~ | ✅ `formatWorkoutFile` altitude guard — already correct         | S    | Verified guarded during the survey; no change needed         |

## Cleanup / tech-debt

| #      | Item                                                                                      | Size | Notes                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ~~C1~~ | ✅ pako 2→3 (Dependabot #20) — **done** (#37)                                             | S    | Gated by a `decompressFitBuffer` round-trip test                                                                                        |
| ~~C2~~ | ✅ maplibre-gl 4→6 (Dependabot #21) — **done** (#38)                                      | M    | Namespace import for removed default export; live map render still worth a manual check                                                 |
| ~~C3~~ | ✅ Coverage on risky untested cores — **done** (#39)                                      | L    | parseResponse 0→100%, dashboardData 0→~91%, tools.ts registry+parseToolName. Follow-up: integration tests for `executeIntelligenceTool` |
| C4     | Tighten `as unknown as` casts on Strava/DB payloads; fix `plan-workspace` `runs` re-alloc | M    | Low urgency                                                                                                                             |

The 17 `react-hooks/set-state-in-effect` warnings are intentional lifecycle patterns — leave.

## Features — ranked by value ÷ effort

| #      | Item                                                                                                                               | Size     | Value    | Notes                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------- |
| ~~F1~~ | ✅ "What should I run today?" — single-session recommender — **done** (#36)                                                        | S–M      | High     | Coach tool `recommend_today_session` + engine + 9 tests. Follow-ups: Home "Today" card, MCP parity |
| F2     | Apply unit preferences app-wide — `distanceUnit`/`paceUnit` saved but only read in Settings                                        | S–M      | High     | Mile users see km labels everywhere; latent bug + polish                                           |
| F3     | Persist the weekly Plan to the DB — currently localStorage-only, lost across devices                                               | M        | Med–high | `/api/me/weekly-plan` generates but never stores                                                   |
| F4     | Adaptive goal-scenario engine — "1:45 needs +12% volume + 2 threshold sessions (prob X)"                                           | M–L      | High     | Named moat feature; no `GoalScenario`/`get_goal_scenarios` yet                                     |
| F5     | Workout-quality v2 — interval repeatability, aerobic decoupling, threshold control                                                 | M        | Med–high | Blocks "compare my last 3 thresholds"                                                              |
| F6     | Risk-pattern matching · monthly/pre-race narratives · phase-catalog UI · recommendation-outcome tracking · persisted AthleteMemory | M–L each | Med      | Longer-horizon differentiation depth                                                               |

## Progress

- ✅ **Q1–Q6** — polish + prune pass (#34–#35)
- ✅ **F1** — today's-session recommender (#36)
- ✅ **C1–C3** — Dependabot majors closed (#37–#38) + coverage (#39)

**Remaining:** C4 (low urgency) and the feature track **F2–F6**. Suggested next: **F2** (apply unit preferences app-wide) — high value, fixes a latent bug where mile users see km labels everywhere.

## Confirmed solid — no action

Error/404 boundaries, first-run/demo flow, Coach viewport lock, loading skeletons on the six newer pages, most of `lib/analytics`/`lib/ecosystem`/`lib/forecasting-v2` coverage. The `ROADMAP_10_FEATURES` doc is fully shipped and no longer a source of gaps.
