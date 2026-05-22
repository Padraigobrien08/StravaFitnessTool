import { parseNum } from "@/lib/utils";
import { parseCsvRows } from "./parseCsv";
import type { Goal } from "./types";

export function parseGoalsCsv(csvText: string): Goal[] {
  const rows = parseCsvRows(csvText);
  return rows
    .map((row) => {
      const target = parseNum(row["Goal"]);
      if (target === null) return null;
      return {
        type: row["Goal Type"]?.trim() ?? "",
        activityType: row["Activity Type"]?.trim() ?? "",
        target,
        startDate: row["Start Date"]?.trim() ?? "",
        timePeriod: row["Time Period"]?.trim() ?? "",
      };
    })
    .filter((g): g is Goal => g !== null);
}
