import { afterAll, describe, expect, it } from "vitest";
import { hasTestDb } from "./testDatabase";
import { getSql } from "../client";
import { getRecommendations, logRecommendation, saveEvaluation } from "../recommendation-log";
import type { LoggedRecommendation } from "@/lib/recommendation-outcomes/types";

// Opt-in and local-only: these tests DELETE rows. See testDatabase.ts.
const hasDb = hasTestDb;
const TEST_USER = "00000000-0000-0000-0000-0000000000f6";
const REC_ID = "today_session:2026-08-15";

function makeRec(overrides: Partial<LoggedRecommendation> = {}): LoggedRecommendation {
  return {
    recommendationId: REC_ID,
    producer: "today_session",
    issuedAt: "2026-08-15T08:00:00.000Z",
    targetDate: "2026-08-15",
    kind: "tempo",
    headline: "Tempo, 8–10 km",
    distanceKmMin: 8,
    distanceKmMax: 10,
    ...overrides,
  };
}

describe.skipIf(!hasDb)("recommendation-log DB persistence", () => {
  afterAll(async () => {
    try {
      await getSql()`DELETE FROM recommendation_log WHERE user_id = ${TEST_USER}::uuid`;
      await getSql()`DELETE FROM users WHERE id = ${TEST_USER}::uuid`.catch(() => {});
    } catch {
      /* ignore cleanup errors */
    }
  });

  it("logs a recommendation and reads it back", async () => {
    await getSql()`
      INSERT INTO users (id, email) VALUES (${TEST_USER}::uuid, 'f6-test@example.com')
      ON CONFLICT (id) DO NOTHING
    `;
    await logRecommendation(TEST_USER, makeRec());
    const recs = await getRecommendations(TEST_USER);
    const found = recs.find((r) => r.recommendationId === REC_ID);
    expect(found).toBeDefined();
    expect(found!.kind).toBe("tempo");
    expect(found!.adherence).toBeUndefined();
  });

  it("logging is idempotent (first write wins)", async () => {
    await logRecommendation(TEST_USER, makeRec({ kind: "easy", headline: "Changed" }));
    const recs = await getRecommendations(TEST_USER);
    const matching = recs.filter((r) => r.recommendationId === REC_ID);
    expect(matching).toHaveLength(1);
    expect(matching[0].kind).toBe("tempo"); // original preserved
  });

  it("saveEvaluation writes back adherence", async () => {
    await saveEvaluation(TEST_USER, {
      ...makeRec(),
      adherence: "followed",
      matchedRunIds: ["run-1"],
      evaluationNote: "Ran the recommended session.",
      evaluatedAt: "2026-08-16T09:00:00.000Z",
    });
    const recs = await getRecommendations(TEST_USER);
    const found = recs.find((r) => r.recommendationId === REC_ID);
    expect(found!.adherence).toBe("followed");
    expect(found!.matchedRunIds).toEqual(["run-1"]);
  });
});
