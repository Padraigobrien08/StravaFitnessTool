# Proposal — Leg-Feel (subjective wellness input)

**Status:** P1–P4 shipped; outcome ladder = execution grade → HR drift → efficiency → training-response; validation tooled (`scripts/validate-calibration.mts`) · **Remaining:** run the validator once real reporting history accrues · **Risk:** low–medium

A daily subjective check-in that lets the athlete tell the model what Strava can't measure — "legs feel heavy" — and have it bounded-nudge the readiness verdict and today's session.

## The gap

StrideIQ is almost entirely read-only: readiness/freshness are derived purely from training-stress balance (TSB). The code even documents it (`lib/goals/viewModels.ts`: _"No sleep/HRV — subjective freshness not modeled"_). A model that never asks how you feel can't tell "TSB says fresh, but I slept 4 hours and my legs are lead" from a genuine green-light day. This is the one signal a wearable-free, Strava-only system cannot compute — cheap to add, and it makes every readiness call more trustworthy.

## Design principles (guardrails)

1. **A bounded nudge, never an override.** Feel adjusts the day's freshness within a hard cap (±~12 pts). It cannot invent fitness or rewrite history.
2. **Never touches the fitness model.** CTL/ATL/TSB are computed only from actual runs. Feel affects the _readiness verdict_, not the _load ledger_.
3. **Asymmetric & safety-first.** "Heavy" is respected more than "fresh" is rewarded (−12 vs +5) — you can always talk the model into backing off, never into a hard session it didn't already sanction. Prevents gaming.
4. **Today-only.** A report affects only its own date; it never retroactively rewrites past freshness or the trend.
5. **Transparent.** When feel changes the call, the evidence line says so.

## Architecture

### Data model

`db/migrations/008_leg_feel.sql` — a dated per-user log keyed `(user_id, feel_date)`, JSONB payload (forward-compatible with sleep/soreness/stress):

```sql
CREATE TABLE IF NOT EXISTS leg_feel_log (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feel_date  DATE NOT NULL,
  report     JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feel_date)
);
```

Types in `lib/wellness/types.ts`; DB helper `lib/db/leg-feel.ts` follows the house pattern (lazy `ensureLegFeelSchema`, `ON CONFLICT` upsert, `catch → null` no-DB degrade).

### The integration point (the elegant bit)

`freshnessFromTsb()` in `lib/analytics/fatigue.ts` is the single funnel where load balance becomes the freshness number + label. Adding an optional `legFeel` arg there means every one of the ~30 consumers of `analytics.fatigue.freshness` (today-session engine, Home hero verdict, risk patterns, forecasting inputs) inherits it automatically — no prop threading.

```
legFeel → freshnessFromTsb → analytics.fatigue.freshness → today-session · hero · risk · forecast
```

Analytics is computed **client-side** in `lib/context/strava-context.tsx` from data already in the browser. Today's feel (a zustand value) threads into that `computeInsights(...)` call exactly as `raceGoal`/settings already do — it re-memoizes when feel changes. `computeInsights` stays pure and synchronous; feel arrives as a scalar arg.

### Client & API

- **Store** `stores/feel-store.ts` — zustand + `persist` (localStorage, key `strideiq-feel-store-v1`), keyed by date. Optimistic; works offline / no-DB.
- **Hook** `hooks/use-leg-feel.ts` — reconciles today with the server on mount, fire-and-forget POST on set (mirrors the `use-training-calendar` local-first flow; no debounce needed — feel is a discrete tap).
- **API** `app/api/me/leg-feel/route.ts` — `getSessionUserId()` guard, zod-validated, GET reads a day / POST upserts (route skeleton copied from `preferences`).

### UI

- **Morning check-in** — the "How do the legs feel?" card on the Home console (`components/home/console/leg-feel-card.tsx`). Sets `source: "morning"`; the verdict/today-session re-compute live.
- **Post-run reflection** _(P2)_ — one-tap on run-detail (`source: "post_run"`).

## The learning loop (P2)

The app already grades recommendations against outcomes (`evaluateRecommendationOutcomes()` vs a `SignalSnapshot { freshness, tsb, readinessScore, hardRuns14d }`). Feed leg-feel into that loop and the model can learn each athlete's personal feel↔performance correlation — the ±nudge becomes individually calibrated instead of a fixed constant.

