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

/**
 * Persist the history index, or give up quietly.
 *
 * `readHistory` above is wrapped and this was not, which made the asymmetry look
 * deliberate rather than overlooked. It is not survivable: `pushWeekSnapshot` runs
 * immediately before `clearWeek()` in the plan workspace, so a quota error threw out
 * of the click handler — the athlete pressed "Clear", got an exception instead of a
 * cleared week, and took the page down with it.
 *
 * Losing the ability to undo is worth a great deal less than losing the action itself,
 * so a failed write degrades to "no history" and the clear proceeds.
 */
function writeHistory(index: HistoryIndex): void {
  try {
    if (typeof globalThis.localStorage === "undefined") return;
    globalThis.localStorage.setItem(HISTORY_KEY, JSON.stringify(index));
  } catch {
    /* quota exhausted or storage blocked — undo is unavailable, the action is not */
  }
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
