import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hasTestDb } from "./testDatabase";
import { getSql } from "../client";
import { buildStravaImportFromDb, upsertActivities } from "../activities";
import type { StravaActivity } from "@/lib/strava/api/types";

/**
 * The activity write path — every synced session lands here, and everything
 * downstream reads what it wrote.
 *
 * Two properties carry the weight. The upsert has to be idempotent, because
 * incremental sync deliberately re-fetches an overlap window on every run. And the
 * loop has no transaction, so a single unusable record decides whether the rest of
 * the batch is written or lost.
 *
 * Opt-in and local-only — these tests DELETE rows. See testDatabase.ts.
 */

const USER = "00000000-0000-0000-0000-0000000000f2";

function activity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 1001,
    name: "Morning Run",
    type: "Run",
    sport_type: "Run",
    distance: 10000,
    moving_time: 3000,
    elapsed_time: 3100,
    start_date: "2026-03-09T07:00:00Z",
    total_elevation_gain: 50,
    ...overrides,
  } as StravaActivity;
}

async function cleanup() {
  const sql = getSql();
  await sql`DELETE FROM activities WHERE user_id = ${USER}::uuid`.catch(() => {});
  await sql`DELETE FROM users WHERE id = ${USER}::uuid`.catch(() => {});
}

async function seedUser() {
  await getSql()`INSERT INTO users (id) VALUES (${USER}::uuid) ON CONFLICT DO NOTHING`;
}

const countRows = async () => {
  const rows =
    await getSql()`SELECT COUNT(*)::int AS n FROM activities WHERE user_id = ${USER}::uuid`;
  return (rows[0] as { n: number }).n;
};

describe.skipIf(!hasTestDb)("upsertActivities", () => {
  beforeEach(async () => {
    await cleanup();
    await seedUser();
  });

  afterAll(cleanup);

  it("writes nothing and claims nothing for an empty batch", async () => {
    expect(await upsertActivities(USER, [])).toBe(0);
    expect(await countRows()).toBe(0);
  });

  it("writes each activity once and reports the count", async () => {
    const n = await upsertActivities(USER, [activity({ id: 1 }), activity({ id: 2 })]);
    expect(n).toBe(2);
    expect(await countRows()).toBe(2);
  });

  /**
   * Incremental sync re-fetches a seven-day overlap on every run precisely because
   * this is idempotent. If it were not, the overlap would duplicate a week of
   * training on every sync.
   */
  it("is idempotent on the same activity id", async () => {
    await upsertActivities(USER, [activity({ id: 7 })]);
    await upsertActivities(USER, [activity({ id: 7 })]);
    expect(await countRows()).toBe(1);
  });

  it("updates an existing row rather than ignoring the newer copy", async () => {
    await upsertActivities(USER, [activity({ id: 7, name: "Old name" })]);
    await upsertActivities(USER, [activity({ id: 7, name: "Renamed on Strava" })]);

    const rows = await getSql()`
      SELECT payload FROM activities WHERE user_id = ${USER}::uuid AND strava_activity_id = 7
    `;
    expect(JSON.stringify(rows[0])).toContain("Renamed on Strava");
  });

  // sport_type is the canonical field; `type` is the deprecated fallback for older
  // records, and preferring the wrong one misclassifies the session downstream.
  it.each([
    ["sport_type when present", { sport_type: "TrailRun", type: "Run" }, "TrailRun"],
    ["type when sport_type is empty", { sport_type: "", type: "Ride" }, "Ride"],
  ])("uses %s", async (_label, overrides, expected) => {
    await upsertActivities(USER, [activity({ id: 9, ...overrides })]);
    const rows = await getSql()`
      SELECT sport_type FROM activities WHERE user_id = ${USER}::uuid AND strava_activity_id = 9
    `;
    expect((rows[0] as { sport_type: string }).sport_type).toBe(expected);
  });

  it("keeps activities from different athletes apart", async () => {
    const other = "00000000-0000-0000-0000-0000000000f3";
    await getSql()`INSERT INTO users (id) VALUES (${other}::uuid) ON CONFLICT DO NOTHING`;
    try {
      await upsertActivities(USER, [activity({ id: 42 })]);
      await upsertActivities(other, [activity({ id: 42 })]);
      expect(await countRows()).toBe(1);
    } finally {
      await getSql()`DELETE FROM activities WHERE user_id = ${other}::uuid`;
      await getSql()`DELETE FROM users WHERE id = ${other}::uuid`;
    }
  });

  /**
   * The loop is not in a transaction, so what happens on a bad record decides whether
   * the rest of the batch survives. `new Date(bad).toISOString()` throws, so one
   * unparseable `start_date` used to abort the batch mid-write.
   *
   * The partial write was not the real damage. The sync run is marked failed, so the
   * cursor never advances, so the next sync re-fetches the same record and dies in the
   * same place: the athlete's sync is stuck on one bad row forever. It now skips the
   * record (logged) and writes the rest.
   */
  it("skips an unparseable start_date instead of failing the whole batch", async () => {
    const written = await upsertActivities(USER, [
      activity({ id: 100 }),
      activity({ id: 101, start_date: "not-a-date" }),
      activity({ id: 102 }),
    ]);

    expect(written).toBe(2);
    expect(await countRows()).toBe(2);
  });

  it("does not count a skipped record as written", async () => {
    expect(await upsertActivities(USER, [activity({ id: 103, start_date: "" })])).toBe(0);
    expect(await countRows()).toBe(0);
  });
});

describe.skipIf(!hasTestDb)("buildStravaImportFromDb", () => {
  beforeEach(async () => {
    await cleanup();
    await seedUser();
  });

  afterAll(cleanup);

  it("returns an empty import for an athlete with no activities", async () => {
    const imported = await buildStravaImportFromDb(USER, null);
    expect(imported.runs).toEqual([]);
    expect(imported.allActivities).toEqual([]);
  });

  it("round-trips a run through storage", async () => {
    await upsertActivities(USER, [activity({ id: 5, name: "Tempo" })]);
    const imported = await buildStravaImportFromDb(USER, null);
    expect(imported.allActivities.length).toBeGreaterThan(0);
  });

  // Oldest first: every trend, CTL curve and progression chart downstream assumes it.
  it("returns activities in chronological order", async () => {
    await upsertActivities(USER, [
      activity({ id: 2, start_date: "2026-03-20T07:00:00Z" }),
      activity({ id: 1, start_date: "2026-03-01T07:00:00Z" }),
    ]);
    const imported = await buildStravaImportFromDb(USER, null);
    const dates = imported.allActivities.map((a) => a.date);
    expect([...dates]).toEqual([...dates].sort());
  });
});
