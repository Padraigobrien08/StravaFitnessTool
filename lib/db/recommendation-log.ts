import { getSql } from "./client";
import type { LoggedRecommendation } from "@/lib/recommendation-outcomes/types";

let ensured = false;

/** Creates the recommendation log table if migration 005 was not applied yet. */
export async function ensureRecommendationLogSchema(): Promise<void> {
  if (ensured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS recommendation_log (
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

/** Record a recommendation at generation time. First write wins (idempotent). */
export async function logRecommendation(userId: string, rec: LoggedRecommendation): Promise<void> {
  await ensureRecommendationLogSchema();
  const sql = getSql();
  await sql`
    INSERT INTO recommendation_log (user_id, recommendation_id, record, issued_at, updated_at)
    VALUES (${userId}::uuid, ${rec.recommendationId}, ${JSON.stringify(rec)}::jsonb, NOW(), NOW())
    ON CONFLICT (user_id, recommendation_id) DO NOTHING
  `;
}

/** All logged recommendations for a user, newest first. Returns [] on DB failure. */
export async function getRecommendations(userId: string): Promise<LoggedRecommendation[]> {
  try {
    await ensureRecommendationLogSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT record FROM recommendation_log
      WHERE user_id = ${userId}::uuid
      ORDER BY issued_at DESC
    `;
    return rows.map((r) => (r as { record: LoggedRecommendation }).record);
  } catch {
    return [];
  }
}

/** Write back an evaluated recommendation (adherence fields filled). */
export async function saveEvaluation(userId: string, rec: LoggedRecommendation): Promise<void> {
  await ensureRecommendationLogSchema();
  const sql = getSql();
  await sql`
    INSERT INTO recommendation_log (user_id, recommendation_id, record, updated_at)
    VALUES (${userId}::uuid, ${rec.recommendationId}, ${JSON.stringify(rec)}::jsonb, NOW())
    ON CONFLICT (user_id, recommendation_id) DO UPDATE SET
      record = EXCLUDED.record,
      updated_at = NOW()
  `;
}
