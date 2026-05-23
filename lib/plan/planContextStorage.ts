import { PLAN_CONTEXT_STORAGE_KEY } from "./planContextConstants";

function storage(): Storage | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  return globalThis.localStorage;
}

export function loadPlanContextDraft(): string {
  return storage()?.getItem(PLAN_CONTEXT_STORAGE_KEY) ?? "";
}

export function savePlanContextDraft(text: string): void {
  storage()?.setItem(PLAN_CONTEXT_STORAGE_KEY, text);
}

export function clearPlanContextDraft(): void {
  storage()?.removeItem(PLAN_CONTEXT_STORAGE_KEY);
}
