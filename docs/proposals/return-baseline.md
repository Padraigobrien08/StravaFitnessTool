# Return-to-running baseline

**Status:** proposed, not built
**Measured with:** `scripts/measure-return-baseline.mts` (offline, read-only)

## What prompted this

The comeback card tells the live account it is rebuilding toward an **11.1 km
week**, reached in **~5 weeks**. The same athlete's history contains a 138.2 km
four-week block, a 158 km month, a 1:35 half marathon, and a 21.3 km trail race
17 days before the gap. A single run in that history is nearly twice the
"usual week" the card names.

The obvious reading is that `preGapBaseline` samples the wrong window: it takes
the median of the four weeks immediately before the gap, and those are
systematically the least representative weeks in a history, because people wind
down before they stop.

That reading is wrong, or at least incomplete. Measuring it changed the
proposal.

## What was measured

Every gap of ≥7 days in the athlete's history, scored against what they
actually came back to — the median weekly volume in the six weeks after the
gap, dropping the first week because it is a ramp by definition. Candidates are
computed only from data strictly before the gap.

Seven gaps were scorable. Three were skipped for insufficient pre-gap history
and three because the return is still in progress.

| gap start  | gap | **truth** | shipped | zerofill-4wk | med-12wk | p75-12wk | best4wk-26 |
| ---------- | --- | --------- | ------- | ------------ | -------- | -------- | ---------- |
| 2025-12-20 | 32d | **13.7**  | 11.2    | 10.9         | 8.1      | 13.1     | 10.2       |
| 2026-01-24 | 7d  | **18.1**  | —       | 0            | 4.8      | 11.2     | 9.5        |
| 2026-02-14 | 7d  | **18.1**  | 17.0    | 12.5         | 7.2      | 17.0     | 13.3       |
| 2026-02-25 | 10d | **26.9**  | 17.0    | 15.4         | 13.6     | 17.0     | 17.1       |
| 2026-03-25 | 7d  | **38.2**  | 25.1    | 17.1         | 15.4     | 25.1     | 17.5       |
| 2026-05-31 | 13d | **11.0**  | 36.8    | 31.8         | 36.1     | 42.5     | 41.8       |
| 2026-06-13 | 7d  | **11.0**  | 23.1    | 22.1         | 33.7     | 40.8     | 39.2       |

Median |log(estimate/truth)|, lower is better:

| candidate                                                    | err       | median est/truth | ≥2× under | ≥2× over |
| ------------------------------------------------------------ | --------- | ---------------- | --------- | -------- |
| **shipped** (median of 4 pre-gap weeks, empty weeks omitted) | **0.439** | 0.82             | 1         | 2        |
| p75 of 12 pre-gap weeks, zero-filled                         | 0.459     | 0.94             | 0         | 2        |
| median of 4 pre-gap weeks, zero-filled                       | 0.628     | 0.69             | 2         | 2        |
| best sustained 4-week average in 26 weeks                    | 0.645     | 0.74             | 1         | 2        |
| max(recent, 80% of best block)                               | 0.804     | 0.69             | 2         | 2        |
| 80% of best sustained 4-week average                         | 0.868     | 0.59             | 2         | 2        |
| median of 12 pre-gap weeks, zero-filled                      | 0.922     | 0.51             | 3         | 2        |

## What the measurement says

**1. The redesign I was about to propose is worse than what ships.** Anchoring
to the best sustained block — the intuitive fix for "the baseline is too low" —
scores 0.645 against the shipped 0.439. Taking the higher of recent and best,
which was the instinct going in, is second-worst at 0.804. The shipped
estimator wins this comparison.

**2. The error changes sign with training phase, and no backward-looking
statistic can see it coming.** Before March every candidate _understates_ the
return: the athlete was building, so they came back to more than any backward
window could know. After the May half marathon every candidate _overstates_ it
by 2–4×: they raced their goal and wound down. The 2026-05-31 gap starts on the
day of Cork Half; truth is 11 km/wk and the estimates range 22–42.

Nothing in pre-gap volume predicts that. The race predicts it, and the athlete's
intention predicts it, but volume history does not.

**3. Every candidate is wrong by ≥2× in at least two of seven cases, in both
directions.** That is the robust finding. The ranking between the top two is
not — at n=7 from one athlete, 0.439 vs 0.459 is noise.

