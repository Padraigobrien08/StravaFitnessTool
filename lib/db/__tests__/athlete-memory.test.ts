import { afterAll, describe, expect, it } from "vitest";
import { hasTestDb } from "./testDatabase";
import { getSql } from "../client";
import { getStoredBeliefMeta, upsertBeliefs } from "../athlete-memory";
import type { AthleteBelief } from "@/lib/athlete-memory/types";

// Opt-in and local-only: these tests DELETE rows. See testDatabase.ts.
const hasDb = hasTestDb;
const TEST_USER = "00000000-0000-0000-0000-0000000000a6";
const BELIEF_ID = "adapt-efficiency-up";

function belief(overrides: Partial<AthleteBelief> = {}): AthleteBelief {
  return {
    id: BELIEF_ID,
    category: "adaptation",
    statement: "Aerobic efficiency trending up",
    confidence: "medium",
    evidence: ["four weeks improving"],
    counterEvidence: [],
    firstObserved: "2026-05-01T00:00:00.000Z",
    lastUpdated: "2026-07-25T00:00:00.000Z",
    stability: "stable",
    recommendedUse: "Support progression",
    timesConfirmed: 3,
    lastConfirmed: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

describe.skipIf(!hasDb)("athlete-memory DB persistence", () => {
  afterAll(async () => {
    try {
      await getSql()`DELETE FROM athlete_memory_beliefs WHERE user_id = ${TEST_USER}::uuid`;
      await getSql()`DELETE FROM users WHERE id = ${TEST_USER}::uuid`.catch(() => {});
    } catch {
      /* ignore cleanup errors */
    }
  });

  it("upserts a belief and reads its history back", async () => {
    await getSql()`
      INSERT INTO users (id, email) VALUES (${TEST_USER}::uuid, 'a6-test@example.com')
      ON CONFLICT (id) DO NOTHING
    `;
    await upsertBeliefs(TEST_USER, [belief()]);

    const map = await getStoredBeliefMeta(TEST_USER);
    const meta = map.get(BELIEF_ID);
    expect(meta).toBeDefined();
    expect(meta!.timesConfirmed).toBe(3);
    expect(meta!.firstObserved.slice(0, 10)).toBe("2026-05-01");
  });

  it("preserves first-observed and advances the count on re-upsert", async () => {
    await upsertBeliefs(TEST_USER, [
      belief({ firstObserved: "2026-05-01T00:00:00.000Z", timesConfirmed: 4 }),
    ]);
    const map = await getStoredBeliefMeta(TEST_USER);
    const meta = map.get(BELIEF_ID)!;
    expect(meta.timesConfirmed).toBe(4);
    expect(meta.firstObserved.slice(0, 10)).toBe("2026-05-01");
  });
});
