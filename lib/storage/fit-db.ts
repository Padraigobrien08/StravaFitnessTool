import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { FitRunDetailSchema } from "@/lib/strava/fitTypes";

const DB_NAME = "strideiq-fit-v2";
const STORE = "fitDetails";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "activityId" });
      }
    };
  });
}

export async function saveFitDetails(details: FitRunDetail[]): Promise<void> {
  return mergeFitDetails(details);
}

export async function mergeFitDetails(details: FitRunDetail[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const d of details) {
    store.put(FitRunDetailSchema.parse(d));
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFitDetail(activityId: string): Promise<FitRunDetail | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(activityId);
    req.onsuccess = () => {
      if (!req.result) resolve(null);
      else {
        try {
          resolve(FitRunDetailSchema.parse(req.result));
        } catch {
          resolve(null);
        }
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearFitDetails(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function isStaleFitDetail(detail: FitRunDetail): boolean {
  return (
    detail.paceStream.length === 0 &&
    detail.laps.length === 0 &&
    (detail.bestEfforts?.length ?? 0) === 0 &&
    (detail.gpsStream?.length ?? 0) === 0
  );
}

export async function getAllFitDetails(): Promise<FitRunDetail[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const items = (req.result as FitRunDetail[]) ?? [];
      resolve(
        items
          .map((item) => {
            try {
              return FitRunDetailSchema.parse(item);
            } catch {
              return null;
            }
          })
          .filter((x): x is FitRunDetail => x !== null),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function countStaleFitDetails(): Promise<number> {
  const all = await getAllFitDetails();
  return all.filter(isStaleFitDetail).length;
}

export async function countFitDetails(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
