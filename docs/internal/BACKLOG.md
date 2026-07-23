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

| #      | Item                                                                                                                                       | Size     | Value    | Notes                                                                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~F1~~ | ✅ "What should I run today?" — single-session recommender — **done** (#36)                                                                | S–M      | High     | Coach tool `recommend_today_session` + engine + 9 tests. Follow-ups: Home "Today" card, MCP parity                                                                                                                                                                                     |
| ~~F2~~ | ✅ Apply unit preferences app-wide — **done** (#41)                                                                                        | S–M      | High     | `lib/units.ts` core + `useUnitFormat`; formatters read the saved unit. Follow-ups: race-strategy/execution split charts + plan-engine text stay metric                                                                                                                                 |
| ~~F3~~ | ✅ Persist the weekly Plan to the DB — **done** (#43)                                                                                      | M        | Med–high | `training_calendar_weeks` table + `/api/me/training-calendar` (GET/POST/DELETE); `useTrainingCalendar` hydrates from server + debounced sync; localStorage kept as offline cache                                                                                                       |
| ~~F4~~ | ✅ Adaptive goal-scenario engine — **done** (#42)                                                                                          | M–L      | High     | `lib/goals/goalScenarios.ts` + `get_goal_scenarios` tool + Goals panel; probability reuses the v2 forecast prediction interval (no invented numbers)                                                                                                                                   |
| ~~F5~~ | ✅ Workout-quality v2 — **done** (#44)                                                                                                     | M        | Med–high | `lib/analytics/workoutQuality.ts` (repeatability, NEW aerobic decoupling, threshold control); extends `compare_sessions` + run-detail execution panel                                                                                                                                  |
| F6     | Risk-pattern matching · monthly/pre-race narratives · phase-catalog UI · ~~recommendation-outcome tracking~~ · ~~persisted AthleteMemory~~ | M–L each | Med      | Longer-horizon differentiation depth. **Recommendation-outcome tracking done** (#45–#47). **Persisted AthleteMemory done** (#48): beliefs accumulate `firstObserved`/`timesConfirmed`/confidence floor across sessions. Remaining: risk-pattern matching, narratives, phase-catalog UI |

## Progress

- ✅ **Q1–Q6** — polish + prune pass (#34–#35)
- ✅ **F1** — today's-session recommender (#36)
- ✅ **C1–C3** — Dependabot majors closed (#37–#38) + coverage (#39)
- ✅ **F2** — unit preferences app-wide (#41)
- ✅ **F4** — adaptive goal-scenario engine (#42)
- ✅ **F3** — persist weekly plan to DB (#43)
- ✅ **F5** — workout-quality v2 (#44)
- ✅ **F6 (slice)** — recommendation-outcome tracking (#45)

- ✅ **F6 (outcome tracking, complete)** — adherence + outcome-signal + Intelligence panel (#45, #46); week-plan & goal-scenario producers logged (#47)
- ✅ **F6 (persisted AthleteMemory)** — beliefs accumulate history across sessions (#48)

**Remaining:** C4 (low urgency) and the rest of **F6** (risk-pattern matching, monthly/pre-race narratives, phase-catalog UI). Plus fast-follows: Home "Today" card + MCP parity (F1), race-strategy split charts in miles (F2), `executeIntelligenceTool` integration tests (C3), fold real recommendation outcomes into persisted beliefs + coach-memory route persistence.

## Confirmed solid — no action

Error/404 boundaries, first-run/demo flow, Coach viewport lock, loading skeletons on the six newer pages, most of `lib/analytics`/`lib/ecosystem`/`lib/forecasting-v2` coverage. The `ROADMAP_10_FEATURES` doc is fully shipped and no longer a source of gaps.
