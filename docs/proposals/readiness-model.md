# Proposal — Readiness model: gap-aware load + detraining

**Status:** P1–P3 shipped · **Remaining:** the ~12 absolute TSB thresholds (see "Scope changed by measurement"), and P4 · **Evidence:** measured on the live 73-run account, 2026-08-04

Today the app tells an athlete who has not run in 11 days that they are **"FRESH · Freshness 100 · TSB +90 · freshness supports a quality session window"**. That is the opposite of true. Two independent defects combine to produce it.

## Defect 1: gap weeks are invisible to the load model

`weeklyLoadSeries()` builds a `Map` keyed by week and only ever writes keys for weeks **that contain runs** (`lib/analytics/fatigue.ts`). There is no gap filling, so `acuteChronicLoad()`'s exponential average never sees a zero-load week: a layoff does not decay CTL or ATL, it simply is not in the series.

Measured on the live account (last run 2026-07-24, 11 days before):

|                                  |     CTL | ATL |     TSB |
| -------------------------------- | ------: | --: | ------: |
| As shipped                       | **140** |  50 | **+90** |
| With zero-weeks filled (9 added) |  **57** |   0 |     +57 |

CTL is inflated **2.5×**. This is not only an end-of-history artefact: the athlete's series contains interleaved empty weeks (`Jun 29: 0 … Jul 27: 0, Aug 3: 0`), so chronic fitness has been overstated for any athlete who takes weeks off.

Separately, `atlTauWeeks = 1` gives `alphaAtl = 2 / (1 + 1) = 1.0`, so **ATL has no memory at all** — it is identically "this week's load". Acute load cannot accumulate across weeks, which is the one thing it exists to do.

## Defect 2: freshness is monotonic in TSB

`freshnessFromTsb()` maps `tsb > 10` to `min(100, 75 + min(25, tsb))`, so **any TSB ≥ 35 pins freshness to 100 forever**, and `restDaysSinceLastRun` only ever _adds_ freshness (+10 when Fatigued, +5 when Neutral). Rest is modelled as purely restorative. Nothing in `lib/analytics` represents detraining; the concept does not exist in the codebase.

Physiologically, readiness against TSB is an inverted U: peak race form sits at a modest positive balance, and sustained high positive balance means detrained, not sharp.

## What the obvious fix gets wrong

The tempting normalisation is a **form ratio**, `TSB / CTL`, which is unit-free and self-scaling. I modelled it on the real data before proposing it, and it fails:

```
2026-07-13  CTL 15  ATL  6  TSB   9   TSB/CTL  0.62   -> curve says "Rusty"   (athlete ran that day)
2026-08-04  CTL 11  ATL  1  TSB  10   TSB/CTL  0.91   -> curve says "Detrained" (correct)
```

Jul 13 was a **training day mid-block**, and the ratio called it rusty. The reason is structural: when training is sporadic CTL is small, so any positive TSB produces a large ratio. The ratio is unstable exactly for the athletes this feature is meant to protect. It cannot be the primary signal.

## Proposed design: two axes, not one curve

Balance and currency are different questions and should be modelled separately.

**Axis A — balance** (how loaded are you, right now): TSB-driven, as today, but computed on a load model that actually decays. Answers Fatigued / Neutral / Fresh.

**Axis B — currency** (is this data still about you): driven by directly observable facts, not by TSB. Two inputs:

1. `daysSinceLastRun`
2. 28-day volume as a fraction of the athlete's own 12-week median volume

Axis B **caps** freshness and may **override** the label. Axis A alone can never claim freshness that Axis B has not earned.

### Currency thresholds

Chosen from detraining literature (measurable aerobic decline begins around 1–2 weeks of inactivity, becomes material by 3–4) and expressed against the athlete's own baseline so they personalise:

| Days since last run | State     | Freshness cap | Label         |
| ------------------- | --------- | ------------: | ------------- |
| 0–3                 | current   |          none | Axis A        |
| 4–7                 | light gap |            85 | Axis A        |
| 8–14                | rusty     |            65 | **Rusty**     |
| 15–28               | detrained |            50 | **Detrained** |
| > 28                | returning |            40 | **Returning** |

Plus a volume gate: if 28-day volume is below ~40% of the 12-week median, apply the _rusty_ cap even when a recent run exists, so a token run every six days cannot mask a collapse in training.

### The guarantee worth stating

> An athlete with no recent training can never be labelled **Fresh**, and can never unlock a quality session on freshness grounds.

That single sentence is what the current model violates, and it is directly testable.

## Load model changes

