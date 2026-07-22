import { getSql } from "./client";

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
