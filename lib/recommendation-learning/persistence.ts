import {
  getTrackedOutcomesForUser,
  saveTrackedOutcomes,
} from "@/lib/db/recommendation-outcome-log";
import { getTrackedOutcomes, hydrateOutcomeStore } from "./trackRecommendationOutcome";

/**
 * Database bridge for the learning loop's working set.
 *
 * `buildAdaptiveIntelligence` is synchronous and is called from the browser as well as
 * the server, so the store itself stays an in-process Map. Server callers wrap the
 * build in these two awaits, which is what lets a recommendation issued in one request
 * be judged in a later one — the thing the loop could not previously do.
 *
 * Both are best-effort. A learning-loop failure must never take down the plan, the
 * Coach reply or the page that was being built, so anything thrown here is swallowed:
 * the worst case is that the loop does not close this time round, which is exactly the
 * behaviour before persistence existed.
 */

/** Load a user's stored outcomes into the working set. Safe to call on every request. */
export async function hydrateOutcomesForUser(userId: string): Promise<void> {
  try {
    const stored = await getTrackedOutcomesForUser(userId);
    if (stored.length > 0) hydrateOutcomeStore(userId, stored);
  } catch {
    /* best effort — an empty working set simply means nothing to judge yet */
  }
}

/** Write the working set back. Call after the adaptive build has tracked/judged. */
export async function persistOutcomesForUser(userId: string): Promise<void> {
  try {
    const outcomes = getTrackedOutcomes(userId);
    if (outcomes.length > 0) await saveTrackedOutcomes(userId, outcomes);
  } catch {
    /* best effort — losing a write costs one cycle of learning, not the request */
  }
}
