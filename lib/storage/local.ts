import type { StravaImport } from "@/lib/strava/types";
import { StravaImportSchema } from "@/lib/strava/types";

const STORAGE_KEY = "strava-running-insights-v1";

/**
 * Persist the athlete's import.
 *
 * For an export-only athlete this key *is* the database, which also makes it the most
 * likely thing in the app to exhaust a browser storage quota. A private or ephemeral
 * window is the sharpest case, since those get a much smaller budget, but a large
 * enough export reaches the limit in an ordinary one too.
 *
 * Returns whether the write landed rather than throwing, because the caller
 * (`commitImport`) sets in-memory state first: an uncaught throw crashed the import
 * flow *and* left the context half-applied, with the data usable on screen but no
 * source flag recorded. A failed write is worth telling the athlete about — their
 * import will not survive a reload — but it is not worth losing the session they
 * already have.
 *
 * A schema violation still throws: that is a caller bug, not a browser condition.
 */
export function saveImport(data: StravaImport): boolean {
  if (typeof window === "undefined") return false;
  const parsed = StravaImportSchema.parse(data);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

export function loadImport(): StravaImport | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked by policy or private browsing: no cached import to offer.
    return null;
  }
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    return StravaImportSchema.parse(json);
  } catch {
    // Written by an older version, or truncated. Evict it so it cannot fail twice.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing more to do; the value is unreadable either way */
    }
    return null;
  }
}

export function clearImport(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* already unreachable */
  }
  void import("@/lib/storage/fit-db").then((m) => m.clearFitDetails());
}

export function hasStoredImport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
