import { create } from "zustand";
import { persist } from "zustand/middleware";
import { feelDateKey, type LegFeel, type LegFeelReport } from "@/lib/wellness/types";

interface FeelState {
  /** Reports keyed by yyyy-MM-dd. */
  byDate: Record<string, LegFeelReport>;
  setFeel: (date: string, report: LegFeelReport) => void;
  /** Adopt a server value only if we don't already have a local one for that day. */
  mergeFromServer: (date: string, report: LegFeelReport | null) => void;
  clear: () => void;
}

export const useFeelStore = create<FeelState>()(
  persist(
    (set) => ({
      byDate: {},
      setFeel: (date, report) => set((s) => ({ byDate: { ...s.byDate, [date]: report } })),
      mergeFromServer: (date, report) =>
        set((s) => (report && !s.byDate[date] ? { byDate: { ...s.byDate, [date]: report } } : s)),
      clear: () => set({ byDate: {} }),
    }),
    { name: "strideiq-feel-store-v1" },
  ),
);

/** Selector: today's leg-feel value, or undefined. Thread this into analytics. */
export function selectTodayLegFeel(s: FeelState): LegFeel | undefined {
  return s.byDate[feelDateKey()]?.legs;
}
