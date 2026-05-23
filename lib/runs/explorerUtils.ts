import { format, parseISO } from "date-fns";
import type { RunExplorerRow } from "./viewModels";

export type ExplorerSortKey =
  | "date"
  | "significance"
  | "distance"
  | "pace"
  | "type"
  | "load"
  | "execution";

export type QuickFilter =
  | "all"
  | "threshold"
  | "long"
  | "recovery"
  | "best_execution"
  | "high_fatigue"
  | "race_specific";

export interface ExplorerGroup {
  key: string;
  label: string;
  rows: RunExplorerRow[];
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number
): { pageRows: T[]; totalPages: number; total: number } {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * pageSize;
  return {
    pageRows: rows.slice(start, start + pageSize),
    totalPages,
    total,
  };
}

export function filterExplorerRows(
  rows: RunExplorerRow[],
  opts: {
    search: string;
    typeFilter: string;
    quickFilter: QuickFilter;
    significanceFilter: string;
    effortFilter: "all" | "easy" | "hard";
  }
): RunExplorerRow[] {
  const q = opts.search.trim().toLowerCase();
  let list = rows;

  if (q) {
    list = list.filter(
      (r) =>
        r.rawName.toLowerCase().includes(q) ||
        r.formattedTitle.primary.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        r.adaptationTags.some((t) => t.toLowerCase().includes(q)) ||
        r.dateDisplay.toLowerCase().includes(q)
    );
  }

  if (opts.typeFilter !== "all") {
    list = list.filter((r) => r.workout.type === opts.typeFilter);
  }

  if (opts.significanceFilter !== "all") {
    list = list.filter((r) => r.markers.includes(opts.significanceFilter as never));
  }

  if (opts.effortFilter === "easy") {
    list = list.filter((r) =>
      ["easy", "recovery", "long"].includes(r.workout.type)
    );
  } else if (opts.effortFilter === "hard") {
    list = list.filter((r) =>
      ["tempo", "interval", "race"].includes(r.workout.type)
    );
  }

  switch (opts.quickFilter) {
    case "threshold":
      list = list.filter((r) =>
        ["tempo", "interval"].includes(r.workout.type)
      );
      break;
    case "long":
      list = list.filter((r) => r.markers.includes("long"));
      break;
    case "recovery":
      list = list.filter((r) =>
        ["easy", "recovery"].includes(r.workout.type)
      );
      break;
    case "best_execution":
      list = list.filter(
        (r) =>
          r.markers.includes("efficient") ||
          r.executionLabel === "Excellent" ||
          r.executionLabel === "Strong"
      );
      break;
    case "high_fatigue":
      list = list.filter((r) => r.markers.includes("high_load"));
      break;
    case "race_specific":
      list = list.filter((r) =>
        ["race", "tempo", "long"].includes(r.workout.type)
      );
      break;
    default:
      break;
  }

  return list;
}

export function sortExplorerRows(
  rows: RunExplorerRow[],
  sortKey: ExplorerSortKey,
  asc: boolean
): RunExplorerRow[] {
  const list = [...rows];
  list.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "significance":
        cmp = a.significanceScore - b.significanceScore;
        break;
      case "date":
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case "distance":
        cmp = a.distanceKm - b.distanceKm;
        break;
      case "pace":
        cmp = a.paceSec - b.paceSec;
        break;
      case "type":
        cmp = a.workout.type.localeCompare(b.workout.type);
        break;
      case "load":
        cmp = (a.loadValue ?? 0) - (b.loadValue ?? 0);
        break;
      case "execution":
        cmp = a.executionRank - b.executionRank;
        break;
    }
    return asc ? cmp : -cmp;
  });
  return list;
}

export function groupExplorerRows(
  rows: RunExplorerRow[],
  mode: "month" | "none"
): ExplorerGroup[] {
  if (mode === "none") {
    return [{ key: "all", label: "All sessions", rows }];
  }

  const map = new Map<string, RunExplorerRow[]>();
  for (const row of rows) {
    const key = row.groupKey;
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, groupRows]) => ({
      key,
      label: groupRows[0]?.groupLabel ?? key,
      rows: groupRows,
    }));
}

export function monthKeyFromDate(iso: string): string {
  return format(parseISO(iso), "yyyy-MM");
}

export function monthLabelFromKey(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return format(d, "MMM yyyy");
}
