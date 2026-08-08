import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThread,
  deleteThread,
  getActiveThreadId,
  getThread,
  listThreads,
  setActiveThreadId,
  titleFromFirstMessage,
  upsertThread,
} from "../threadStorage";

/**
 * Coach conversation threads.
 *
 * These are written from the send handler, so a throw here does not lose a thread —
 * it loses the reply the athlete just waited for, and paid an LLM call for. That
 * makes the storage-unavailable paths the ones worth pinning, more than the happy
 * path they surround.
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

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", makeStore());
});

afterEach(() => vi.unstubAllGlobals());

describe("threads", () => {
  it("starts with none", () => {
    expect(listThreads()).toEqual([]);
  });

  it("creates and finds a thread", () => {
    const thread = createThread();
    upsertThread(thread);
    expect(getThread(thread.id)?.id).toBe(thread.id);
  });

  it("replaces a thread rather than duplicating it", () => {
    const thread = createThread();
    upsertThread(thread);
    upsertThread({ ...thread, title: "Renamed" });
    expect(listThreads()).toHaveLength(1);
    expect(listThreads()[0].title).toBe("Renamed");
  });

  // Most recent first: the thread list is a history, and the newest is what the
  // athlete just spoke to.
  it("lists the most recently updated first", () => {
    upsertThread({ ...createThread(), id: "a", updatedAt: "2026-01-01T00:00:00.000Z" });
    upsertThread({ ...createThread(), id: "b", updatedAt: "2026-06-01T00:00:00.000Z" });
    expect(listThreads()[0].id).toBe("b");
  });

  it("deletes a thread", () => {
    const thread = createThread();
    upsertThread(thread);
    deleteThread(thread.id);
    expect(getThread(thread.id)).toBeNull();
  });

  it("forgets the active thread when it is the one deleted", () => {
    const thread = createThread();
    upsertThread(thread);
    setActiveThreadId(thread.id);
    deleteThread(thread.id);
    expect(getActiveThreadId()).toBeNull();
  });

  // `createThread` makes the new thread active as a side effect, so the second thread
  // here is built directly rather than created — otherwise the test would be asserting
  // against an active id it had just overwritten itself.
  it("keeps the active thread when a different one is deleted", () => {
    const keep = createThread();
    upsertThread({ id: "other", title: "Other", updatedAt: keep.updatedAt, messages: [] });
    setActiveThreadId(keep.id);

    deleteThread("other");
    expect(getActiveThreadId()).toBe(keep.id);
  });

  it("makes a newly created thread the active one", () => {
    const thread = createThread();
    expect(getActiveThreadId()).toBe(thread.id);
  });

  it("caps how many threads it keeps", () => {
    for (let i = 0; i < 40; i++) {
      upsertThread({
        ...createThread(),
        id: `t${i}`,
        updatedAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
      });
    }
    expect(listThreads().length).toBeLessThanOrEqual(24);
  });
});

describe("unreadable storage", () => {
  it("treats corrupt data as no threads", () => {
    localStorage.setItem("strideiq-coach-threads-v1", "{not json");
    expect(listThreads()).toEqual([]);
  });
});

describe("when the browser refuses to store", () => {
  /**
   * The fourth module in this sweep with the same asymmetry: a guarded read path and
   * an unguarded write. Here the write path lacked even the `typeof window` check its
   * reader has, so it threw a ReferenceError during SSR as well as a quota error in
   * private browsing.
   */
  it("does not throw when a thread cannot be saved", () => {
    vi.stubGlobal("localStorage", {
      ...makeStore(),
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    });
    expect(() => upsertThread(createThread())).not.toThrow();
  });

  it("does not throw when the active thread cannot be recorded", () => {
    vi.stubGlobal("localStorage", {
      ...makeStore(),
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    });
    expect(() => setActiveThreadId("x")).not.toThrow();
  });

  it("does not throw when reading the active thread is blocked", () => {
    vi.stubGlobal("localStorage", {
      ...makeStore(),
      getItem: () => {
        throw new DOMException("SecurityError");
      },
    });
    expect(getActiveThreadId()).toBeNull();
  });

  // Every one of these is reachable during SSR, where `window` does not exist.
  it("is inert without a window", () => {
    vi.stubGlobal("window", undefined);
    expect(listThreads()).toEqual([]);
    expect(getActiveThreadId()).toBeNull();
    expect(() => setActiveThreadId("x")).not.toThrow();
    expect(() => upsertThread(createThread())).not.toThrow();
  });
});

describe("titleFromFirstMessage", () => {
  it("uses a short question as the title", () => {
    expect(titleFromFirstMessage("  How is my fitness?  ")).toBe("How is my fitness?");
  });

  it("truncates a long one rather than overflowing the sidebar", () => {
    const title = titleFromFirstMessage("x".repeat(200));
    expect(title.length).toBeLessThanOrEqual(41);
    expect(title.endsWith("…")).toBe(true);
  });

  it("keeps a title exactly at the limit intact", () => {
    const exact = "y".repeat(42);
    expect(titleFromFirstMessage(exact)).toBe(exact);
  });
});
