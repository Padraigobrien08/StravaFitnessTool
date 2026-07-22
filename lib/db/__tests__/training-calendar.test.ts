import { afterAll, describe, expect, it } from "vitest";
import { getSql } from "../client";
import { deleteSavedWeek, getSavedWeeks, upsertSavedWeek } from "../training-calendar";
import type { TrainingCalendarWeek } from "@/lib/training-calendar/types";

// Round-trips against a real local Postgres. Skipped when DATABASE_URL is unset
// (CI without a DB, contributors without Docker) — same pattern as the FIT-export
// tests that gate on a git-ignored fixture.
const hasDb = !!process.env.DATABASE_URL;

const TEST_USER = "00000000-0000-0000-0000-0000000000f3";
const WEEK_START = "2026-08-03";

function makeWeek(overrides: Partial<TrainingCalendarWeek> = {}): TrainingCalendarWeek {
  const now = new Date("2026-07-30T10:00:00.000Z").toISOString();
  return {
    id: "week-f3-test",
    weekStart: WEEK_START,
    weekEnd: "2026-08-09",
    source: "manual",
    summary: "Test week",
    workouts: [],
    evidenceUsed: [],
    constraintsApplied: [],
    risksManaged: [],
    limitations: [],
    confidence: "medium",
    savedAt: now,
    updatedAt: now,
    revision: 1,
    ...overrides,
  };
}

describe.skipIf(!hasDb)("training-calendar DB persistence", () => {
  afterAll(async () => {
    try {
      await deleteSavedWeek(TEST_USER, WEEK_START);
      // Best-effort: remove the throwaway user row if the FK let us insert one.
      await getSql()`DELETE FROM users WHERE id = ${TEST_USER}::uuid`.catch(() => {});
    } catch {
      /* ignore cleanup errors */
    }
  });

  it("upserts and reads back a saved week", async () => {
    // The FK requires the user to exist first.
    await getSql()`
      INSERT INTO users (id, email) VALUES (${TEST_USER}::uuid, 'f3-test@example.com')
      ON CONFLICT (id) DO NOTHING
    `;
    await upsertSavedWeek(TEST_USER, makeWeek({ summary: "First save" }));

    const weeks = await getSavedWeeks(TEST_USER);
    const week = weeks.find((w) => w.weekStart === WEEK_START);
    expect(week).toBeDefined();
    expect(week!.summary).toBe("First save");
    expect(week!.id).toBe("week-f3-test");
  });

  it("overwrites on conflict (same user + week)", async () => {
    await upsertSavedWeek(TEST_USER, makeWeek({ summary: "Second save", revision: 2 }));
    const weeks = await getSavedWeeks(TEST_USER);
    const matching = weeks.filter((w) => w.weekStart === WEEK_START);
    expect(matching).toHaveLength(1);
    expect(matching[0].summary).toBe("Second save");
    expect(matching[0].revision).toBe(2);
  });

  it("deletes a saved week", async () => {
    await deleteSavedWeek(TEST_USER, WEEK_START);
    const weeks = await getSavedWeeks(TEST_USER);
    expect(weeks.find((w) => w.weekStart === WEEK_START)).toBeUndefined();
  });
});
