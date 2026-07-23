# StrideIQ deep-analysis roadmap

**Premise:** StrideIQ is single-athlete and local. That's a liberation, not a limitation — no multi-tenant scale or privacy tax. So we can:

- run heavy compute per load (ensembles, bootstraps, backtests, nightly reprocessing);
- store full **derivation traces**, not just results;
- fit **the athlete's own physiology** instead of population averages;
- show **everything** — glass-box by default.

**Product identity:** not a black-box coach — a **transparent, self-auditing sports scientist for one athlete**. AGENTS.md already says "engines decide, LLMs narrate"; this roadmap extends it to **"engines show their work."**

Ranked by value ÷ effort. Sizes: **S** ≈ hours, **M** ≈ a day or two, **L** ≈ multi-day. Status `todo` unless noted.

---

## Pillar 1 — Glass-box forecaster (FLAGSHIP)

_Answers "why is my prediction what it is?" Reuses `lib/forecasting-v2` (componentScores, predictionInterval, modelEstimates, observability) + the recommendation-outcome tracking infra (#45–#47)._

| #      | Item                                                    | Size | Notes                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~G1~~ | ✅ **Prediction-derivation waterfall** — **done** (#53) | M    | `RaceForecastV2.derivation[]` (capability base → durability × → specificity × → freshness ± → bounds), step deltas reconcile exactly to most-likely; `explain_prediction` tool + "How we got this number" Goals panel.                                                                                     |
| ~~G2~~ | ✅ Sensitivity / tornado chart — **done** (#55)         | M    | `computeForecastSensitivity` perturbs each lever (long run, volume, quality, freshness) and re-forecasts → seconds of leverage. "What would move your time most" tornado panel + `explain_prediction.sensitivity`. (Honestly shows +quality can _slow_ a fatigued runner.) Follow-up: interactive sliders. |
| ~~G3~~ | ✅ Ensemble transparency — **done** (#54)               | S–M  | Model rows (estimate + weight) + agreement/spread on the Goals panel and in `explain_prediction`.                                                                                                                                                                                                          |
| ~~G4~~ | ✅ Confidence decomposition — **done** (#54)            | S    | `uncertaintyModel` attributes interval width to base + each driver (`widthSec`); "Why your range is this wide" panel + `explain_prediction.whyRangeIsWide`, reconciles to total width.                                                                                                                     |
| ~~G5~~ | ✅ **Self-auditing calibration** — **done** (#56)       | M–L  | `forecast_log` (migration 007) + `calibration.ts` scores each logged forecast against the actual effort that later lands; `get_forecast_accuracy` tool + Intelligence panel (% in p10–p90, bias, mean error). **Pillar 1 complete.**                                                                       |

## Pillar 2 — Elite physiology

_Metrics most tools don't compute; personalized, not population tables._

| #      | Item                                                | Size | Notes                                                                                                                                                                                                                                                                                                                                                      |
| ------ | --------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~P1~~ | ✅ **Critical Speed (CS) + D′** — **done** (#57)    | M    | `lib/analytics/physiology.ts` fits the two-parameter model `distance = CS·t + D′` on the athlete's own 2–30 min efforts → aerobic ceiling (CS, as a pace) vs anaerobic reserve (D′). Added as a `Critical Speed` capability model in the ensemble (down-weighted as the race outruns the fit band). `get_physiology` tool + Intelligence physiology panel. |
| ~~P2~~ | ✅ Personalized fatigue-resistance — **done** (#58) | S    | `assessFatigueResistance` surfaces the fitted power-law exponent vs the ~1.06 Riegel reference (+ "% extra fade per doubling") with a recent-vs-older trend. Extends `get_physiology` + panel.                                                                                                                                                             |
| ~~P3~~ | ✅ **Durability score** — **done** (#59)            | M    | `assessDurability` blends aerobic decoupling (`hrDriftPct`) + late-run pace fade (`computeLateFadePct`) across recent endurance runs → 0–100 score + trend. Distinct from the forecast's `assessDurability` (that's race-distance support). Extends `get_physiology` + panel + Coach investigation. **Pillar 2 core (P1–P3) complete.**                    |
| ~~P4~~ | ✅ Threshold / economy estimation — **done** (#60)  | M    | `assessThresholdEconomy` estimates LT pace + HR (and % max HR) from tempo/threshold sessions, plus running economy as a grade-adjusted pace-per-HR (GAP-at-HR) trend. `computePhysiology` gains a `PhysiologyContext` (workout labels + max HR). Extends `get_physiology` + panel.                                                                         |
| ~~P5~~ | ✅ Condition normalization — **done** (#61)         | M    | `assessConditionNormalization` strips the heat tax (`weatherTempC`) from grade-adjusted pace so efficiency trends are apples-to-apples, and surfaces the run whose read most changes ("that 'bad' tempo reads +Xσ, not +Yσ, adjusted for 28°C"). Extends `get_physiology` + panel. **Pillar 2 complete (P1–P5).**                                          |

## Pillar 3 — Targeted improvement

| #      | Item                                       | Size | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~T1~~ | ✅ Capability radar — **done** (#62)       | M    | `lib/analytics/capabilityRadar.ts` scores six axes (aerobic base, threshold, top-end speed, durability, economy, consistency) 0–100 vs the athlete's OWN history (percentile of each signal's own trajectory), weights them by a per-distance demand profile, and auto-flags the biggest limiter (`demandImportance × (100 − score)`). `get_capability_radar` tool + recharts radar panel on Intelligence.                                                                               |
| ~~T2~~ | ✅ Per-limiter protocols — **done** (#63)  | M    | `lib/goals/limiterProtocols.ts` maps the radar's biggest limiter → a fixed training block, then reads the matching `goalScenarios` lever for the projected time, seconds gained, and probability (corroborated by `computeForecastSensitivity`). Logged via a new `limiter_protocol` recommendation-outcomes producer (volume-trend adherence) → closes diagnosis → prescription → predicted → measured. `get_limiter_protocols` tool + `/api/me/limiter-protocol` + Intelligence panel. |
| ~~T3~~ | ✅ Progression burn-downs — **done** (#64) | S    | `lib/analytics/burndown.ts` projects long run + weekly volume toward the race-distance targets (`RACE_READINESS_CONFIG`) by a dated deadline (race −3wk taper): current vs target, needed ramp vs recent rate, and weeks ahead/behind (or stalled). `get_progression_burndown` tool + Intelligence panel.                                                                                                                                                                                |

## Pillar 4 — Data-scientist rigor (cross-cutting)

| #      | Item                                            | Size | Notes                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~D1~~ | ✅ Uncertainty everywhere — **done** (#67)      | M    | Reusable seeded bootstrap primitive (`lib/analytics/bootstrap.ts`, `bootstrapCI`/`bootstrapMeanCI`) + `uncertaintyEstimates.ts` turning point metrics (aerobic efficiency, weekly volume, easy pace) into 90% CIs resampled from the athlete's own recent runs. `get_uncertainty` tool + Intelligence "current form · with intervals" panel. Sets up intervals-everywhere for future metrics. |
| ~~D2~~ | ✅ Change-point detection — **done** (#69)      | M    | `lib/analytics/changePoints.ts` scans the weekly CTL fitness trajectory (slope-delta + non-maximum suppression) for inflections — build took hold / peak → decline / ramp steepened / gains flattened — each dated with a plain reading. `get_change_points` tool + Intelligence change-points panel. **Pillar 4 complete (D1–D5); Deep-Analysis Roadmap complete.**                          |
| ~~D3~~ | ✅ Anomaly detection — **done** (#66)           | S–M  | `lib/analytics/anomalies.ts` flags D4's large-\|z\| sessions and attributes a likely cause from per-run signals vs athlete baselines — heat (`weatherTempC`), terrain (elev/km), fatigue (preceding-3-day km) — else "unexplained". `get_anomalies` tool + Intelligence anomalies panel. Reuses D4's z-scores.                                                                                |
| ~~D4~~ | ✅ Personal z-scores — **done** (#65)           | S    | `lib/analytics/personalZScores.ts` scores each session against the athlete's OWN per-workout-type distribution (grade-adjusted pace + pace/HR efficiency, oriented so higher σ = better), with cohort size + confidence; surfaces standout best/worst recent sessions. `get_session_zscores` tool + Intelligence standout-sessions panel. The primitive D3/D5 reuse.                          |
| ~~D5~~ | ✅ Honest correlation explorer — **done** (#68) | M    | `lib/analytics/correlations.ts` computes Pearson r over curated per-run pairs (cadence↔efficiency, prior-week load↔efficiency/pace, temp↔pace) with n, conservative strength, and per-finding + standing "association-not-causation" caveats; suppresses n<8 pairs. `get_correlations` tool + Intelligence correlation-explorer panel.                                                        |

## Cross-cutting UX

**"Explain this number" everywhere** — every score, prediction, and recommendation clicks through to its derivation, the exact data points used, the formula, and the confidence.

## Data dependencies to confirm

Some elite metrics need richer inputs than the CSV path: cadence / vertical oscillation / power streams (P4, running economy), reliable `weatherTempC` (P5), and — if ever importable — sleep/HRV (D5). Worth auditing what's actually synced before committing to stream-heavy items.

## Recommended sequence

**G1 → G3 → G4 → G2 → G5** (build out the forecaster's transparency, then its self-audit) → **P1/P3 + T1** (elite physiology feeding a capability radar) → the D-series rigor layer woven in as each surface is built.
