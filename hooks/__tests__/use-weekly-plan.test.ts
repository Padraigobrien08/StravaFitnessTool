import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWeeklyPlan } from "../use-weekly-plan";
import { PLAN_CONTEXT_MAX_CHARS } from "@/lib/plan/planContextConstants";

/**
 * The plan-generation state machine.
 *
 * Everything the plan page shows on failure comes from here: `error` supplies the
 * message and `errorStatus` decides how it is framed, because "Unauthorized" rendered
 * verbatim is not an explanation. So the paths worth pinning are the unhappy ones,
 * and in particular whether the status survives to the UI at all.
 */

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** What a proxy or gateway returns: a status, and a body that is not JSON. */
function nonJsonResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON at position 0");
    },
  };
}

const okPlan = () =>
  jsonResponse({
    plan: { weekStart: "2026-03-09", workouts: [] },
    guardrails: { constraintNotes: [] },
    source: "llm",
    validation: { issues: [] },
    integrity: { severity: "none" },
  });

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(okPlan());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

/** The parsed request body of the nth call. */
const sentBody = (n = 0) => JSON.parse(fetchMock.mock.calls[n][1].body as string);

describe("generating", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useWeeklyPlan());
    expect(result.current).toMatchObject({ loading: false, error: null, result: null });
  });

  it("returns the plan and stores it", async () => {
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.result?.source).toBe("llm");
    expect(result.current.loading).toBe(false);
  });

  it("asks for the deterministic plan when told to", async () => {
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate({ forceFallback: true });
    });
    expect(sentBody().forceFallback).toBe(true);
  });

  it("omits an empty planning context rather than sending a blank string", async () => {
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate({ planningContext: "   " });
    });
    expect(sentBody().planningContext).toBeUndefined();
  });

  // The context is interpolated into a prompt, so the cap has to hold at this layer
  // too rather than relying on the textarea's maxLength.
  it("caps an over-long planning context", async () => {
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate({ planningContext: "x".repeat(PLAN_CONTEXT_MAX_CHARS + 500) });
    });
    expect(sentBody().planningContext.length).toBe(PLAN_CONTEXT_MAX_CHARS);
  });

  /**
   * `plan-workspace` falls back to this when saving a plan the athlete has not
   * re-typed context for, so it must outlive a later context-free generation.
   */
  it("remembers the last context that was actually given", async () => {
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate({ planningContext: "Just raced a half" });
    });
    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.lastPlanningContext).toBe("Just raced a half");
  });
});

describe("failure", () => {
  it("surfaces the API's message rather than a generic one", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "No training data" }, 422));
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.error).toBe("No training data");
  });

  it("keeps the status so the UI can frame the failure", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.errorStatus).toBe(401);
  });

  it("returns null rather than throwing at the call site", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "nope" }, 500));
    const { result } = renderHook(() => useWeeklyPlan());
    let returned: unknown = "unset";
    await act(async () => {
      returned = await result.current.generate();
    });
    expect(returned).toBeNull();
  });

  it("stops loading even when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("offline");
  });

  /**
   * A gateway timeout or proxy error returns a status with an HTML body. `res.json()`
   * is awaited *before* the `!res.ok` branch, so parsing throws first and
   * `setErrorStatus` never runs — the status is lost exactly when the UI most needs
   * it to say "the planner is unavailable" rather than showing a JSON parse error.
   */
  it("keeps the status when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(nonJsonResponse(502));
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.errorStatus).toBe(502);
  });

  it("clears a previous error when a retry succeeds", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.error).not.toBeNull();

    fetchMock.mockResolvedValue(okPlan());
    await act(async () => {
      await result.current.generate();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.errorStatus).toBeNull();
  });
});

describe("reset", () => {
  it("clears the preview and the error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate();
    });

    act(() => result.current.reset());
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.errorStatus).toBeNull();
  });

  // Deliberately kept: the workspace still needs it to label a week it is saving.
  it("does not forget the planning context", async () => {
    const { result } = renderHook(() => useWeeklyPlan());
    await act(async () => {
      await result.current.generate({ planningContext: "Traveling all week" });
    });

    act(() => result.current.reset());
    expect(result.current.lastPlanningContext).toBe("Traveling all week");
  });
});
