import type { FatigueSnapshot } from "@/lib/analytics/fatigue";

/**
 * Keeps generated insights consistent with the athlete's current state.
 *
 * Insight generators each look at one slice of the data, so they can assert
 * things the rest of the state contradicts. Observed on the live account after
 * 10 days without a run: "Efficiency has dipped: fatigue or heat may be
 * compressing aerobic returns" (fatigue cannot compress returns from training
 * that did not happen) alongside "Threshold-style sessions are appearing
 * regularly" (nothing had happened in ten days).
 *
 * The approach is to gate at the point of generation rather than pattern-match
 * the prose afterwards: the generator knows what its claim assumes, a regex over
 * generated text does not. See docs/proposals/readiness-model.md for the
 * currency states these read.
 */

/**
 * Whether training is recent enough to support present-tense claims about it
 * ("sessions are appearing", "fatigue is compressing") and fatigue attribution.
 */
export function isTrainingCurrent(fatigue: Pick<FatigueSnapshot, "readiness">): boolean {
  const c = fatigue.readiness?.currency;
  return c === undefined || c === "current" || c === "light-gap";
}

/** Human phrase for the gap, for copy that needs to name it. */
export function stalenessClause(fatigue: Pick<FatigueSnapshot, "restDaysSinceLastRun">): string {
  const d = fatigue.restDaysSinceLastRun;
  if (d == null) return "an extended gap";
  return `${d} day${d === 1 ? "" : "s"} without a run`;
}

/**
 * Drop repeats of the same sentence across slots that render together.
 *
 * On Home one string could fill the hero's "Why this", a Risks bullet and the
 * Primary action at once, which reads as three findings when it is one.
 * Comparison is on normalised text, so trailing punctuation or case differences
 * do not smuggle a duplicate through.
 */
export function dedupeByText<T>(items: T[], getText: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = normalise(getText(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** True when `text` repeats something already shown, by the same normalisation. */
export function alreadyStated(text: string, shown: string[]): boolean {
  const key = normalise(text);
  return key.length > 0 && shown.some((s) => normalise(s) === key);
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
