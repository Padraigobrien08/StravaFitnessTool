import type { FitRunDetail } from "./fitTypes";

/** True when there is no usable stream payload at all. */
export function isEmptyFitDetail(d: FitRunDetail): boolean {
  return (
    d.paceStream.length === 0 &&
    d.hrStream.length === 0 &&
    d.laps.length === 0 &&
    (d.gpsStream?.length ?? 0) === 0
  );
}

/** Route replay needs lat/lng points aligned to the activity timeline. */
export function fitDetailHasGps(d: FitRunDetail | null | undefined): boolean {
  return (d?.gpsStream?.length ?? 0) >= 2;
}

/**
 * Strava-backed activities may have pace/HR cached from an older sync
 * before GPS mapping — refetch when GPS is missing.
 */
export function fitDetailNeedsGpsRefresh(d: FitRunDetail): boolean {
  if (isEmptyFitDetail(d)) return true;
  return (d.gpsStream?.length ?? 0) === 0;
}