**Shipped in P2:** leg-feel is now recorded into that loop (added to `SignalSnapshot` and written to each outcome's `observedSignals`).

**Shipped in P3 (`lib/wellness/calibration.ts`):** a v1 per-athlete calibration. It's deliberately conservative — **amplify-only** and **evidence-gated**: below a history threshold everyone gets the proven default (−12 / +5); once there's enough history, an athlete whose reports reliably track the objective load model (a proxy for thoughtful reporting) earns a bit more weight, within a hard cap (−17 / +8); it never dampens below the default, so a reporter who diverges from the model — the case the feature exists for — keeps full weight.

**Shipped in P4 (`lib/wellness/outcomeCalibration.ts`):** true feel↔**outcome** recalibration. It pairs each directional report with the athlete's running in the next 0–2 days (aerobic efficiency vs. their baseline — _did they actually run worse when they said heavy?_) and, unlike P3, is **bidirectional**: predictive reporters are trusted more, counter-predictive ones less. It's Laplace-shrunk toward the default on small samples and floored so a "heavy" report never drops readiness by less than 6 (safety). The outcome signal is a four-rung ladder, most-direct first, broadening coverage as it descends: **session execution grade** (`scoreSessionExecution`, FIT) → **HR drift** within the run (FIT; overlaps #1, used when a full grade isn't available) → **aerobic efficiency** vs. baseline (needs HR) → **training-response** (did near-term volume move the way the report implies — a behavioural proxy for a skipped/curtailed session, needing only run dates + distance; carries a rest-day confound, so it's last). The whole calibration then falls back to the P3 agreement proxy → flat default as evidence thins.

**Validation (tooled, not yet meaningful).** `scripts/validate-calibration.mts` replays the exact production ladder over every athlete's real history — via the shared `buildFeelCalibration()` that `computeInsights` also uses, so it measures precisely what the app would apply — and reports fleet coverage (who clears the ≥6-pair gate), pooled predictive reliability, the per-athlete nudges and whether they sit inside the caps, which signal rung decided each pair, and sensitivity to the gate and shrinkage prior. It is read-only (SELECTs only) and runs under a small resolver hook (`scripts/lib-loader.mjs`) so plain Node can import the app's `@/`-aliased library graph:

```bash
node --import ./scripts/lib-loader.mjs --env-file=.env.local scripts/validate-calibration.mts
```

Because the feature and its `leg_feel_log` table only just shipped, today the validator reports every athlete on the default nudge (0 clear the gate) — the intended graceful-degradation state, and confirmation the fallback path works end-to-end. It becomes a real weight check once weeks of near-daily check-ins + logged runs accrue. **Remaining:** a plan-based "skipped session" signal still awaits skip history in the data model (the calendar holds only the current week today).

## Phasing

| Phase     | Scope                                                                                      | Est.      |
| --------- | ------------------------------------------------------------------------------------------ | --------- |
| **P0**    | UI + local state only (the mockup made real)                                               | ~0.5 day  |
| **P1** ✅ | Persist + blend into freshness + morning UI + tests                                        | ~2–3 days |
| **P2** ✅ | Post-run capture, niggle field, server-context threading for Coach, feel↔outcome recording | ~3–5 days |
| **P3** ✅ | Per-athlete calibration (v1) — amplify-only, evidence-gated nudge from feel↔load agreement | ~1 day    |
| **P4** ✅ | Outcome-based recalibration — bidirectional, shrunk, from feel↔performance pairs           | ~1 day    |

## Risks & open decisions

- **Over-weighting** → mitigated by the ±12 cap + asymmetry.
- **Gaming** ("say fresh, get hard sessions") → the fresh nudge is small and can't unlock a session TSB didn't already allow.
- **Sparse reporting** → the arg is optional; the model behaves identically when absent.

**Open (tune after seeing it live):** the exact nudge magnitudes (−12 / +5), whether MVP includes the niggle field (P1 is legs-only), and whether the Coach LLM sees it in v1 (P1 blends client-side only; server-context threading is P2).
