import { getSql } from "./client";
import type { TrainingCalendarWeek } from "@/lib/training-calendar/types";

let ensured = false;

/** Creates the calendar table if migration 004 was not applied yet. */
export async function ensureTrainingCalendarSchema(): Promise<void> {
  if (ensured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS training_calendar_weeks (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start DATE NOT NULL,
      week JSONB NOT NULL,
      revision INT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, week_start)
    )
  `;
  ensured = true;
}

/** All saved weeks for a user, oldest first. Never throws — returns [] if the DB is unavailable. */
export async function getSavedWeeks(userId: string): Promise<TrainingCalendarWeek[]> {
  try {
    await ensureTrainingCalendarSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT week FROM training_calendar_weeks
      WHERE user_id = ${userId}::uuid
      ORDER BY week_start
    `;
    // jsonb columns are parsed back to objects by the client for both drivers.
    return rows.map((r) => (r as { week: TrainingCalendarWeek }).week);
  } catch {
    return [];
  }
}

export async function upsertSavedWeek(userId: string, week: TrainingCalendarWeek): Promise<void> {
  await ensureTrainingCalendarSchema();
  const sql = getSql();
  await sql`
    INSERT INTO training_calendar_weeks (user_id, week_start, week, revision, updated_at)
    VALUES (
      ${userId}::uuid,
      ${week.weekStart}::date,
      ${JSON.stringify(week)}::jsonb,
      ${week.revision ?? 1},
      NOW()
    )
    ON CONFLICT (user_id, week_start) DO UPDATE SET
      week = EXCLUDED.week,
      revision = EXCLUDED.revision,
      updated_at = NOW()
  `;
}

export async function deleteSavedWeek(userId: string, weekStart: string): Promise<void> {
  await ensureTrainingCalendarSchema();
  const sql = getSql();
  await sql`
    DELETE FROM training_calendar_weeks
    WHERE user_id = ${userId}::uuid AND week_start = ${weekStart}::date
  `;
}
