"use client";

import { useCallback, useEffect } from "react";
import { useFeelStore } from "@/stores/feel-store";
import { feelDateKey, type LegFeel, type LegFeelReport } from "@/lib/wellness/types";

type FeelExtra = { niggle?: LegFeelReport["niggle"]; note?: string };

/** POST one day's report. Resolves true when the server confirms it. */
async function pushReport(date: string, report: LegFeelReport): Promise<boolean> {
  try {
    const res = await fetch("/api/me/leg-feel", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, report }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Leg-feel for a given day (defaults to today): local-first (zustand + localStorage),
 * reconciled with the server by recency on mount, and retried when a save fails.
 *
 * Two things this used to get wrong. The merge adopted a server report only when no
 * local one existed, so a newer server report lost to an older local one and two
 * devices never converged. And the POST was fire-and-forget with `.catch(() => {})`,
 * so a failed save was dropped silently — the value stayed on that device and the
 * server never learned it. Writes are now tracked in `pendingDates` and flushed on
 * mount; the store still degrades to local-only when there is no DB or no session.
 */
export function useLegFeel(dateArg?: string) {
  const date = dateArg ?? feelDateKey();
  const report = useFeelStore((s) => s.byDate[date]);
  const setFeelLocal = useFeelStore((s) => s.setFeel);
  const mergeFromServer = useFeelStore((s) => s.mergeFromServer);
  const markSynced = useFeelStore((s) => s.markSynced);
  const markPending = useFeelStore((s) => s.markPending);

  /** Push anything still unconfirmed. Reads state directly to avoid re-running on it. */
  const flushPending = useCallback(async () => {
    const { pendingDates, byDate } = useFeelStore.getState();
    for (const d of pendingDates) {
      const pending = byDate[d];
      if (!pending) {
        markSynced(d);
        continue;
      }
      if (await pushReport(d, pending)) markSynced(d);
    }
  }, [markSynced]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/me/leg-feel?date=${date}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.report) mergeFromServer(date, data.report as LegFeelReport);
      })
      .catch(() => {})
      // Retry unsynced days after reconciling, so a report the server already has
      // newer data for is not pushed back over it.
      .finally(() => {
        if (!cancelled) void flushPending();
      });
    return () => {
      cancelled = true;
    };
  }, [date, mergeFromServer, flushPending]);

  const setFeel = (
    legs: LegFeel,
    source: LegFeelReport["source"] = "morning",
    extra?: FeelExtra,
  ) => {
    // Merge onto the day's existing report so setting legs preserves a flagged
    // niggle (and vice versa); `extra` explicitly overrides.
    const next: LegFeelReport = {
      ...report,
      legs,
      source,
      reportedAt: new Date().toISOString(),
      ...(extra ?? {}),
    };
    setFeelLocal(date, next); // optimistic; also marks the day pending
    void pushReport(date, next).then((ok) => (ok ? markSynced(date) : markPending(date)));
  };

  return { legs: report?.legs, report, setFeel };
}
