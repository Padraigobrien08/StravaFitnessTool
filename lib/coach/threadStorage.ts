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

function saveAll(threads: CoachThread[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, 24)));
}

export function listThreads(): CoachThread[] {
  return loadAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getActiveThreadId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveThreadId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
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
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export function titleFromFirstMessage(text: string): string {
  const t = text.trim();
  if (t.length <= 42) return t;
  return `${t.slice(0, 40)}…`;
}