**4. The live 11.1 km is not actually an error.** The athlete really was
averaging about that in the weeks before this gap: they wound down after May.
As a description of what they were doing, it is correct. The defect is that the
card labels it **"YOUR USUAL WEEK"** and derives **"BACK TO USUAL ~5 wks"** from
it — presenting a backward-looking description as a forward-looking target,
with a confident timeline attached.

## Proposal

Do not replace the estimator. Change what is claimed about it.

### P1 — Say what the number is

`preGapBaseline` measures what the athlete was running before the gap. Label it
that way. "Your usual week" is a claim about their normal training; "before the
gap" is a claim about the four weeks it actually sampled, and is always true.

- `YOUR USUAL WEEK 11.1 km` → `BEFORE THE GAP 11.1 km/wk`
- `BACK TO USUAL ~5 wks` → drop, or restate against the chosen target (P2)

Cheap, removes the false claim, and does not depend on any of the modelling
questions below.

### P2 — Let the athlete set the target

The one thing the model cannot infer — _am I rebuilding toward what I was
doing, or was that a planned wind-down after a goal race_ — the athlete knows
immediately. The comeback card should offer the target rather than assert it:

- **Back to before the gap** (11.1 km/wk) — default when the pre-gap weeks look
  like steady training
- **Back to my best block** (34.5 km/wk, Apr 3 – May 1) — offered whenever the
  best block materially exceeds the pre-gap weeks, which is exactly the case
  the measurement shows a model cannot resolve on its own
- **Something else** — a number they type

The ramp shape (≈10%/week, quality withheld for 1–3 weeks by gap length) is
independent of the target level and is not in question here; only the endpoint
changes. `weeksToBaseline` becomes a function of the chosen target and can then
be stated honestly, because the athlete picked the destination.

### P3 — Fix the zero-fill defect regardless

`preGapBaseline` builds `byWeek` only from weeks that contain runs, so a
four-week window with running in two of them takes a median over two values.
This is the same defect fixed in `weeklyLoadSeries` during the readiness work,
where gap weeks were not decaying CTL/ATL because they were absent rather than
zero. `preGapBaseline` never got the same treatment.

**Correction to an earlier draft of this document.** It claimed the 2026-02-14
gap showed a 36% inflation, 17.0 against 12.5. That was wrong: 12.5 came from
the measurement script's `zerofilled-4wk` candidate, which also uses a different
median convention (mean of the two middle values rather than the upper one).
Two changes were conflated into one number.

Checked properly, zero-filling changes **nothing** on any of the eleven gaps on
file. With four buckets the two conventions agree unless two or more weeks are
empty, and no gap here has that. So the `zerofilled-4wk` row in the scoring
table above measures the median convention, not this fix, and no accuracy claim
should be read from it either way.

Fix it regardless: a median over "the weeks you ran" is not the statistic the
name claims, and the athletes it will eventually bite are exactly the ones this
module serves — people running sparsely in the weeks before they stop. It is a
latent correctness fix with no visible effect today, which is why it needs a
test rather than a screenshot.

### Also worth noting

`preGapBaseline` returns `null` more often than expected — the 2026-01-24 gap
has fewer than three runs in the sampling window, so the card degrades to
generic advice for an athlete with eight months of history. Widening the sample
window when the four-week one is too sparse is a small, separate improvement.

## What would actually validate this

n=7 from one athlete cannot rank estimators. What would:

- **More athletes.** The phase-dependence finding (build → understate, post-race
  → overstate) needs to hold across people, not just across one person's year.
- **Race dates as a feature.** The clearest signal in this data is that a gap
  beginning on race day behaves completely differently from one beginning
  mid-block. The app already knows race goals; the model does not use them here.
- **The athlete's own answer as ground truth.** If P2 ships, what people pick
  when offered the choice is a far better label than anything inferred — and it
  is the cheapest labelled data this app could collect.

## Rejected

- **Anchor to the best sustained block.** Measured worse (0.645 vs 0.439) and
  would have pushed a 3× harder target onto an athlete who deliberately wound
  down after a goal race.
- **max(recent, 80% of best block).** The instinct going in; second-worst at
  0.804. It picks up the overstating failure mode without fixing the
  understating one.
- **Tune the window length.** p75 over 12 weeks is within noise of the shipped
  estimator. Both are wrong by ≥2× on the same two post-race cases, so window
  choice is not where the error lives.
