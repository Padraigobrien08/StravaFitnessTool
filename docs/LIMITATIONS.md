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

The suite is large — over 1,800 tests, all green — but a passing test is tier two. Nothing below
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

**Driver attribution is association, not causal inference.** `lib/driver-attribution/` maps
thresholds to named likely drivers with confidence levels and explicit uncertainties. There is
no DAG, no counterfactual, and no adjustment for confounding, so a driver it names moved
alongside the outcome rather than being shown to have produced it. The outputs have always
been hedged — "appears influenced primarily by …", per-driver confidence, stated uncertainties
— and those survive into the Coach context. The module was called `causal-reasoning` until
recently, which promised a method it does not implement; it was renamed rather than annotated,
since a comment disclaiming causality inside a folder named for it loses.

---

## Load and freshness

**Acute load is an average over weekly buckets, and the last bucket dominates it.** `ATL`
uses a two-week time constant over weekly totals, so roughly two thirds of the reading comes
from the most recent point. That makes freshness responsive, which is the intent, but it also
means a single unusual week moves it a long way.

**A weekly schedule that does not divide into seven aliases against the window.** An athlete
running every third day produces alternating 200/300 weeks, because seven days holds two runs
some weeks and three in others. Their freshness genuinely oscillates with that pattern rather
than with their training. Measured: a 29% heavier trailing week takes freshness from mid-range
to near zero.

**Freshness thresholds are absolute, not relative to the athlete.** `freshnessFromTsb` reads
TSB in raw load units — `39 + tsb` below −10, and fixed cut-points at ±10 — while TSB itself
scales with training volume. A high-volume athlete therefore reaches the extremes on ordinary
variation, where a low-volume one never would. The function is also discontinuous at those
cut-points: crossing −10 moves freshness eleven points for an arbitrarily small change in
balance.

These were surfaced while fixing a worse one: the current calendar week was fed into the
average as though it were complete, so acute load collapsed part-way through every week. For a
steady daily runner that produced a freshness reading of 100 on six days out of seven, correct
only on Sundays. The final point now covers the trailing seven days, which removes the
weekday artifact; the three limitations above are what remains, and are unfixed.

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
every generated plan silently becomes the deterministic fallback. `lib/env/index.ts` warns about
this at startup. Coach chat itself supports both providers.

**AI weekly planning reached the model for the first time recently, and has one verified
run.** The strict JSON schema sent to OpenAI omitted five properties from its `required`
lists, which strict structured outputs rejects outright. Every request returned 400, the error
was discarded by a bare `catch`, and the deterministic fallback was served in its place — so
every AI plan ever generated was rule-based, while the only symptom was a plan describing
itself as a fallback. Fixed, and confirmed by a live call returning a real plan.

What that establishes is narrow: one successful generation against the demo athlete. The
schema contract is now unit-tested in both directions, but a test cannot prove the API
_accepts_ the schema — only a live request does, and CI makes none. If the structured-output
rules change, CI stays green and planning silently reverts to fallback. The failure is now at
least logged (`plan.llm_call_failed`) rather than swallowed.

**`STRIDEIQ_API_KEY_USER_ID` is set by hand and can go stale.** A fresh Strava OAuth creates a
new user row, leaving the variable pointing at a user with no data. The web UI is unaffected,
because a browser session carries its own id, so nothing looks wrong — while the API-key path
and the MCP package authenticate successfully to an empty account and answer "no data" to
every question. Authenticating as an empty account is worse than failing to authenticate: a
401 is a bug report, an empty answer is a wrong one.

`lib/env/index.ts` can only check the variable is _set_, since it is pure by design.
`lib/env/apiKeyUser.ts` now resolves it against the database at boot and on `/api/health`
(`api_key.ok`, `features.automation`). What that does **not** do is re-check per request: a
deployment that goes stale after boot keeps serving empty answers until something restarts or
someone loads the health probe.

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
