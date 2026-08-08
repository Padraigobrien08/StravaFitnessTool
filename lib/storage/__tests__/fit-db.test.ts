import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFitDetails,
  countFitDetails,
  countStaleFitDetails,
  getAllFitDetails,
  getFitDetail,
  isStaleFitDetail,
  mergeFitDetails,
  saveFitDetails,
} from "../fit-db";
import type { FitRunDetail } from "@/lib/strava/fitTypes";

/**
 * The IndexedDB stream cache, at 0% coverage.
 *
 * For an export-only athlete this holds every per-run stream they have: pace, laps,
 * GPS, best efforts. It is also the store most likely to contain data written by an
 * older version of the app, so the behaviour that matters is what happens when a
 * stored record no longer matches the schema — it must be skipped, not thrown over,
 * or one stale row makes every workout page fail.
 *
 * Run against `fake-indexeddb`, a dev-only in-memory implementation of the real API,
 * so these exercise the actual transaction and cursor code rather than a hand-written
 * stand-in that would agree with whatever the code does.
 */

function detail(activityId: string, overrides: Partial<FitRunDetail> = {}): FitRunDetail {
  return {
    activityId,
    bestEfforts: [],
    laps: [],
    hrStream: [],
    paceStream: [{ elapsedSec: 0, paceSecPerKm: 300 }],
    cadenceStream: [],
    gpsStream: [],
    hrDriftPct: null,
    avgCadence: null,
    ...overrides,
  } as FitRunDetail;
}

/** A record with nothing in it — what a failed or empty parse leaves behind. */
const emptyDetail = (id: string) =>
  detail(id, { paceStream: [], laps: [], bestEfforts: [], gpsStream: [] });

beforeEach(async () => {
  await clearFitDetails();
});

describe("round trip", () => {
  it("saves a detail and reads it back", async () => {
    await saveFitDetails([detail("100")]);
    const found = await getFitDetail("100");
    expect(found?.activityId).toBe("100");
    expect(found?.paceStream).toHaveLength(1);
  });

  it("returns null for an id that was never stored", async () => {
    expect(await getFitDetail("nope")).toBeNull();
  });

  it("stores many and lists them all", async () => {
    await saveFitDetails([detail("1"), detail("2"), detail("3")]);
    expect(await getAllFitDetails()).toHaveLength(3);
    expect(await countFitDetails()).toBe(3);
  });

  it("counts nothing on an empty store", async () => {
    expect(await countFitDetails()).toBe(0);
    expect(await getAllFitDetails()).toEqual([]);
  });

  it("accepts an empty batch without opening a transaction it cannot close", async () => {
    await expect(mergeFitDetails([])).resolves.toBe(true);
  });

  /**
   * Writes report success rather than returning void, because every caller treats
   * streams as an enhancement over run data that is already parsed. Throwing meant a
   * storage failure aborted the whole import.
   */
  it("reports success when the write lands", async () => {
    await expect(saveFitDetails([detail("ok")])).resolves.toBe(true);
  });

  it("reports failure instead of throwing when the store is unavailable", async () => {
    const realOpen = indexedDB.open;
    // A quota-exhausted or blocked store surfaces here as a failure to open.
    (indexedDB as unknown as { open: unknown }).open = () => {
      throw new DOMException("QuotaExceededError");
    };
    try {
      await expect(saveFitDetails([detail("blocked")])).resolves.toBe(false);
    } finally {
      (indexedDB as unknown as { open: unknown }).open = realOpen;
    }
  });
});

describe("merging", () => {
  // Keyed on activityId, so a re-parse of the same run replaces rather than duplicates.
  it("overwrites an existing record for the same activity", async () => {
    await mergeFitDetails([detail("1", { paceStream: [{ elapsedSec: 0, paceSecPerKm: 300 }] })]);
    await mergeFitDetails([
      detail("1", {
        paceStream: [
          { elapsedSec: 0, paceSecPerKm: 240 },
          { elapsedSec: 1, paceSecPerKm: 241 },
        ],
      }),
    ]);

    expect(await countFitDetails()).toBe(1);
    expect((await getFitDetail("1"))?.paceStream).toHaveLength(2);
  });

  it("leaves other activities untouched when merging one", async () => {
    await mergeFitDetails([detail("1"), detail("2")]);
    await mergeFitDetails([detail("1", { laps: [] })]);
    expect(await getFitDetail("2")).not.toBeNull();
  });
});

describe("stale records", () => {
  it("recognises a record with no streams, laps, efforts or GPS as stale", () => {
    expect(isStaleFitDetail(emptyDetail("1"))).toBe(true);
  });

  it("does not call a record with any content stale", () => {
    expect(isStaleFitDetail(detail("1"))).toBe(false);
  });

  it("counts stale records across the store", async () => {
    await saveFitDetails([emptyDetail("1"), detail("2"), emptyDetail("3")]);
    expect(await countStaleFitDetails()).toBe(2);
  });
});

describe("data written by an older version", () => {
  /**
   * Writing straight through the raw API to bypass the schema check on the way in —
   * which is exactly how a record from a previous release ends up in the store.
   */
  async function writeRaw(record: unknown) {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strideiq-fit-v2", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("fitDetails", "readwrite");
      tx.objectStore("fitDetails").put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  it("returns null for a single unreadable record instead of throwing", async () => {
    await writeRaw({ activityId: "bad", paceStream: "not-an-array" });
    expect(await getFitDetail("bad")).toBeNull();
  });

  // The important one: one bad row must not take out the whole list, or a single
  // stale record from an old release breaks every page that reads streams.
  it("skips unreadable records and returns the readable ones", async () => {
    await saveFitDetails([detail("good-1"), detail("good-2")]);
    await writeRaw({ activityId: "bad", paceStream: "not-an-array" });

    const all = await getAllFitDetails();
    expect(all.map((d) => d.activityId).sort()).toEqual(["good-1", "good-2"]);
  });

  // countFitDetails asks the store, getAllFitDetails filters — so they legitimately
  // disagree when bad rows exist. Pinned so the difference is deliberate.
  it("counts raw rows while listing only valid ones", async () => {
    await saveFitDetails([detail("good")]);
    await writeRaw({ activityId: "bad", paceStream: "not-an-array" });

    expect(await countFitDetails()).toBe(2);
    expect(await getAllFitDetails()).toHaveLength(1);
  });

  it("refuses to write a malformed record through the normal path", async () => {
    await expect(
      mergeFitDetails([{ activityId: "x" } as unknown as FitRunDetail]),
    ).rejects.toThrow();
  });
});

describe("clearing", () => {
  it("empties the store", async () => {
    await saveFitDetails([detail("1"), detail("2")]);
    await clearFitDetails();
    expect(await countFitDetails()).toBe(0);
  });

  it("is safe to call on an already-empty store", async () => {
    await expect(clearFitDetails()).resolves.toBeUndefined();
  });
});
