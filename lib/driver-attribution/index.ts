/**
 * Which signals plausibly account for a state, and how sure we are.
 *
 * This was called `causal-reasoning`, which promised a method it does not implement.
 * What it does is threshold-based attribution: a `switch` over the thing being explained,
 * a set of rules mapping analytics values to named drivers, and a confidence per driver.
 * There is no DAG, no counterfactual, and no adjustment for confounding — so a driver
 * here is something that moved alongside the outcome, not something shown to have caused
 * it. Two variables that always move together are indistinguishable to it.
 *
 * The output has always been honest: "appears influenced primarily by …", per-driver
 * confidence, and explicit uncertainties, all of which survive into the Coach context.
 * The name was the part that overclaimed, to anyone reading the directory listing and
 * expecting inference machinery. Renamed rather than explained away, because a comment
 * saying "this is not really causal" under a folder called `causal-reasoning` loses.
 *
 * Recorded in docs/LIMITATIONS.md, which is the version a reader outside the repo sees.
 */
export type {
  DriverAttribution,
  AttributedDriver,
  AttributionTarget,
  DriverImpact,
  DriverConfidence,
} from "./types";

export { inferLikelyDrivers } from "./inferLikelyDrivers";
export { buildAttributionNarrative } from "./buildAttributionNarrative";
