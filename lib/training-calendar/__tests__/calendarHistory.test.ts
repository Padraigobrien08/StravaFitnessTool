import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWeekHistory,
  historyCount,
  pushWeekSnapshot,
  revertCalendarWeek,
} from "../calendarHistory";
import { calendarWeekFixture, WEEK_START } from "@/test/plan-fixtures";
import type { TrainingCalendarWeek } from "../types";

/**
 * The undo history behind "Saved week cleared · Undo".
 *
 * Clearing a week is the one destructive action on the plan page, and the toast
 * offering to undo it is only honest if a snapshot was actually taken. So the
 * behaviour worth pinning is not that history works, but that a failure to record it
 * is survivable: `pushWeekSnapshot` runs immediately *before* `clearWeek()`, so
 * anything that throws here takes the click handler down with it.
 */

function makeStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

const week = (overrides: Partial<TrainingCalendarWeek> = {}): TrainingCalendarWeek => ({
  ...calendarWeekFixture(),
  ...overrides,
});

beforeEach(() => vi.stubGlobal("localStorage", makeStore()));
afterEach(() => vi.unstubAllGlobals());

describe("recording and restoring", () => {
  it("has no history for a week never saved", () => {
    expect(getWeekHistory(WEEK_START)).toEqual([]);
    expect(historyCount(WEEK_START)).toBe(0);
  });

  it("restores nothing when there is nothing to restore", () => {
    expect(revertCalendarWeek(WEEK_START)).toBeNull();
  });

  it("records a snapshot and gives it back", () => {
    pushWeekSnapshot(week({ summary: "Original week" }));
    expect(revertCalendarWeek(WEEK_START)?.summary).toBe("Original week");
  });

  // Newest first, or undo would walk backwards through time in the wrong order.
  it("restores the most recent snapshot first", () => {
    pushWeekSnapshot(week({ summary: "older" }));
    pushWeekSnapshot(week({ summary: "newer" }));
    expect(revertCalendarWeek(WEEK_START)?.summary).toBe("newer");
    expect(revertCalendarWeek(WEEK_START)?.summary).toBe("older");
  });

  it("consumes a snapshot as it restores it", () => {
    pushWeekSnapshot(week());
    revertCalendarWeek(WEEK_START);
    expect(historyCount(WEEK_START)).toBe(0);
  });

  it("keeps weeks apart", () => {
    pushWeekSnapshot(week({ weekStart: "2026-03-09" }));
    pushWeekSnapshot(week({ weekStart: "2026-03-16" }));
    expect(historyCount("2026-03-09")).toBe(1);
    expect(historyCount("2026-03-16")).toBe(1);
  });

  it("caps how far back it remembers", () => {
    for (let i = 0; i < 12; i++) pushWeekSnapshot(week({ summary: `v${i}` }));
    expect(historyCount(WEEK_START)).toBe(5);
  });

  /**
   * A snapshot has to be a copy. Storing a reference would let a later edit to the
   * live week rewrite the history it is supposed to be restorable from.
   */
  it("snapshots by value, not by reference", () => {
    const live = week({ summary: "as saved" });
    pushWeekSnapshot(live);
    live.summary = "edited afterwards";
    expect(revertCalendarWeek(WEEK_START)?.summary).toBe("as saved");
  });
});

describe("unreadable history", () => {
  it.each([
    ["unparseable JSON", "{not json"],
    ["a different version", JSON.stringify({ version: 99, weeks: {} })],
    ["a missing weeks map", JSON.stringify({ version: 1 })],
  ])("treats %s as no history rather than throwing", (_label, raw) => {
    localStorage.setItem("strideiq-calendar-history-v1", raw);
    expect(getWeekHistory(WEEK_START)).toEqual([]);
    expect(() => pushWeekSnapshot(week())).not.toThrow();
  });
});

describe("when the browser refuses to store", () => {
  /**
   * The third place in this codebase where `localStorage.setItem` was called without
   * a guard — after the planning-context draft and the Strava import. Here the read
   * path is carefully wrapped in try/catch and the write path is not, which is what
   * makes it look deliberate rather than overlooked.
   *
   * `pushWeekSnapshot` is called immediately before `clearWeek()`, so a quota error
   * threw out of the click handler: the athlete pressed "Clear", got an exception
   * instead of a cleared week, and the page went down with it.
   */
  it("does not throw when the snapshot cannot be written", () => {
    vi.stubGlobal("localStorage", {
      ...makeStore(),
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    });
    expect(() => pushWeekSnapshot(week())).not.toThrow();
  });

  it("does not throw when a restore cannot be persisted", () => {
    pushWeekSnapshot(week({ summary: "recorded" }));
    const stored = localStorage.getItem("strideiq-calendar-history-v1");
    vi.stubGlobal("localStorage", {
      ...makeStore(),
      getItem: () => stored,
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    });
    expect(() => revertCalendarWeek(WEEK_START)).not.toThrow();
  });

  it("does not throw when storage is missing entirely", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => pushWeekSnapshot(week())).not.toThrow();
    expect(getWeekHistory(WEEK_START)).toEqual([]);
    expect(revertCalendarWeek(WEEK_START)).toBeNull();
  });
});

describe("saving a week survives a full store", () => {
  /**
   * `calendarStorage.writeIndex` had the same unguarded `setItem` as the history
   * index — read path wrapped, write path not. Saving a week is reachable from three
   * click handlers in the plan workspace (save, revert, duplicate), so a quota error
   * threw out of all of them.
   */
  it("does not throw when the week cannot be persisted", async () => {
    vi.stubGlobal("localStorage", {
      ...makeStore(),
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    });
    const { saveCalendarWeek } = await import("../calendarStorage");
    expect(() => saveCalendarWeek(week())).not.toThrow();
  });

  it("does not throw when the calendar cannot be cleared", async () => {
    vi.stubGlobal("localStorage", {
      ...makeStore(),
      removeItem: () => {
        throw new DOMException("SecurityError");
      },
    });
    const { clearCalendar } = await import("../calendarStorage");
    expect(() => clearCalendar()).not.toThrow();
  });
});
