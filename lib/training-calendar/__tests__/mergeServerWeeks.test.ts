import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCalendar, getCalendarWeek, mergeServerWeeks } from "../calendarStorage";
import type { TrainingCalendarWeek } from "../types";

function week(overrides: Partial<TrainingCalendarWeek> = {}): TrainingCalendarWeek {
  return {
    id: "w",
    weekStart: "2026-08-03",
    weekEnd: "2026-08-09",
    source: "manual",
    summary: "server",
    workouts: [],
    evidenceUsed: [],
    constraintsApplied: [],
    risksManaged: [],
    limitations: [],
    confidence: "medium",
    savedAt: "2026-07-30T10:00:00.000Z",
    updatedAt: "2026-07-30T10:00:00.000Z",
    revision: 1,
    ...overrides,
  };
}

describe("mergeServerWeeks", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    clearCalendar();
  });

  it("adds a server week not present locally", () => {
    const changed = mergeServerWeeks([week({ summary: "from server" })]);
    expect(changed).toBe(true);
    expect(getCalendarWeek("2026-08-03")?.summary).toBe("from server");
  });

  it("overwrites a stale local week with a newer server copy", () => {
    // Seed local via merge (writes verbatim) so the timestamp is deterministic.
    mergeServerWeeks([week({ summary: "local-old", updatedAt: "2026-07-30T10:00:00.000Z" })]);
    const changed = mergeServerWeeks([
      week({ summary: "server-new", updatedAt: "2026-07-31T10:00:00.000Z" }),
    ]);
    expect(changed).toBe(true);
    expect(getCalendarWeek("2026-08-03")?.summary).toBe("server-new");
  });

  it("keeps a newer local week when the server copy is older (last-write-wins)", () => {
    mergeServerWeeks([week({ summary: "local-new", updatedAt: "2026-08-01T10:00:00.000Z" })]);
    const changed = mergeServerWeeks([
      week({ summary: "server-old", updatedAt: "2026-07-25T10:00:00.000Z" }),
    ]);
    expect(changed).toBe(false);
    expect(getCalendarWeek("2026-08-03")?.summary).toBe("local-new");
  });

  it("is a no-op for an empty server list", () => {
    expect(mergeServerWeeks([])).toBe(false);
  });
});
