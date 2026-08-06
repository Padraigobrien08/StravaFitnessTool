/**
 * Bounds on how much Strava API quota a single request may spend.
 *
 * Strava enforces a per-application rate limit, so these are shared across every
 * athlete using this deployment — one caller asking for a hundred thousand streams
 * does not just slow themselves down, it exhausts the quota for everyone and the app
 * starts returning 429s until the window resets.
 *
 * Kept in their own module so the sync routes and the sync functions agree on one
 * number rather than each carrying a literal.
 */

/** Streams fetched per sync when the caller does not say. */
export const DEFAULT_STREAM_RUNS_PER_SYNC = 40;

/**
 * Hard ceiling per request. Well above the default so a genuine backfill still works
 * in a few passes, well below the point where one request can drain the daily quota.
 */
export const MAX_STREAM_RUNS_PER_SYNC = 200;
