import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLegFeel } from "../use-leg-feel";
import { useFeelStore } from "@/stores/feel-store";
import type { LegFeelReport } from "@/lib/wellness/types";

/**
 * Leg feel: the one input an athlete gives that no sensor can, feeding the readiness
 * model directly.
 *
 * The behaviours worth pinning are the two this used to get wrong (§D-4). The merge
 * adopted a server report only when no local one existed, so a newer server value lost
 * to an older local one and two devices never converged. And the POST was
 * fire-and-forget, so a failed save vanished — the value stayed on that device and the
 * server never learned it.
 */

const fetchMock = vi.fn();
const DATE = "2026-03-09";

const report = (overrides: Partial<LegFeelReport> = {}): LegFeelReport => ({
  legs: "normal",
  source: "morning",
  reportedAt: "2026-03-09T07:00:00.000Z",
  ...overrides,
});

/** A GET that returns nothing, so mount does not overwrite local state. */
const emptyGet = () => ({ ok: true, json: async () => ({ report: null }) });
const okPost = () => ({ ok: true, json: async () => ({}) });

function resetStore() {
  useFeelStore.setState({ byDate: {}, pendingDates: [] } as never);
}

beforeEach(() => {
  resetStore();
  fetchMock
    .mockReset()
    .mockImplementation((_url: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "POST" ? okPost() : emptyGet()),
    );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetStore();
});

const posts = () => fetchMock.mock.calls.filter((c) => c[1]?.method === "POST");
const postedReport = (n = 0) => JSON.parse(posts()[n][1].body as string).report as LegFeelReport;

describe("recording a feel", () => {
  it("has nothing before the athlete says anything", async () => {
    const { result } = renderHook(() => useLegFeel(DATE));
    expect(result.current.legs).toBeUndefined();
  });

  it("records the value locally and pushes it", async () => {
    const { result } = renderHook(() => useLegFeel(DATE));
    act(() => result.current.setFeel("heavy"));

    expect(result.current.legs).toBe("heavy");
    await waitFor(() => expect(posts().length).toBeGreaterThan(0));
    expect(postedReport().legs).toBe("heavy");
  });

  it("stamps when it was reported", async () => {
    const { result } = renderHook(() => useLegFeel(DATE));
    act(() => result.current.setFeel("fresh"));
    expect(Date.parse(result.current.report!.reportedAt)).not.toBeNaN();
  });

  /**
   * The card calls `setFeel(legs)` and `setFeel(legs, source, { niggle })` from two
   * different controls, so each must merge onto the day rather than replace it —
   * otherwise flagging a niggle would erase the leg-feel the athlete just gave.
   */
  it("keeps a flagged niggle when the feel changes", async () => {
    const { result } = renderHook(() => useLegFeel(DATE));
    act(() =>
      result.current.setFeel("normal", "morning", { niggle: { area: "Achilles", severity: 2 } }),
    );
    act(() => result.current.setFeel("heavy"));

    expect(result.current.report?.niggle).toMatchObject({ area: "Achilles" });
    expect(result.current.legs).toBe("heavy");
  });

  it("lets an explicit null clear the niggle", async () => {
    const { result } = renderHook(() => useLegFeel(DATE));
    act(() =>
      result.current.setFeel("normal", "morning", { niggle: { area: "Calf", severity: 1 } }),
    );
    act(() => result.current.setFeel("normal", "morning", { niggle: null }));

    expect(result.current.report?.niggle).toBeNull();
  });
});

describe("when the save fails", () => {
  /**
   * The D-4 defect: the POST was fire-and-forget, so a failure left the value on this
   * device and nowhere else, with nothing to retry it. The day is now marked pending
   * and flushed on the next mount.
   */
  it("keeps the day pending so it can be retried", async () => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.resolve({ ok: false, status: 500 })
        : Promise.resolve(emptyGet()),
    );

    const { result } = renderHook(() => useLegFeel(DATE));
    act(() => result.current.setFeel("heavy"));

    await waitFor(() => expect(useFeelStore.getState().pendingDates).toContain(DATE));
  });

  it("does not lose the value locally", async () => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === "POST" ? Promise.reject(new Error("offline")) : Promise.resolve(emptyGet()),
    );

    const { result } = renderHook(() => useLegFeel(DATE));
    act(() => result.current.setFeel("fresh"));
    expect(result.current.legs).toBe("fresh");
  });

  it("retries a pending day on the next mount", async () => {
    useFeelStore.setState({
      byDate: { [DATE]: report({ legs: "heavy" }) },
      pendingDates: [DATE],
    } as never);

    renderHook(() => useLegFeel(DATE));
    await waitFor(() => expect(posts().length).toBeGreaterThan(0));
    await waitFor(() => expect(useFeelStore.getState().pendingDates).not.toContain(DATE));
  });

  // A pending date with no report behind it would retry forever.
  it("drops a pending day whose report has gone", async () => {
    useFeelStore.setState({ byDate: {}, pendingDates: [DATE] } as never);

    renderHook(() => useLegFeel(DATE));
    await waitFor(() => expect(useFeelStore.getState().pendingDates).not.toContain(DATE));
    expect(posts()).toHaveLength(0);
  });
});

describe("reconciling with the server", () => {
  it("adopts a server report when there is nothing local", async () => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.resolve(okPost())
        : Promise.resolve({ ok: true, json: async () => ({ report: report({ legs: "fresh" }) }) }),
    );

    const { result } = renderHook(() => useLegFeel(DATE));
    await waitFor(() => expect(result.current.legs).toBe("fresh"));
  });

  /**
   * The other half of D-4. A newer server report must win over an older local one, or
   * two devices never converge — the device that reported first keeps overwriting the
   * one that reported last.
   */
  it("prefers the newer report, whichever side it came from", async () => {
    useFeelStore.setState({
      byDate: { [DATE]: report({ legs: "normal", reportedAt: "2026-03-09T06:00:00.000Z" }) },
      pendingDates: [],
    } as never);

    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.resolve(okPost())
        : Promise.resolve({
            ok: true,
            json: async () => ({
              report: report({ legs: "heavy", reportedAt: "2026-03-09T09:00:00.000Z" }),
            }),
          }),
    );

    const { result } = renderHook(() => useLegFeel(DATE));
    await waitFor(() => expect(result.current.legs).toBe("heavy"));
  });

  it("keeps a newer local report over an older server one", async () => {
    useFeelStore.setState({
      byDate: { [DATE]: report({ legs: "heavy", reportedAt: "2026-03-09T09:00:00.000Z" }) },
      pendingDates: [],
    } as never);

    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.resolve(okPost())
        : Promise.resolve({
            ok: true,
            json: async () => ({
              report: report({ legs: "fresh", reportedAt: "2026-03-09T06:00:00.000Z" }),
            }),
          }),
    );

    const { result } = renderHook(() => useLegFeel(DATE));
    await waitFor(() => expect(result.current.legs).toBe("heavy"));
  });

  // Export-only mode has no database, so the endpoint 404s. That is not an error.
  it("works with no server at all", async () => {
    fetchMock.mockRejectedValue(new Error("no database"));
    const { result } = renderHook(() => useLegFeel(DATE));
    act(() => result.current.setFeel("normal"));
    expect(result.current.legs).toBe("normal");
  });
});
