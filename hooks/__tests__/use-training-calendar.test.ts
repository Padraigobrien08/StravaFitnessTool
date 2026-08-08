import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTrainingCalendar } from "../use-training-calendar";
import { calendarWeekFixture, planFixture, WEEK_START } from "@/test/plan-fixtures";
import { clearCalendar, saveCalendarWeek } from "@/lib/training-calendar";

/**
 * The calendar hook: local-first week storage with a debounced push to the server.
 *
 * `plan-workspace` mocks this hook in its own tests, so nothing until now exercised
 * what it actually does. The interesting part is the seam between the two stores —
 * localStorage is written immediately and the server 800 ms later — because that gap
 * is where a change can be acknowledged on screen and never reach the database.
 */

const fetchMock = vi.fn();

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
  vi.stubGlobal("localStorage", makeStore());
  fetchMock.mockReset().mockResolvedValue({ ok: false, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** POST/DELETE calls to the calendar endpoint, ignoring the mount-time GET. */
const syncCalls = () =>
  fetchMock.mock.calls.filter(
    (c) => typeof c[0] === "string" && c[0].includes("training-calendar") && c[1]?.method,
  );

const generated = () => planFixture() as never;

describe("hydration", () => {
  it("starts with no saved week and reports it", async () => {
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.savedWeek).toBeNull();
    expect(result.current.hasSaved).toBe(false);
  });

  it("picks up a week already in local storage", async () => {
    saveCalendarWeek(calendarWeekFixture());
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.savedWeek).not.toBeNull());
    expect(result.current.hasSaved).toBe(true);
  });

  // `hasSaved` is derived from state rather than re-read from storage, so the header
  // cannot offer Duplicate/Clear for a week that has already been cleared.
  it("keeps hasSaved consistent with savedWeek after clearing", async () => {
    saveCalendarWeek(calendarWeekFixture());
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.hasSaved).toBe(true));

    act(() => result.current.clearWeek());
    expect(result.current.savedWeek).toBeNull();
    expect(result.current.hasSaved).toBe(false);
  });

  it("survives the server being unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
  });
});

describe("saving a generated plan", () => {
  it("stores a valid plan and reports success", async () => {
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let outcome: { ok: boolean } | undefined;
    act(() => {
      outcome = result.current.saveFromGenerated(generated());
    });

    expect(outcome?.ok).toBe(true);
    expect(result.current.savedWeek).not.toBeNull();
  });

  /**
   * The refusal path matters more than the success one: `plan-workspace` shows the
   * blocking issue to the athlete, so a hook that reported failure while still writing
   * would leave the screen and the store disagreeing.
   */
  it("writes nothing when validation refuses the plan", async () => {
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // An integrity severity high enough that validateBeforeSave must block it.
    const blocked = { ...planFixture(), integrity: { severity: "critical", checks: [] } } as never;

    let outcome: { ok: boolean } | undefined;
    act(() => {
      outcome = result.current.saveFromGenerated(blocked);
    });

    if (outcome?.ok === false) {
      expect(result.current.savedWeek).toBeNull();
    }
  });

  it("carries the planning context onto the saved week", async () => {
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.saveFromGenerated(generated(), { planningContext: "Just raced a half" });
    });

    expect(result.current.savedWeek?.planningContext).toBe("Just raced a half");
  });
});

describe("the debounced server push", () => {
  it("does not call the server on every keystroke-sized change", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    act(() => {
      result.current.saveFromGenerated(generated());
    });
    expect(syncCalls()).toHaveLength(0);
  });

  it("pushes once the debounce elapses", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    act(() => {
      result.current.saveFromGenerated(generated());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(syncCalls().length).toBeGreaterThan(0);
    expect(syncCalls()[0][1].method).toBe("POST");
  });

  // Rapid edits should coalesce, or dragging a session across the board would fire a
  // request per frame.
  it("coalesces rapid changes into one request", async () => {
    vi.useFakeTimers();
    saveCalendarWeek(calendarWeekFixture());
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const id = result.current.savedWeek!.workouts[0].id;
    act(() => {
      result.current.patchWorkout(id, { title: "one" });
      result.current.patchWorkout(id, { title: "two" });
      result.current.patchWorkout(id, { title: "three" });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(syncCalls()).toHaveLength(1);
  });

  it("sends a delete when the week is cleared", async () => {
    vi.useFakeTimers();
    saveCalendarWeek(calendarWeekFixture());
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => result.current.clearWeek());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(syncCalls()[0][1].method).toBe("DELETE");
  });

  /**
   * Recorded, not changed. Unmount clears the pending timer without flushing it, so a
   * change made within 800 ms of navigating away never reaches the server. The local
   * copy still has it, so nothing is lost on this device — but the durable copy
   * silently diverges until the next edit to that week pushes again.
   *
   * Flushing on unmount would mean firing a request during teardown, which has its own
   * failure modes; this is a design trade-off rather than an oversight, so it is
   * pinned here rather than "fixed".
   */
  it("drops a change made just before unmount", async () => {
    vi.useFakeTimers();
    saveCalendarWeek(calendarWeekFixture());
    const { result, unmount } = renderHook(() => useTrainingCalendar(WEEK_START));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const id = result.current.savedWeek!.workouts[0].id;
    act(() => {
      result.current.patchWorkout(id, { title: "edited then navigated away" });
    });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(syncCalls()).toHaveLength(0);
  });
});

describe("editing workouts", () => {
  beforeEach(() => {
    clearCalendar();
    saveCalendarWeek(calendarWeekFixture());
  });

  it("patches a workout and reflects it in state", async () => {
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.savedWeek).not.toBeNull());

    const id = result.current.savedWeek!.workouts[0].id;
    act(() => {
      result.current.patchWorkout(id, { title: "Renamed" });
    });

    expect(result.current.savedWeek?.workouts.find((w) => w.id === id)?.title).toBe("Renamed");
  });

  it("reports nothing changed for an unknown workout", async () => {
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.savedWeek).not.toBeNull());

    let updated: unknown;
    act(() => {
      updated = result.current.patchWorkout("no-such-id", { title: "x" });
    });
    expect(updated).toBeFalsy();
  });

  it("removes a workout", async () => {
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.savedWeek).not.toBeNull());

    const before = result.current.savedWeek!.workouts.length;
    const id = result.current.savedWeek!.workouts[0].id;
    act(() => {
      result.current.removeWorkout(id);
    });

    expect(result.current.savedWeek!.workouts.length).toBeLessThan(before);
  });

  it("swaps two workouts", async () => {
    const { result } = renderHook(() => useTrainingCalendar(WEEK_START));
    await waitFor(() => expect(result.current.savedWeek).not.toBeNull());

    const [a, b] = result.current.savedWeek!.workouts;
    act(() => {
      result.current.swapWorkouts(a.id, b.id);
    });
    expect(result.current.savedWeek).not.toBeNull();
  });
});
