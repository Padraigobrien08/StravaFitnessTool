"use client";

import { useEffect } from "react";
import { useFeelStore } from "@/stores/feel-store";
import { feelDateKey, type LegFeel, type LegFeelReport } from "@/lib/wellness/types";

/**
 * Today's leg-feel: local-first (zustand + localStorage), reconciled with the
 * server once on mount, fire-and-forget POST on set. Degrades to local-only
 * when there's no DB / the user isn't signed in.
 */
export function useLegFeel() {
  const date = feelDateKey();
  const report = useFeelStore((s) => s.byDate[date]);
  const setFeelLocal = useFeelStore((s) => s.setFeel);
  const mergeFromServer = useFeelStore((s) => s.mergeFromServer);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/me/leg-feel?date=${date}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.report) mergeFromServer(date, data.report as LegFeelReport);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [date, mergeFromServer]);

  const setFeel = (legs: LegFeel, source: LegFeelReport["source"] = "morning") => {
    const next: LegFeelReport = { legs, source, reportedAt: new Date().toISOString() };
    setFeelLocal(date, next); // optimistic
    void fetch("/api/me/leg-feel", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, report: next }),
    }).catch(() => {});
  };

  return { legs: report?.legs, report, setFeel };
}
