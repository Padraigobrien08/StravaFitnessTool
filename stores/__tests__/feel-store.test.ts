import { beforeEach, describe, expect, it } from "vitest";
import { isNewerReport, selectTodayLegFeel, useFeelStore } from "../feel-store";
import { feelDateKey, type LegFeelReport } from "@/lib/wellness/types";

/**
 * The leg-feel store's reconciliation policy.
 *
 * `stores/feel-store.ts` was at 0% coverage while `lib/wellness/` sat at 97.6% — the
 * tested part was the calibration maths, not the merge that decides which report the
 * athlete actually sees. §DD-4's acceptance tests are the four recency cases below.
 */

function rep(
  legs: LegFeelReport["legs"],
  reportedAt: string,
  source: LegFeelReport["source"] = "morning",
): LegFeelReport {
  return { legs, source, reportedAt };
}

const DAY = "2026-08-05";
const MORNING = "2026-08-05T07:00:00.000Z";
const EVENING = "2026-08-05T18:00:00.000Z";

beforeEach(() => {
  useFeelStore.getState().clear();
});

describe("isNewerReport", () => {
  it("accepts anything when there is no incumbent", () => {
    expect(isNewerReport(rep("fresh", MORNING))).toBe(true);
  });

  it("prefers the newer timestamp", () => {
    expect(isNewerReport(rep("heavy", EVENING), rep("fresh", MORNING))).toBe(true);
    expect(isNewerReport(rep("fresh", MORNING), rep("heavy", EVENING))).toBe(false);
  });

  it("keeps the incumbent on an exact tie", () => {
    expect(isNewerReport(rep("heavy", MORNING), rep("fresh", MORNING))).toBe(false);
  });

  it("does not let an unorderable timestamp win", () => {
    expect(isNewerReport(rep("heavy", "not-a-date"), rep("fresh", MORNING))).toBe(false);
  });

  it("replaces an incumbent whose timestamp is unorderable", () => {
    expect(isNewerReport(rep("heavy", MORNING), rep("fresh", "garbage"))).toBe(true);
  });
});

describe("mergeFromServer", () => {
  // §DD-4 acceptance test 1 — the defect. This previously kept the stale local report.
  it("adopts a newer server report over an older local one", () => {
    const s = useFeelStore.getState();
    s.setFeel(DAY, rep("fresh", MORNING, "morning"));
    useFeelStore.getState().mergeFromServer(DAY, rep("heavy", EVENING, "post_run"));

    const after = useFeelStore.getState().byDate[DAY];
    expect(after.legs).toBe("heavy");
    expect(after.reportedAt).toBe(EVENING);
    expect(after.source).toBe("post_run");
  });

  // §DD-4 acceptance test 2 — local-first still holds when local is newer.
  it("keeps a newer local report over an older server one", () => {
    useFeelStore.getState().setFeel(DAY, rep("heavy", EVENING));
    useFeelStore.getState().mergeFromServer(DAY, rep("fresh", MORNING));
    expect(useFeelStore.getState().byDate[DAY].legs).toBe("heavy");
  });

  // §DD-4 acceptance test 4 — a post-run report supersedes the same day's morning one.
  it("lets a post-run report supersede the morning report", () => {
    useFeelStore.getState().setFeel(DAY, rep("fresh", MORNING, "morning"));
    useFeelStore.getState().mergeFromServer(DAY, rep("normal", EVENING, "post_run"));
    expect(useFeelStore.getState().byDate[DAY].source).toBe("post_run");
  });

  it("adopts a server report when there is no local one", () => {
    useFeelStore.getState().mergeFromServer(DAY, rep("heavy", MORNING));
    expect(useFeelStore.getState().byDate[DAY].legs).toBe("heavy");
  });

  it("ignores a null server response", () => {
    useFeelStore.getState().setFeel(DAY, rep("fresh", MORNING));
    useFeelStore.getState().mergeFromServer(DAY, null);
    expect(useFeelStore.getState().byDate[DAY].legs).toBe("fresh");
  });

  it("leaves other days alone", () => {
    useFeelStore.getState().setFeel("2026-08-04", rep("fresh", "2026-08-04T07:00:00.000Z"));
    useFeelStore.getState().mergeFromServer(DAY, rep("heavy", EVENING));
    expect(useFeelStore.getState().byDate["2026-08-04"].legs).toBe("fresh");
    expect(useFeelStore.getState().byDate[DAY].legs).toBe("heavy");
  });

  /**
   * Convergence is the property that was broken: whichever order the two devices'
   * reports arrive in, both must end up showing the newer one.
   */
  it("converges regardless of arrival order", () => {
    const laptop = rep("fresh", MORNING, "morning");
    const phone = rep("heavy", EVENING, "post_run");

    useFeelStore.getState().clear();
    useFeelStore.getState().setFeel(DAY, laptop);
    useFeelStore.getState().mergeFromServer(DAY, phone);
    const localFirst = useFeelStore.getState().byDate[DAY];

    useFeelStore.getState().clear();
    useFeelStore.getState().setFeel(DAY, phone);
    useFeelStore.getState().mergeFromServer(DAY, laptop);
    const serverFirst = useFeelStore.getState().byDate[DAY];

    expect(localFirst).toEqual(serverFirst);
    expect(localFirst.legs).toBe("heavy");
  });
});

