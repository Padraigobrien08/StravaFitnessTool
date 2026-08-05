import { create } from "zustand";
import { persist } from "zustand/middleware";
import { feelDateKey, type LegFeel, type LegFeelReport } from "@/lib/wellness/types";

/**
 * Local-first leg-feel, reconciled by recency.
 *
 * `mergeFromServer` used to adopt a server report only when no local one existed for
 * that day, so a *newer* server report lost to an older local one. Report a morning
 * "fresh" on a laptop and a post-run "heavy" on a phone, and the laptop kept showing
 * "fresh" indefinitely — the two devices never converged. `LegFeelReport` carries
 * `reportedAt` precisely so reports can be ordered, and the merge ignored it.
 *
 * Same shape as the import layer's whole-record overlay: one side's data silently wins
 * on something other than which data is better.
 */

/** Which of two reports should win. Newer `reportedAt` wins; ties keep the incumbent. */
export function isNewerReport(candidate: LegFeelReport, incumbent?: LegFeelReport): boolean {
  if (!incumbent) return true;
  const a = Date.parse(candidate.reportedAt);
  const b = Date.parse(incumbent.reportedAt);
  // An unparseable timestamp cannot be ordered, so fall back to keeping what we have
  // rather than letting NaN decide the comparison.
  if (Number.isNaN(a)) return false;
  if (Number.isNaN(b)) return true;
  return a > b;
}

interface FeelState {
  /** Reports keyed by yyyy-MM-dd. */
  byDate: Record<string, LegFeelReport>;
  /**
   * Days whose local report has not been confirmed saved. A fire-and-forget POST that
   * failed used to be lost silently — the value survived on that device and the server
   * never learned it.
   */
  pendingDates: string[];
  setFeel: (date: string, report: LegFeelReport) => void;
  /** Adopt a server report when it is newer than the local one for that day. */
  mergeFromServer: (date: string, report: LegFeelReport | null) => void;
  /** Mark a day as successfully persisted. */
  markSynced: (date: string) => void;
  /** Mark a day as needing a retry. */
  markPending: (date: string) => void;
  clear: () => void;
}

/**
 * `pendingDates` was added after `strideiq-feel-store-v1` shipped, so a rehydrated
 * payload from an existing install has no such key. Zustand's default merge keeps the
 * initializer's empty array, but a crash on an upgrade path is not worth resting on
 * that, hence the coalesce here and at every other read.
 */
const withPending = (pending: string[] | undefined, date: string) =>
  (pending ?? []).includes(date) ? (pending ?? []) : [...(pending ?? []), date];

export const useFeelStore = create<FeelState>()(
  persist(
    (set) => ({
      byDate: {},
      pendingDates: [],
      setFeel: (date, report) =>
        set((s) => ({
          byDate: { ...s.byDate, [date]: report },
          // Optimistic write: treat it as unsynced until the POST confirms.
          pendingDates: withPending(s.pendingDates, date),
        })),
      mergeFromServer: (date, report) =>
        set((s) => {
          if (!report || !isNewerReport(report, s.byDate[date])) return s;
          return {
            byDate: { ...s.byDate, [date]: report },
            // The server's copy is the newer one, so there is nothing left to push.
            pendingDates: (s.pendingDates ?? []).filter((d) => d !== date),
          };
        }),
      markSynced: (date) =>
        set((s) => ({ pendingDates: (s.pendingDates ?? []).filter((d) => d !== date) })),
      markPending: (date) => set((s) => ({ pendingDates: withPending(s.pendingDates, date) })),
      clear: () => set({ byDate: {}, pendingDates: [] }),
    }),
    { name: "strideiq-feel-store-v1" },
  ),
);

/** Selector: today's leg-feel value, or undefined. Thread this into analytics. */
export function selectTodayLegFeel(s: FeelState): LegFeel | undefined {
  return s.byDate[feelDateKey()]?.legs;
}
