# StrideIQ engineering backlog

Prioritized from a three-pass codebase survey (product gaps · code health · UX completeness). Ranked by value ÷ effort. Sizes: **S** ≈ hours, **M** ≈ a day or two, **L** ≈ multi-day.

Status: `todo` unless noted. Update as items ship.

## Quick wins — small, high leverage

| #   | Item                                                                                                  | Size | Notes                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Retire the 5 legacy routes (`/dashboard`, `/trends`, `/effort`, `/records`, `/activity-mix`) + nav    | M    | Clears three findings: IA confusion, the blank-body bug (they render nothing when `computeInsights` returns null), ~450 dead LOC |
| Q2  | Mobile nav accessibility — 7 nav items are unlabeled icons on phones (`components/nav.tsx`)           | S    | Add `aria-label`/`title`; core to phone usability                                                                                |
| Q3  | Coach send button `aria-label` (`components/coach/coach-composer.tsx`)                                | S    | Primary Coach action is unlabeled for screen readers                                                                             |
| Q4  | Delete orphaned `components/runs-table.tsx` (superseded by `run-explorer`)                            | S    | Confirmed imported nowhere                                                                                                       |
| Q5  | `run-explorer` ref-in-render — `intelCache` read/written inside a `useMemo` (`runs/run-explorer.tsx`) | S    | Real render-purity bug under StrictMode/concurrent                                                                               |
| Q6  | `formatWorkoutFile` altitude double-`!` (`lib/strava/api/formatWorkoutFile.ts:20`)                    | S    | Throws / emits `undefined` GPX when altitude stream absent                                                                       |

## Cleanup / tech-debt

| #   | Item                                                                                                                        | Size | Notes                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| C1  | pako 2→3 (Dependabot #20)                                                                                                   | S    | Only `inflate` used; low risk. Gate on a `parseFit` `.gz` test first (10% cov) |
| C2  | maplibre-gl 4→6 (Dependabot #21)                                                                                            | M    | Conservative API use; verify map renders + `.maplibregl-ctrl-*` CSS in globals |
| C3  | Coverage on risky untested cores: `intelligence/tools.ts` (7%), `home/dashboardData.ts` (0%), coach `parseResponse.ts` (0%) | L    | Highest logic × low-coverage modules                                           |
| C4  | Tighten `as unknown as` casts on Strava/DB payloads; fix `plan-workspace` `runs` re-alloc                                   | M    | Low urgency                                                                    |

The 17 `react-hooks/set-state-in-effect` warnings are intentional lifecycle patterns — leave.

## Features — ranked by value ÷ effort

| #   | Item                                                                                                                               | Size     | Value    | Notes                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | --------------------------------------------------------------- |
| F1  | "What should I run today?" — single-session recommender (Coach tool + surface)                                                     | S–M      | High     | Named north-star capability; only a full-week plan exists today |
| F2  | Apply unit preferences app-wide — `distanceUnit`/`paceUnit` saved but only read in Settings                                        | S–M      | High     | Mile users see km labels everywhere; latent bug + polish        |
| F3  | Persist the weekly Plan to the DB — currently localStorage-only, lost across devices                                               | M        | Med–high | `/api/me/weekly-plan` generates but never stores                |
| F4  | Adaptive goal-scenario engine — "1:45 needs +12% volume + 2 threshold sessions (prob X)"                                           | M–L      | High     | Named moat feature; no `GoalScenario`/`get_goal_scenarios` yet  |
| F5  | Workout-quality v2 — interval repeatability, aerobic decoupling, threshold control                                                 | M        | Med–high | Blocks "compare my last 3 thresholds"                           |
| F6  | Risk-pattern matching · monthly/pre-race narratives · phase-catalog UI · recommendation-outcome tracking · persisted AthleteMemory | M–L each | Med      | Longer-horizon differentiation depth                            |

## Recommended first slice

1. **Q1–Q6** as a "polish + prune" pass (Q2–Q6 are pure fixes; Q1 is a scoped removal).
2. **F1** (session-for-today) as the first real feature.
3. **C1** (pako, with a `parseFit` test) to close a Dependabot major.

## Confirmed solid — no action

Error/404 boundaries, first-run/demo flow, Coach viewport lock, loading skeletons on the six newer pages, most of `lib/analytics`/`lib/ecosystem`/`lib/forecasting-v2` coverage. The `ROADMAP_10_FEATURES` doc is fully shipped and no longer a source of gaps.
