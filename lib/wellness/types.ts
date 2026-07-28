import { format } from "date-fns";

/** The runner's subjective read on their legs for the day. */
export type LegFeel = "fresh" | "normal" | "heavy";

export interface LegFeelReport {
  legs: LegFeel;
  /** Optional niggle flag — Phase 2. A flag, not a diagnosis. */
  niggle?: { area: string; severity: 1 | 2 | 3 } | null;
  /** Optional free note — Phase 2. */
  note?: string;
  source: "morning" | "post_run";
  /** ISO timestamp of when the report was made. */
  reportedAt: string;
}

/** localStorage / DB key for a day (local time). Defaults to today. */
export function feelDateKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}
