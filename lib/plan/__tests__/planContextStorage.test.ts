import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPlanContextDraft,
  loadPlanContextDraft,
  savePlanContextDraft,
} from "../planContextStorage";
import { PLAN_CONTEXT_STORAGE_KEY } from "../planContextConstants";

/**
 * The planning-context draft, saved on every keystroke.
 *
 * That cadence is what makes the failure modes matter: anything that throws here
 * throws inside a React effect on each character typed, which takes down the plan
 * page rather than losing a draft. `localStorage.setItem` throws on quota exhaustion
 * and in Safari private browsing, neither of which is exotic.
 */

function makeStorage(overrides: Partial<Storage> = {}) {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
    ...overrides,
  } as Storage;
}

afterEach(() => vi.unstubAllGlobals());

describe("with working storage", () => {
  beforeEach(() => vi.stubGlobal("localStorage", makeStorage()));

  it("returns an empty draft before anything is saved", () => {
    expect(loadPlanContextDraft()).toBe("");
  });

  it("round-trips a draft", () => {
    savePlanContextDraft("Just raced a half");
    expect(loadPlanContextDraft()).toBe("Just raced a half");
  });

  it("clears a draft", () => {
    savePlanContextDraft("something");
    clearPlanContextDraft();
    expect(loadPlanContextDraft()).toBe("");
  });

  it("uses the shared key, so the component and storage agree", () => {
    savePlanContextDraft("x");
    expect(localStorage.getItem(PLAN_CONTEXT_STORAGE_KEY)).toBe("x");
  });
});

describe("server-side rendering", () => {
  // Reachable during SSR, where localStorage does not exist. Must no-op rather than
  // throw, or the page fails to render at all.
  it("is inert without localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadPlanContextDraft()).toBe("");
    expect(() => savePlanContextDraft("x")).not.toThrow();
    expect(() => clearPlanContextDraft()).not.toThrow();
  });
});

describe("when the browser refuses to store", () => {
  /**
   * Safari in private browsing, and any browser at quota, throw from `setItem`. This
   * runs on every keystroke in the planning-context box, so an uncaught throw here is
   * not a lost draft — it is an exception inside a React effect while someone types.
   */
  it("does not throw when the quota is exhausted", () => {
    vi.stubGlobal(
      "localStorage",
      makeStorage({
        setItem: () => {
          throw new DOMException("QuotaExceededError");
        },
      }),
    );
    expect(() => savePlanContextDraft("a long planning note")).not.toThrow();
  });

  it("does not throw when reading is blocked", () => {
    vi.stubGlobal(
      "localStorage",
      makeStorage({
        getItem: () => {
          throw new DOMException("SecurityError");
        },
      }),
    );
    expect(() => loadPlanContextDraft()).not.toThrow();
    expect(loadPlanContextDraft()).toBe("");
  });

  it("does not throw when clearing is blocked", () => {
    vi.stubGlobal(
      "localStorage",
      makeStorage({
        removeItem: () => {
          throw new DOMException("SecurityError");
        },
      }),
    );
    expect(() => clearPlanContextDraft()).not.toThrow();
  });
});
