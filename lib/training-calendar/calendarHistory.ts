import type { TrainingCalendarWeek } from "./types";

const HISTORY_KEY = "strideiq-calendar-history-v1";
const MAX_SNAPSHOTS = 5;

interface HistoryIndex {
  version: 1;
  weeks: Record<string, TrainingCalendarWeek[]>;
}

function readHistory(): HistoryIndex {
  if (typeof globalThis.localStorage === "undefined") {
    return { version: 1, weeks: {} };
  }
  try {
    const raw = globalThis.localStorage.getItem(HISTORY_KEY);
    if (!raw) return { version: 1, weeks: {} };
    const parsed = JSON.parse(raw) as HistoryIndex;
    return parsed.version === 1 && parsed.weeks ? parsed : { version: 1, weeks: {} };
  } catch {
    return { version: 1, weeks: {} };
  }
}

function writeHistory(index: HistoryIndex): void {
  if (typeof globalThis.localStorage === "undefined") return;
  globalThis.localStorage.setItem(HISTORY_KEY, JSON.stringify(index));
}

export function pushWeekSnapshot(week: TrainingCalendarWeek): void {
  const index = readHistory();
  const list = index.weeks[week.weekStart] ?? [];
  list.unshift(JSON.parse(JSON.stringify(week)) as TrainingCalendarWeek);
  index.weeks[week.weekStart] = list.slice(0, MAX_SNAPSHOTS);
  writeHistory(index);
}

export function getWeekHistory(weekStart: string): TrainingCalendarWeek[] {
  return readHistory().weeks[weekStart] ?? [];
}

export function revertCalendarWeek(weekStart: string): TrainingCalendarWeek | null {
  const index = readHistory();
  const list = index.weeks[weekStart];
  if (!list?.length) return null;
  const [previous, ...rest] = list;
  index.weeks[weekStart] = rest;
  writeHistory(index);
  return previous;
}

export function historyCount(weekStart: string): number {
  return getWeekHistory(weekStart).length;
}
