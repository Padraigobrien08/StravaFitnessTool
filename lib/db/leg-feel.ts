import { getSql } from "./client";
import type { LegFeelReport } from "@/lib/wellness/types";

let ensured = false;

/** Creates the leg-feel table if migration 008 was not applied yet. */
export async function ensureLegFeelSchema(): Promise<void> {
  if (ensured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS leg_feel_log (
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feel_date  DATE NOT NULL,
      report     JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, feel_date)
    )
  `;
  ensured = true;
}

/** Upsert a day's report (last write wins). */
export async function upsertLegFeel(
  userId: string,
  date: string,
  report: LegFeelReport,
): Promise<void> {
  await ensureLegFeelSchema();
  const sql = getSql();
  await sql`
    INSERT INTO leg_feel_log (user_id, feel_date, report, updated_at)
    VALUES (${userId}::uuid, ${date}::date, ${JSON.stringify(report)}::jsonb, NOW())
    ON CONFLICT (user_id, feel_date) DO UPDATE SET
      report = EXCLUDED.report,
      updated_at = NOW()
  `;
}

/** A single day's report, or null. Returns null on DB failure (graceful no-DB mode). */
export async function getLegFeel(userId: string, date: string): Promise<LegFeelReport | null> {
  try {
    await ensureLegFeelSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT report FROM leg_feel_log
      WHERE user_id = ${userId}::uuid AND feel_date = ${date}::date
      LIMIT 1
    `;
    const row = rows[0] as { report: LegFeelReport } | undefined;
    return row?.report ?? null;
  } catch {
    return null;
  }
}
