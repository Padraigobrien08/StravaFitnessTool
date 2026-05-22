import type { StravaImport } from "@/lib/strava/types";
import { StravaImportSchema } from "@/lib/strava/types";

const STORAGE_KEY = "strava-running-insights-v1";

export function saveImport(data: StravaImport): void {
  if (typeof window === "undefined") return;
  const parsed = StravaImportSchema.parse(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}

export function loadImport(): StravaImport | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    return StravaImportSchema.parse(json);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearImport(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  void import("@/lib/storage/fit-db").then((m) => m.clearFitDetails());
}

export function hasStoredImport(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}
