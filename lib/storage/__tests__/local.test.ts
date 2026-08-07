import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The export-only persistence layer, at 0% coverage.
 *
 * This is the whole database for an athlete who never connects Strava: lose or
 * corrupt this key and their import is gone. The behaviour worth pinning is what
 * happens to *bad* stored data — a schema change or a half-written value must not
 * leave the app permanently unable to load.
 *
 * The store is stubbed rather than jsdom-provided: these functions need `window` and
 * `localStorage` to exist and nothing else, so a real DOM would be a heavier
 * dependency for no extra assurance.
 */

const STORAGE_KEY = "strava-running-insights-v1";

const clearFitDetails = vi.fn();
vi.mock("@/lib/storage/fit-db", () => ({ clearFitDetails: () => clearFitDetails() }));

function makeStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    get size() {
      return map.size;
    },
  };
}

let store: ReturnType<typeof makeStore>;

/** A StravaImport that satisfies the schema. */
function validImport() {
  return {
    runs: [],
    profile: {
      maxHeartRate: null,
      athleteType: null,
      ftp: null,
      measurementPreference: null,
    },
    goals: [],
    allActivities: [],
    importedAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  store = makeStore();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", store);
  clearFitDetails.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllGlobals());

async function mod() {
  return import("../local");
}

describe("round trip", () => {
  it("saves and loads an import", async () => {
    const { saveImport, loadImport } = await mod();
    saveImport(validImport() as never);
    expect(loadImport()).toMatchObject({ importedAt: "2026-01-01T00:00:00.000Z" });
  });

  it("reports whether anything is stored", async () => {
    const { saveImport, hasStoredImport } = await mod();
    expect(hasStoredImport()).toBe(false);
    saveImport(validImport() as never);
    expect(hasStoredImport()).toBe(true);
  });

  it("returns null when nothing has been saved", async () => {
    expect((await mod()).loadImport()).toBeNull();
  });
});

describe("recovering from bad stored data", () => {
  // The important property. A stale or truncated value must not wedge the app: the
  // athlete loses the cached import, which is recoverable, rather than hitting a
  // parse error on every load with no way to clear it from the UI.
  it.each([
    ["unparseable JSON", "{not json"],
    ["JSON that is not an object", '"a string"'],
    ["an object missing required fields", '{"runs":[]}'],
    ["an empty string", ""],
  ])("discards %s and returns null", async (_label, raw) => {
    store.setItem(STORAGE_KEY, raw);
    const { loadImport } = await mod();
    expect(loadImport()).toBeNull();
  });

  it("evicts the bad value rather than leaving it to fail again", async () => {
    store.setItem(STORAGE_KEY, "{not json");
    const { loadImport } = await mod();
    loadImport();
    expect(store.getItem(STORAGE_KEY)).toBeNull();
  });

  // Writing is validated too, so a malformed import never reaches storage in the
  // first place — better to fail at the call site than to poison the key.
  it("refuses to save something that does not match the schema", async () => {
    const { saveImport } = await mod();
    expect(() => saveImport({ nonsense: true } as never)).toThrow();
    expect(store.size).toBe(0);
  });
});

describe("clearing", () => {
  it("removes the stored import", async () => {
    const { saveImport, clearImport, hasStoredImport } = await mod();
    saveImport(validImport() as never);
    clearImport();
    expect(hasStoredImport()).toBe(false);
  });

  // The FIT streams live in IndexedDB, so clearing only localStorage would strip the
  // activities while leaving their per-run detail orphaned in a second store.
  it("also clears the IndexedDB stream cache", async () => {
    const { clearImport } = await mod();
    clearImport();
    await vi.waitFor(() => expect(clearFitDetails).toHaveBeenCalled());
  });
});

describe("server-side rendering", () => {
  // Every function is reachable during SSR, where neither global exists. They must
  // no-op rather than throw, or the page fails to render at all.
  it.each([
    ["loadImport", (m: Record<string, () => unknown>) => expect(m.loadImport()).toBeNull()],
    [
      "hasStoredImport",
      (m: Record<string, () => unknown>) => expect(m.hasStoredImport()).toBe(false),
    ],
    [
      "clearImport",
      (m: Record<string, () => unknown>) => expect(() => m.clearImport()).not.toThrow(),
    ],
  ])("%s is inert without a window", async (_label, assertion) => {
    vi.stubGlobal("window", undefined);
    assertion((await mod()) as unknown as Record<string, () => unknown>);
  });

  it("saveImport does not write without a window", async () => {
    vi.stubGlobal("window", undefined);
    const { saveImport } = await mod();
    saveImport(validImport() as never);
    expect(store.size).toBe(0);
  });
});
