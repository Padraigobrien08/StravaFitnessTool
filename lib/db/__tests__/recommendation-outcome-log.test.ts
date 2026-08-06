import { afterAll, describe, expect, it } from "vitest";
import { hasTestDb } from "./testDatabase";
import { getSql } from "../client";
import { getTrackedOutcomesForUser, saveTrackedOutcomes } from "../recommendation-outcome-log";
import type { TrackedRecommendationOutcome } from "@/lib/recommendation-learning/types";

// Opt-in and local-only: these tests DELETE rows. See testDatabase.ts.
const hasDb = hasTestDb;
const TEST_USER = "00000000-0000-0000-0000-0000000000e9";

function outcome(
  id: string,
  overrides: Partial<TrackedRecommendationOutcome> = {},
): TrackedRecommendationOutcome {
  return {
    recommendationId: id,
    issuedAt: "2026-08-04T08:00:00.000Z",
    recommendation: "Keep intensity easy and protect freshness",
    expectedOutcome: ["freshness", "readiness"],
    observedSignals: [],
    evaluation: "inconclusive",
    confidenceBefore: 0.5,
    evidence: [],
    ...overrides,
  };
}

describe.skipIf(!hasDb)("recommendation-outcome-log DB persistence", () => {
  afterAll(async () => {
    try {
      await getSql()`DELETE FROM recommendation_outcome_log WHERE user_id = ${TEST_USER}::uuid`;
      await getSql()`DELETE FROM users WHERE id = ${TEST_USER}::uuid`.catch(() => {});
    } catch {
      /* ignore cleanup errors */
    }
  });

  it("round-trips a pending outcome", async () => {
    await getSql()`INSERT INTO users (id) VALUES (${TEST_USER}::uuid) ON CONFLICT DO NOTHING`;
    await saveTrackedOutcomes(TEST_USER, [outcome("rec-1")]);

    const rows = await getTrackedOutcomesForUser(TEST_USER);
    const found = rows.find((r) => r.recommendationId === "rec-1");
    expect(found).toBeTruthy();
    expect(found!.recommendation).toBe("Keep intensity easy and protect freshness");
    expect(found!.evaluatedAt).toBeUndefined();
  });

  // The whole point: a pending outcome saved in one request is judged in a later one,
  // and the verdict has to survive the write-back.
  it("upserts a pending outcome into a judged one", async () => {
    await getSql()`INSERT INTO users (id) VALUES (${TEST_USER}::uuid) ON CONFLICT DO NOTHING`;
    await saveTrackedOutcomes(TEST_USER, [outcome("rec-2")]);
    await saveTrackedOutcomes(TEST_USER, [
      outcome("rec-2", {
        evaluation: "supported",
        evaluatedAt: "2026-08-05T09:00:00.000Z",
        observedSignals: ["Freshness 67"],
        evidence: ["Freshness 67"],
        confidenceAfter: 0.72,
      }),
    ]);

    const rows = await getTrackedOutcomesForUser(TEST_USER);
    const found = rows.filter((r) => r.recommendationId === "rec-2");
    expect(found).toHaveLength(1); // upsert, not a duplicate row
    expect(found[0].evaluation).toBe("supported");
    expect(found[0].evaluatedAt).toBe("2026-08-05T09:00:00.000Z");
    expect(found[0].observedSignals).toEqual(["Freshness 67"]);
  });

  it("returns outcomes newest first", async () => {
    await getSql()`INSERT INTO users (id) VALUES (${TEST_USER}::uuid) ON CONFLICT DO NOTHING`;
    await saveTrackedOutcomes(TEST_USER, [
      outcome("old", { issuedAt: "2026-07-01T08:00:00.000Z" }),
      outcome("recent", { issuedAt: "2026-08-04T08:00:00.000Z" }),
    ]);
    const ids = (await getTrackedOutcomesForUser(TEST_USER)).map((r) => r.recommendationId);
    expect(ids.indexOf("recent")).toBeLessThan(ids.indexOf("old"));
  });

  it("scopes reads to one athlete", async () => {
    await getSql()`INSERT INTO users (id) VALUES (${TEST_USER}::uuid) ON CONFLICT DO NOTHING`;
    await saveTrackedOutcomes(TEST_USER, [outcome("mine")]);
    const other = await getTrackedOutcomesForUser("00000000-0000-0000-0000-0000000000ea");
    expect(other.find((r) => r.recommendationId === "mine")).toBeUndefined();
  });

  it("saving nothing is a no-op", async () => {
    await expect(saveTrackedOutcomes(TEST_USER, [])).resolves.toBeUndefined();
  });
});
