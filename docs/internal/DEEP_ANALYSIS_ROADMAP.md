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
| P4     | Threshold / economy estimation                      | M    | LT pace from tempo/threshold + HR deflection; running economy as GAP-at-HR trend (elevate existing aerobic efficiency).                                                                                                                                                                                                                                    |
| P5     | Condition normalization                             | M    | Heat (uses `weatherTempC`) + GAP normalization so trends are apples-to-apples ("that 'bad' tempo was +2σ adjusted for 28°C").                                                                                                                                                                                                                              |

## Pillar 3 — Targeted improvement

| #   | Item                   | Size | Notes                                                                                                                                                                                  |
| --- | ---------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Capability radar       | M    | Aerobic base, threshold, top-end speed, durability, economy, consistency — scored vs the athlete's own history AND the goal's demand profile; biggest limiter auto-flagged.            |
| T2  | Per-limiter protocols  | M    | "Top-end lags threshold → 6-week strides/VO2 block; projected 5k −Xs (prob Y%)" via `goalScenarios`. Closes diagnosis → prescription → predicted → measured (recommendation-outcomes). |
| T3  | Progression burn-downs | S    | "Long run → 32 km by W-6; 1 week behind" with a target line.                                                                                                                           |

## Pillar 4 — Data-scientist rigor (cross-cutting)

| #   | Item                        | Size | Notes                                                                                                                                     |
| --- | --------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Uncertainty everywhere      | M    | Intervals not points; distributions via bootstrap resampling of the athlete's own runs.                                                   |
| D2  | Change-point detection      | M    | Auto-find fitness-trajectory slope changes (a block that worked, an injury); annotate the timeline + phase catalog.                       |
| D3  | Anomaly detection           | S–M  | Runs that don't fit the personal model, flagged with a likely cause (heat, terrain, fatigue).                                             |
| D4  | Personal z-scores           | S    | Every session relative to the athlete's own distribution ("this tempo was +1.8σ").                                                        |
| D5  | Honest correlation explorer | M    | Personal correlations (efficiency vs cadence, performance vs prior-week load) with n/r + plain-English caveat; never overclaim causation. |

## Cross-cutting UX

**"Explain this number" everywhere** — every score, prediction, and recommendation clicks through to its derivation, the exact data points used, the formula, and the confidence.

## Data dependencies to confirm

Some elite metrics need richer inputs than the CSV path: cadence / vertical oscillation / power streams (P4, running economy), reliable `weatherTempC` (P5), and — if ever importable — sleep/HRV (D5). Worth auditing what's actually synced before committing to stream-heavy items.

## Recommended sequence

**G1 → G3 → G4 → G2 → G5** (build out the forecaster's transparency, then its self-audit) → **P1/P3 + T1** (elite physiology feeding a capability radar) → the D-series rigor layer woven in as each surface is built.
