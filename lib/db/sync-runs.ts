import { getSql } from "./client";

/**
 * Where the last successful sync got to, as a Unix timestamp.
 *
 * `last_after` had been written by every sync run since migration 001 and read by
 * nothing — no caller passed `afterEpochSec` — so each sync re-fetched the athlete's
 * entire history, up to the 5000-activity page cap, every time.
 *
 * Returns null when there is no completed run to resume from, which is the correct
 * signal for "fetch everything".
 */
export async function getLastSyncCursor(userId: string): Promise<number | null> {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT last_after FROM sync_runs
      WHERE user_id = ${userId}::uuid
        AND status = 'completed'
        AND last_after IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    const value = (rows[0] as { last_after: string | number } | undefined)?.last_after;
    if (value == null) return null;
    // BIGINT arrives as a string from the driver.
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    // A cursor lookup failure must degrade to a full sync, never fail the sync.
    return null;
  }
}

export async function startSyncRun(userId: string): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO sync_runs (user_id, status)
    VALUES (${userId}::uuid, 'running')
    RETURNING id
  `;
  return (rows[0] as { id: string }).id;
}

export async function finishSyncRun(
  syncId: string,
  status: "completed" | "failed",
  activitiesSynced: number,
  lastAfter: number | null,
  error?: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE sync_runs SET
      status = ${status},
      activities_synced = ${activitiesSynced},
      last_after = ${lastAfter},
      error = ${error ?? null},
      finished_at = NOW()
    WHERE id = ${syncId}::uuid
  `;
}