// §DD-4 acceptance test 3 — a failed save must be retryable rather than lost.
describe("pending queue", () => {
  it("marks a local write as pending", () => {
    useFeelStore.getState().setFeel(DAY, rep("heavy", MORNING));
    expect(useFeelStore.getState().pendingDates).toEqual([DAY]);
  });

  it("clears the flag once synced", () => {
    useFeelStore.getState().setFeel(DAY, rep("heavy", MORNING));
    useFeelStore.getState().markSynced(DAY);
    expect(useFeelStore.getState().pendingDates).toEqual([]);
  });

  it("can be re-flagged after a failed save", () => {
    useFeelStore.getState().setFeel(DAY, rep("heavy", MORNING));
    useFeelStore.getState().markSynced(DAY);
    useFeelStore.getState().markPending(DAY);
    expect(useFeelStore.getState().pendingDates).toEqual([DAY]);
  });

  it("does not duplicate a day", () => {
    const s = () => useFeelStore.getState();
    s().setFeel(DAY, rep("heavy", MORNING));
    s().setFeel(DAY, rep("normal", EVENING));
    s().markPending(DAY);
    expect(s().pendingDates).toEqual([DAY]);
  });

  it("tracks several days independently", () => {
    useFeelStore.getState().setFeel("2026-08-04", rep("fresh", "2026-08-04T07:00:00.000Z"));
    useFeelStore.getState().setFeel(DAY, rep("heavy", MORNING));
    expect(useFeelStore.getState().pendingDates.sort()).toEqual(["2026-08-04", DAY]);
    useFeelStore.getState().markSynced("2026-08-04");
    expect(useFeelStore.getState().pendingDates).toEqual([DAY]);
  });

  // A server report that supersedes the local one means there is nothing left to push.
  it("drops the pending flag when the server's copy wins", () => {
    useFeelStore.getState().setFeel(DAY, rep("fresh", MORNING));
    expect(useFeelStore.getState().pendingDates).toEqual([DAY]);
    useFeelStore.getState().mergeFromServer(DAY, rep("heavy", EVENING));
    expect(useFeelStore.getState().pendingDates).toEqual([]);
  });

  it("keeps the flag when the local copy is still the newer one", () => {
    useFeelStore.getState().setFeel(DAY, rep("heavy", EVENING));
    useFeelStore.getState().mergeFromServer(DAY, rep("fresh", MORNING));
    expect(useFeelStore.getState().pendingDates).toEqual([DAY]);
  });

  it("clear() empties both maps", () => {
    useFeelStore.getState().setFeel(DAY, rep("heavy", MORNING));
    useFeelStore.getState().clear();
    expect(useFeelStore.getState().byDate).toEqual({});
    expect(useFeelStore.getState().pendingDates).toEqual([]);
  });
});

describe("selectTodayLegFeel", () => {
  it("returns today's value and nothing for other days", () => {
    const today = feelDateKey();
    expect(selectTodayLegFeel(useFeelStore.getState())).toBeUndefined();
    useFeelStore.getState().setFeel(today, rep("normal", new Date().toISOString()));
    expect(selectTodayLegFeel(useFeelStore.getState())).toBe("normal");
  });
});

/**
 * `pendingDates` was added after `strideiq-feel-store-v1` shipped, so an existing
 * install rehydrates a payload without it. Zustand's default merge keeps the
 * initializer's empty array, but every read coalesces anyway — a crash on an upgrade
 * path is not worth resting on middleware behaviour.
 */
describe("v1 persisted-state upgrade path", () => {
  it("does not throw when rehydrated state lacks pendingDates", () => {
    useFeelStore.setState({
      byDate: { [DAY]: rep("fresh", MORNING) },
      pendingDates: undefined as unknown as string[],
    });
    expect(() =>
      useFeelStore.getState().setFeel("2026-08-06", rep("heavy", EVENING)),
    ).not.toThrow();
    expect(useFeelStore.getState().pendingDates).toEqual(["2026-08-06"]);
  });

  it("still merges by recency when rehydrated state lacks pendingDates", () => {
    useFeelStore.setState({
      byDate: { [DAY]: rep("fresh", MORNING) },
      pendingDates: undefined as unknown as string[],
    });
    expect(() => useFeelStore.getState().mergeFromServer(DAY, rep("heavy", EVENING))).not.toThrow();
    expect(useFeelStore.getState().byDate[DAY].legs).toBe("heavy");
  });
});
