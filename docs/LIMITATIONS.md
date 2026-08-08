# What is validated, and what is not

StrideIQ makes quantitative claims about training, so it owes you a straight answer about
which of them have been checked against reality. This page is that answer. It is not a
roadmap and not a bug list — [RELEASE_MVP.md](RELEASE_MVP.md) covers scope, and the issue
tracker covers defects. This is about **evidence**.

Five things are easy to conflate, and most software quietly does:

| Tier                        | Meaning                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| **Implemented**             | The code exists and runs                                         |
| **Unit-tested**             | Its logic is pinned by tests, on synthetic or fixture data       |
| **Integration-tested**      | It is exercised against a real dependency (a database, a parser) |
| **Externally exercised**    | It has run against the live third-party system it talks to       |
| **Proven in sustained use** | It has produced correct results over time, on real data          |

The suite is large — 1,822 tests, all green — but a passing test is tier two. Nothing below
is upgraded a tier because it is well covered.

---

## Race forecasting

**One real race has been scored, and the model was 7.5% out.**

`scripts/backtest-race-forecast.mts` replays a forecast as it would have stood the day before
a real race, using only data available then. Runs on or after race day are removed from the
input, so the model cannot see the result it is predicting. Against the one scoreable race on
file — a half marathon, actual **1:44:17**:

| Model                    | Predicted | Error      |
| ------------------------ | --------- | ---------- |
| Legacy consensus         | 2:14:58   | **+29.4%** |
| Forecasting V2 (current) | 1:52:05   | **+7.5%**  |

That backtest is why the legacy consensus is no longer used when no race goal is set
(`4c76e3d`). It found a real, live over-prediction rather than confirming a design.

**What this does not establish.** n = 1. One race cannot calibrate a forecaster, and 7.5%
on one half marathon says almost nothing about the next one, still less about another
distance. Treat the number as evidence the pipeline is not grossly broken, not as an
accuracy figure.

**The intervals are honesty floors, not calibrated intervals.** The band was originally
derived from how much the capability models disagreed with each other — which measures
consensus, not accuracy. They agreed closely while being 7.5% out, producing a ±1% band
around a wrong number. A minimum width is now applied as a share of predicted time, scaled by
confidence. That is a floor asserted to prevent false precision; it is not a distribution
fitted to observed error, and it should not be read as "80% of races land in here."

**The production calibration loop has no data.** `lib/forecasting-v2/calibration.ts` logs each
forecast and scores it when a real effort at that distance lands, reporting p10–p90 coverage
against an ideal of ~80%. The mechanism is implemented and unit-tested. It has not accumulated
enough scored forecasts to report a coverage number, and none is published here. **Do not read
the existence of a calibration module as evidence the forecaster is calibrated.**

**Known defect — result matching (DD-3).** Scoring picks the _earliest_ qualifying effort
after the issue date, guarded by rejecting anything slower than 15% below p90
(`RACE_ATTEMPT_MAX_SLOWDOWN_VS_P90`). That guard was added after the accuracy panel reported
the model 40 minutes optimistic because an easy 21 km three days after a forecast had been
scored as the race (`6d448fd`). The residual risk is real: a hard tempo at the target distance
can land inside the same 15% band and be recorded as the race. For an athlete who races rarely
but trains hard, this will bias calibration once data accumulates.

**Marathon predictions are extrapolated.** Comparable efforts are admitted between 4–22 km
(`isRaceLikeEffort`) and the personalised power-law is fitted over 3–30 km, but marathon times
come off the same curve — roughly double the observed range, which is exactly where Riegel is
known to break down. `durabilityModel` exists to reason about long-run support, but it does
not widen the headline consensus band.

**The confidence gate is evidence, not calibration.** It used to require R² > 0.9 on a log–log
fit of time against distance — axes that are near-collinear by construction, so almost any
effort set cleared it. Measured on the demo athlete, the old gate awarded **high** confidence
to a set polluted with easy running whose fitted exponent was 0.991, i.e. "pace never fades
with distance".

It now asks the two questions that bear on a prediction: how tightly the efforts sit on one
curve (residual SD in log space), and how well-pinned the extrapolated exponent is (its
standard error). The same polluted set now reports medium; the properly classified set, at
5.1% scatter with the exponent held to ±0.05, reports high.

The thresholds are still a floor on **evidence**, not a calibration against observed race
error — that would need scored races to set. The scatter bound is deliberately no tighter than
7%, because the one race ever scored came in 7.5% out, and claiming a tighter curve than the
only error ever measured would be inventing precision.

---

## Learning and adaptation

**The learning loop has never been observed closing.** Recommendations are logged, outcomes
evaluated, and beliefs updated (`lib/recommendation-learning/`). The seams are unit-tested.
A full cycle — recommendation issued, real training happens, outcome scored, belief updated —
has not been observed completing over a real 24-hour production window. Until it has, treat
"the system learns from your outcomes" as an implemented mechanism rather than a demonstrated
behaviour.

**"Causal reasoning" is attribution, not causal inference.** `lib/causal-reasoning/` maps
thresholds to named likely drivers with confidence levels and explicit uncertainties. There is
no DAG, no counterfactual, and no adjustment for confounding. The outputs are hedged
appropriately in the UI; the module name is more ambitious than the method.

---

## Physiology

Estimates are gated on sample size and return _nothing_ rather than a confident number when
data is thin — refusing to answer is the intended behaviour, not a gap.

**Threshold estimation is partly circular.** Lactate-threshold pace is the median pace of runs
classified as tempo, and the classifier itself uses pace among its signals. The result is
closer to "your typical tempo pace" than to a physiologically measured threshold. It is
labelled an estimate and requires ≥2 qualifying sessions, but 2 is a thin basis for a number
displayed beside Critical Speed.

**Critical Speed and D′** come from the standard two-parameter model fitted to the athlete's
own efforts. The model is well established; the fit quality depends entirely on how many
genuine maximal efforts of differing duration exist in the data, which for most recreational
runners is few.

---

## Integrations

**Webhooks have never run against a live Strava subscription.** Signature verification and
event handling are implemented and unit-tested, and the endpoint logs why it rejects. No
subscription has been registered and no real webhook delivery has been received. See
[DEPLOYMENT.md](DEPLOYMENT.md#webhooks-optional-auto-sync).

**AI weekly planning is OpenAI-only.** With only `ANTHROPIC_API_KEY` set, Coach chat works but
every generated plan silently becomes the deterministic fallback. `lib/env.ts` warns about
this at startup. Coach chat itself supports both providers.

**`STRIDEIQ_API_KEY_USER_ID` is set by hand and can go stale.** A fresh Strava OAuth creates a
new user row, leaving the variable pointing at a user with no data. The web UI is unaffected,
so nothing looks wrong, while the API-key path and the MCP package authenticate to an empty
account. `lib/env.ts` checks the variable is set, not that it resolves.

---

## Persistence

The ten suites in `lib/db/__tests__/` round-trip real SQL against a throwaway Postgres and run
in CI on every PR, so migrations, upserts, forecast logs and athlete memory are
integration-tested. They are **not** exercised against Neon specifically; the CI database is
stock `postgres:17`. Neon-specific behaviour — serverless connection handling, cold starts,
`sslmode=verify-full` — is covered only by unit tests and manual use.

---

## What this page is not

It does not list every rough edge. It lists the places where a reader could reasonably
conclude a number is more trustworthy than it is. If you find a claim in this repository that
outruns its evidence and is not written down here, that is a bug in this page.
