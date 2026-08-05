import type { EffortPoint } from "@/lib/analytics/predictions";

/**
 * Self-auditing calibration — score the forecaster against reality.
 *
 * A forecast is logged when made (predicting a future race). When a real effort
 * at that distance later lands, we score whether the actual fell inside the
 * predicted interval and by how much. Aggregated, this answers "when the model
 * says p10–p90, does the truth land there ~80% of the time?" — a forecaster
 * that grades itself and can be trusted (or distrusted) on evidence.
 */

export interface LoggedForecast {
  /** Deterministic: `forecast:<distanceKey>:<issueDate>` → one per distance/day. */
  forecastId: string;
  distanceKey: string;
  distanceMeters: number;
  issuedAt: string;
  mostLikelyTimeSec: number;
  p10Sec: number;
  p25Sec: number;
  p75Sec: number;
  p90Sec: number;

  // Evaluation (filled once a real effort at the distance lands after issue).
  actualTimeSec?: number;
  actualDate?: string;
  withinInterval?: boolean;
  /** actual − most-likely; positive = ran slower than predicted (model was optimistic). */
  signedErrorSec?: number;
  evaluatedAt?: string;
}

export interface CalibrationSummary {
  logged: number;
  evaluated: number;
  /** % of scored forecasts whose actual fell in p10–p90 (well-calibrated ≈ 80%). */
  withinIntervalPct: number | null;
  /** % in the tighter p25–p75 corridor (well-calibrated ≈ 50%). */
  withinP25P75Pct: number | null;
  /** Median signed error (sec); positive = model tends optimistic (predicts too fast). */
  medianSignedErrorSec: number | null;
  meanAbsErrorSec: number | null;
}

function dayIso(date: string): string {
  return date.slice(0, 10);
}

/**
 * How much slower than the pessimistic bound (p90) an effort may be and still be
 * treated as a race attempt.
 *
 * The effort set we score against (`collectEffortPoints`) is not race-only — it
 * admits any run in the distance band at up to 8:00/km, so a slow long run sits
 * in it alongside genuine races. Without this guard the first easy run past the
 * forecast date gets recorded as the athlete's result, which makes a good
 * forecast look badly optimistic and biases the whole calibration pessimistic.
 *
 * 15% separates the two populations cleanly: easy running at these distances is
 * typically 25–45% slower than race pace, while even a bad race (heat, cramp,
 * blow-up) usually lands within ~15% of p90 — so real misses are still counted.
 */
export const RACE_ATTEMPT_MAX_SLOWDOWN_VS_P90 = 0.15;

/**
 * Score a logged forecast against the earliest plausible race attempt after it
 * was issued. Earliest (not fastest) is deliberate: the race nearest the issue
 * date is the one the forecast was actually about.
 */
export function scoreForecast(f: LoggedForecast, efforts: EffortPoint[]): LoggedForecast {
  if (f.actualTimeSec != null) return f; // already scored
  const targetKm = f.distanceMeters / 1000;
  const issued = dayIso(f.issuedAt);
  const slowestCredible = f.p90Sec * (1 + RACE_ATTEMPT_MAX_SLOWDOWN_VS_P90);

  const match = efforts
    .filter(
      (e) =>
        e.timeSec > 0 &&
        Math.abs(e.distanceKm - targetKm) / targetKm <= 0.07 &&
        dayIso(e.date) > issued &&
        // Training runs in the band are not race results.
        e.timeSec <= slowestCredible,
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!match) return f;

  return {
    ...f,
    actualTimeSec: match.timeSec,
    actualDate: dayIso(match.date),
    withinInterval: match.timeSec >= f.p10Sec && match.timeSec <= f.p90Sec,
    signedErrorSec: match.timeSec - f.mostLikelyTimeSec,
    evaluatedAt: new Date().toISOString(),
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function summarizeCalibration(forecasts: LoggedForecast[]): CalibrationSummary {
  const scored = forecasts.filter((f) => f.actualTimeSec != null);
  if (scored.length === 0) {
    return {
      logged: forecasts.length,
      evaluated: 0,
      withinIntervalPct: null,
      withinP25P75Pct: null,
      medianSignedErrorSec: null,
      meanAbsErrorSec: null,
    };
  }
  const withinInterval = scored.filter((f) => f.withinInterval).length;
  const withinInner = scored.filter(
    (f) => f.actualTimeSec! >= f.p25Sec && f.actualTimeSec! <= f.p75Sec,
  ).length;
  const signed = scored.map((f) => f.signedErrorSec ?? 0);
  const absErr = signed.map((s) => Math.abs(s));

  return {
    logged: forecasts.length,
    evaluated: scored.length,
    withinIntervalPct: Math.round((withinInterval / scored.length) * 100),
    withinP25P75Pct: Math.round((withinInner / scored.length) * 100),
    medianSignedErrorSec: Math.round(median(signed)),
    meanAbsErrorSec: Math.round(absErr.reduce((a, b) => a + b, 0) / absErr.length),
  };
}
