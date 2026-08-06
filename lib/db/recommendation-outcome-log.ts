import { getSql } from "./client";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning/types";

let ensured = false;

/** Creates the outcome log table if migration 009 was not applied yet. */
export async function ensureRecommendationOutcomeLogSchema(): Promise<void> {
  if (ensured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS recommendation_outcome_log (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recommendation_id TEXT NOT NULL,
      record JSONB NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, recommendation_id)
    )
  `;
  ensured = true;
}

/**
 * A user's tracked outcomes, newest first.
 *
 * Returns `[]` on any database failure: the learning loop is an enhancement, and
 * losing it must never take down the surface that was being built.
 */
export async function getTrackedOutcomesForUser(
  userId: string,
  limit = 40,
): Promise<TrackedRecommendationOutcome[]> {
  try {
    await ensureRecommendationOutcomeLogSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT record FROM recommendation_outcome_log
      WHERE user_id = ${userId}::uuid
      ORDER BY issued_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => (r as { record: TrackedRecommendationOutcome }).record);
  } catch {
    return [];
  }
}

/**
 * Upsert tracked outcomes.
 *
 * `issued_at` is written from the record so ordering survives a re-save, and the row
 * is replaced wholesale on conflict — an outcome moving from pending to judged is the
 * normal update, and the newer record is always the more complete one.
 */
export async function saveTrackedOutcomes(
  userId: string,
  outcomes: TrackedRecommendationOutcome[],
): Promise<void> {
  if (outcomes.length === 0) return;
  await ensureRecommendationOutcomeLogSchema();
  const sql = getSql();
  for (const o of outcomes) {
    await sql`
      INSERT INTO recommendation_outcome_log
        (user_id, recommendation_id, record, issued_at, updated_at)
      VALUES (
        ${userId}::uuid,
        ${o.recommendationId},
        ${JSON.stringify(o)}::jsonb,
        ${o.issuedAt}::timestamptz,
        NOW()
      )
      ON CONFLICT (user_id, recommendation_id) DO UPDATE SET
        record = EXCLUDED.record,
        updated_at = NOW()
    `;
  }
}
