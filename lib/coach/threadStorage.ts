import type { CoachMessage } from "./types";

export interface CoachThread {
  id: string;
  title: string;
  updatedAt: string;
  messages: CoachMessage[];
}

const STORAGE_KEY = "strideiq-coach-threads-v1";
const ACTIVE_KEY = "strideiq-coach-active-v1";

function loadAll(): CoachThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CoachThread[];
  } catch {
    return [];
  }
}

/**
 * Persist the thread list, or give up quietly.
 *
 * The read path above guards `window` and wraps its parse; this did neither, so it
 * threw a ReferenceError during SSR, and a QuotaExceededError once the quota filled —
 * from inside the Coach page's send handler, taking the conversation down with it.
 * Threads accumulate without bound, so filling it is a matter of time, not of an
 * unusual browser. Losing thread history is an annoyance; losing the reply the athlete just
 * waited (and paid) for is not.
 *
 * This is the fourth module with the same asymmetry, after lib/plan, lib/storage and
 * lib/training-calendar.
 */
function saveAll(threads: CoachThread[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, 24)));
  } catch {
    /* quota exhausted or storage blocked — history is lost, the conversation is not */
  }
}

export function listThreads(): CoachThread[] {
  return loadAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getActiveThreadId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveThreadId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* the active thread simply will not be remembered across reloads */
  }
}

export function getThread(id: string): CoachThread | null {
  return loadAll().find((t) => t.id === id) ?? null;
}

export function createThread(): CoachThread {
  const thread: CoachThread = {
    id: crypto.randomUUID(),
    title: "New analysis",
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  const threads = [thread, ...loadAll()];
  saveAll(threads);
  setActiveThreadId(thread.id);
  return thread;
}

export function upsertThread(thread: CoachThread) {
  const threads = loadAll().filter((t) => t.id !== thread.id);
  saveAll([{ ...thread, updatedAt: new Date().toISOString() }, ...threads]);
}

export function deleteThread(id: string) {
  const threads = loadAll().filter((t) => t.id !== id);
  saveAll(threads);
  if (getActiveThreadId() === id) {
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* already unreachable */
    }
  }
}

export function titleFromFirstMessage(text: string): string {
  const t = text.trim();
  if (t.length <= 42) return t;
  return `${t.slice(0, 40)}…`;
}