1. **Zero-fill the weekly series** from the first run through the _current_ week, so gaps materialise and the EWMA decays.
2. **Give ATL memory**: `atlTauWeeks` 1 → 2 (`alpha` 1.0 → 0.667).
3. **Keep weekly granularity.** A daily model (standard 42/7-day EWMA) is more correct and I modelled it (CTL 11.0, ATL 0.9 today), but it renormalises every magnitude by roughly 1/7 and `loadHistory` is consumed as weekly points by charts and by `WeeklyLoadLite` in the feel calibration. Weekly keeps that contract. Daily is recorded here as the eventual destination, not this change.

## Blast radius

The magnitudes move whichever option is chosen (CTL 140 → 57 with gap-filling alone), so absolute thresholds must be audited. They are enumerable:

- **`fatigue.label` string comparisons — 7 logic sites**, all in `lib/training/viewModels.ts` (lines 143, 149, 152, 235, 236, 250, 253) plus 3 internal to `fatigue.ts`. Roughly 47 further sites merely render the label and are safe.
- **Absolute TSB thresholds — ~12 sites**: `lib/home/dashboardData.ts` (−15, −25), `lib/home/panelCopy.ts` (−25), `lib/goals/viewModels.ts` (−10, −12, −15), `lib/forecasting-v2/freshnessModel.ts` (+8, +20, −12).
- **`lib/forecasting-v2/freshnessModel.ts` is a second, independent freshness model** with its own thresholds. It should consume the shared one rather than drift separately; worth folding in here.
- `WeeklyLoadLite` (`lib/wellness/calibration.ts`) reads weekly `ctl`/`atl` and keeps working under the weekly option.

### Type change

Widen the label union to include `Rusty | Detrained | Returning` and add a structured field rather than overloading the string:

```ts
readiness: {
  balance: "fatigued" | "neutral" | "fresh"; // axis A
  currency: "current" | "light-gap" | "rusty" | "detrained" | "returning"; // axis B
  freshness: number; // after cap
  label: string; // display, derived from both
}
```

Keeping `label` as the display string means the ~47 render sites need no change; the 7 logic sites migrate to `readiness.balance`/`currency`, which is what they actually meant.

## Invariants to test

These are the failures expressed as properties, and they would have caught today's bug:

1. CTL strictly decreases across a zero-load week.
2. ATL decreases across a zero-load week (fails today, because `alpha = 1.0`).
3. `label !== "Fresh"` whenever `daysSinceLastRun >= 8`.
4. `freshness <= cap(daysSinceLastRun)` for every bucket.
5. **Non-monotonicity**: a very high TSB with no recent load scores _lower_ than a moderate TSB with recent load.
6. Freshness is unchanged for an athlete training consistently (no regression for the normal case).

Synthetic fixtures replicate the live pattern (a 3-week block, then an 11-day gap); the real account cannot be committed.

## Phasing

| Phase             | Scope                                                                         | Est.     |
| ----------------- | ----------------------------------------------------------------------------- | -------- |
| **P1** ✅         | Load model: zero-fill + ATL memory, with invariants 1–2.                      | ~0.5 day |
| **P2** ✅         | Currency axis + caps + new labels, invariants 3–6, migrate the 7 logic sites. | ~1 day   |
| **P3** ✅         | Give `forecasting-v2/freshnessModel` the shared currency signal.              | ~0.5 day |
| **P4** (optional) | Daily internal model, weekly-aggregated `loadHistory` for chart consumers.    | ~1 day   |

P1 and P2 shipped together: the load fix is meaningless while interpretation stays monotonic, and interpretation is untrustworthy while CTL is inflated 2.5×.

### Scope changed by measurement

**P1 did not recalibrate the ~12 absolute thresholds.** Comparing old and new parameters on identical series showed steady state stays at TSB 0 and every threshold still fires in the same qualitative case (a hard week moves −72 to −38, a missed week +214 to +114), so rescaling would have been an unrequested behavioural change needing its own calibration. It remains open as follow-up.

**P3 did not merge the two models.** The race forecast's `assessFreshness` keeps its own scoring, because it answers a different question (what does this do to a predicted finish time) and folding it in would have meant reworking the four models that consume its `label`. Instead it now receives `currency` and honours the same guarantee: stale training can never read as `fresh`, and it charges time rather than granting sharpness (+45 s rusty, +100 s detrained, +160 s returning). Its old `tsb > 20` "confirm taper vs detraining" guess now only fires when no currency was supplied.

## Risks

- **Numbers visibly change.** CTL 140 → 57 on the live account. This is a correction, but anyone who has watched their CTL climb will see it drop; worth a one-line note in the UI the first time.
- **Threshold recalibration is the real work**, not the model change. The ~12 absolute comparisons were tuned against inflated magnitudes.
- **Detraining thresholds are heuristic.** They are defensible from literature but not personalised beyond the volume baseline; the leg-feel calibration ladder is the precedent for tightening them against outcomes later.
- **Under-claiming freshness** is the safe failure direction, matching the leg-feel guardrail: the model may tell a genuinely sharp athlete to be cautious, never the reverse.
