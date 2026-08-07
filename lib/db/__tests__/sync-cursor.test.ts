import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getLastSyncCursor` — the read that had been missing since migration 001.
 *
 * Mocked at the SQL client rather than run against Postgres, because what matters
 * here is the decoding and the failure behaviour, not the query. The round-trip
 * against a real database is covered by the opt-in suites in this directory.
 */

const sqlMock = vi.fn();
vi.mock("../client", () => ({ getSql: () => sqlMock }));

const USER = "00000000-0000-0000-0000-000000000001";

/** The driver is called as a tagged template, so the mock has to accept that shape. */
function returns(rows: unknown[]) {
  sqlMock.mockResolvedValue(rows);
}

/**
 * A bare `mockReset()` leaves the mock with no implementation, and a rejection
 * configured on top of that surfaces as an unhandled rejection rather than being
 * caught — verified by reproducing it both ways. Re-seeding a benign default keeps
 * every test starting from a mock that behaves like the driver.
 */
beforeEach(() => {
  sqlMock.mockReset();
  sqlMock.mockResolvedValue([]);
});

async function cursor() {
  const { getLastSyncCursor } = await import("../sync-runs");
  return getLastSyncCursor(USER);
}

describe("getLastSyncCursor", () => {
  it("returns null when the athlete has never completed a sync", async () => {
    returns([]);
    await expect(cursor()).resolves.toBeNull();
  });

  // BIGINT comes back from the Postgres driver as a string; returning it unconverted
  // would put a string into an arithmetic path and produce "1700000000-604800".
  it("decodes a BIGINT arriving as a string", async () => {
    returns([{ last_after: "1700000000" }]);
    await expect(cursor()).resolves.toBe(1_700_000_000);
  });

  it("accepts a number unchanged", async () => {
    returns([{ last_after: 1_700_000_000 }]);
    await expect(cursor()).resolves.toBe(1_700_000_000);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an unparseable string", "not-a-number"],
    ["zero", 0],
    ["a negative value", -5],
  ])("returns null for %s rather than a bad cursor", async (_label, value) => {
    returns([{ last_after: value }]);
    await expect(cursor()).resolves.toBeNull();
  });

  /**
   * The cursor is an optimisation on top of a working full sync. If looking it up
   * fails, the right outcome is a slower sync, not a failed one — so this swallows
   * and returns null, which the caller reads as "fetch everything".
   */
  it("degrades to a full sync when the query throws", async () => {
    sqlMock.mockRejectedValue(new Error("connection lost"));
    await expect(cursor()).resolves.toBeNull();
  });
});
