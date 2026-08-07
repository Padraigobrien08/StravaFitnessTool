import { PLAN_CONTEXT_STORAGE_KEY } from "./planContextConstants";

/**
 * Draft storage for the planning-context box.
 *
 * Every call is wrapped, because `localStorage` is not the reliable synchronous store
 * it looks like: `setItem` throws on quota exhaustion, and Safari in private browsing
 * throws from `getItem` and `setItem` alike. This module is called on **every
 * keystroke** in the planning-context field, so an uncaught throw is not a lost draft —
 * it is an exception inside a React effect while someone is typing, which takes the
 * plan page down with it.
 *
 * Losing a draft is a recoverable annoyance. Losing the page is not, so every failure
 * degrades to "no draft" rather than propagating.
 */

function storage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    // Reading the property itself throws when storage is disabled by policy.
    return null;
  }
}

export function loadPlanContextDraft(): string {
  try {
    return storage()?.getItem(PLAN_CONTEXT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePlanContextDraft(text: string): void {
  try {
    storage()?.setItem(PLAN_CONTEXT_STORAGE_KEY, text);
  } catch {
    /* quota exhausted or storage blocked — a draft is not worth an exception */
  }
}

export function clearPlanContextDraft(): void {
  try {
    storage()?.removeItem(PLAN_CONTEXT_STORAGE_KEY);
  } catch {
    /* nothing to do: the draft is already unreachable */
  }
}
