import type { DashboardInsights } from "@/lib/analytics";
import type { AthleteBelief, AthleteMemoryProfile } from "@/lib/athlete-memory/types";
import { buildAthleteMemoryProfile } from "@/lib/athlete-memory";
import { mergeProfileWithStored, type StoredBeliefMeta } from "@/lib/athlete-memory/persistMemory";
import { getSql } from "./client";

let ensured = false;

/** Creates the athlete-memory table if migration 006 was not applied yet. */
export async function ensureAthleteMemorySchema(): Promise<void> {
  if (ensured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS athlete_memory_beliefs (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      belief_id TEXT NOT NULL,
      belief JSONB NOT NULL,
      first_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      times_confirmed INT NOT NULL DEFAULT 1,
      last_confirmed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, belief_id)
    )
  `;
  ensured = true;
}

/** Stored belief history keyed by belief id. Returns an empty map on DB failure. */
export async function getStoredBeliefMeta(userId: string): Promise<Map<string, StoredBeliefMeta>> {
  try {
    await ensureAthleteMemorySchema();
    const sql = getSql();
    const rows = await sql`
      SELECT belief_id, first_observed, times_confirmed, last_confirmed
      FROM athlete_memory_beliefs
      WHERE user_id = ${userId}::uuid
    `;
    const map = new Map<string, StoredBeliefMeta>();
    for (const r of rows as {
      belief_id: string;
      first_observed: string;
      times_confirmed: number;
      last_confirmed: string;
    }[]) {
      map.set(r.belief_id, {
        beliefId: r.belief_id,
        firstObserved:
          typeof r.first_observed === "string"
            ? r.first_observed
            : new Date(r.first_observed).toISOString(),
        timesConfirmed: r.times_confirmed,
        lastConfirmed:
          typeof r.last_confirmed === "string"
            ? r.last_confirmed
            : new Date(r.last_confirmed).toISOString(),
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Persist merged beliefs; first_observed is preserved, times_confirmed advances. */
export async function upsertBeliefs(userId: string, beliefs: AthleteBelief[]): Promise<void> {
  if (beliefs.length === 0) return;
  await ensureAthleteMemorySchema();
  const sql = getSql();
  for (const b of beliefs) {
    await sql`
      INSERT INTO athlete_memory_beliefs
        (user_id, belief_id, belief, first_observed, times_confirmed, last_confirmed, updated_at)
      VALUES (
        ${userId}::uuid,
        ${b.id},
        ${JSON.stringify(b)}::jsonb,
        ${b.firstObserved ?? new Date().toISOString()}::timestamptz,
        ${b.timesConfirmed ?? 1},
        ${b.lastConfirmed ?? new Date().toISOString()}::timestamptz,
        NOW()
      )
      ON CONFLICT (user_id, belief_id) DO UPDATE SET
        belief = EXCLUDED.belief,
        first_observed = EXCLUDED.first_observed,
        times_confirmed = EXCLUDED.times_confirmed,
        last_confirmed = EXCLUDED.last_confirmed,
        updated_at = NOW()
    `;
  }
}

/**
 * Build the athlete-memory profile, merged with persisted belief history, and
 * write the merged beliefs back. Falls back to the ephemeral profile if the DB
 * is unavailable — memory always works, persistence is best-effort.
 */
export async function getPersistedAthleteMemory(
  userId: string,
  analytics: DashboardInsights | null,
  now: Date = new Date(),
): Promise<AthleteMemoryProfile> {
  const fresh = buildAthleteMemoryProfile(analytics, userId);
  const storedById = await getStoredBeliefMeta(userId);
  const { profile, toPersist } = mergeProfileWithStored(fresh, storedById, now.toISOString());
  try {
    await upsertBeliefs(userId, toPersist);
  } catch {
    /* non-fatal — return the merged profile even if the write fails */
  }
  return profile;
}
