import type { EffortPoint } from "@/lib/analytics/predictions";

/**
 * Self-auditing calibration — score the forecaster against reality.
 *
 * A forecast is logged when made (predicting a future race). When a real effort at
 * that distance later lands, we score whether the actual fell inside the band that was
 * shown, and by how much.
 *
 * **What this measures, precisely.** An observed *hit rate*: of the forecasts scored so
 * far, the share whose outcome landed inside the band the athlete was shown. That is a
 * real, useful number. It is not a calibration check, and this module used to claim it
 * was — the header asked "when the model says p10–p90, does the truth land there ~80%
 * of the time?", and the summary fields carried "well-calibrated ≈ 80%" and "≈ 50%"
 * targets.
 *
 * Those targets were never earned. The band is not a pair of quantiles: its width is a
 * sum of hand-chosen per-driver seconds with a floor applied, spread symmetrically by
 * two fixed multipliers (see `buildPredictionInterval`). An 80% ideal follows from
 * calling something p10–p90; it does not follow from anything this engine computes. A
 * hit rate of 80% against a heuristic band would be a coincidence, not a validation,
 * and reporting it beside an "ideal" invited exactly the reading the rest of this
 * repository is careful to avoid.
 *
 * So the hit rate is still measured and still reported — with no target attached. Its
 * real job is to be the input that eventually *replaces* the heuristic: once enough
 * races are scored, the observed error distribution is what you fit quantiles to, and
 * at that point a coverage target becomes meaningful for the first time.
 *
 * See docs/LIMITATIONS.md § Race forecasting.
 */

export interface LoggedForecast {
  /** Deterministic: `forecast:<distanceKey>:<issueDate>` → one per distance/day. */
  forecastId: string;
  distanceKey: string;
  distanceMeters: number;
  issuedAt: string;
  mostLikelyTimeSec: number;
  /** Band bounds as shown to the athlete. Not quantiles — see the module header. */
  outerLowSec: number;
  innerLowSec: number;
  innerHighSec: number;
  outerHighSec: number;

  // Evaluation (filled once a real effort at the distance lands after issue).
  actualTimeSec?: number;
  actualDate?: string;
  /** Did the outcome land inside the outer band that was shown. */
  withinBand?: boolean;
  /** actual − most-likely; positive = ran slower than predicted (model was optimistic). */
  signedErrorSec?: number;
  evaluatedAt?: string;
}

export interface CalibrationSummary {
  logged: number;
  evaluated: number;
  /**
   * Observed hit rate: % of scored forecasts whose outcome fell inside the outer band.
   *
   * **No target.** There is no value this "should" be, because the band is not a
   * quantile pair. Read it as a description of what has happened so far, and as the
   * raw material for fitting a real interval later.
   */
  outerBandHitRatePct: number | null;
  /** Observed hit rate for the tighter inner band. Also has no target. */
  innerBandHitRatePct: number | null;
  /** Median signed error (sec); positive = model tends optimistic (predicts too fast). */
  medianSignedErrorSec: number | null;
  meanAbsErrorSec: number | null;
}

function dayIso(date: string): string {
  return date.slice(0, 10);
}

/**
 * How much slower than the pessimistic bound (`outerHighSec`) an effort may be and
 * still be treated as a race attempt.
 *
 * The effort set we score against (`collectEffortPoints`) is not race-only — it
 * admits any run in the distance band at up to 8:00/km, so a slow long run sits
 * in it alongside genuine races. Without this guard the first easy run past the
 * forecast date gets recorded as the athlete's result, which makes a good
 * forecast look badly optimistic and biases the whole calibration pessimistic.
 *
 * 15% separates the two populations cleanly: easy running at these distances is
 * typically 25–45% slower than race pace, while even a bad race (heat, cramp,
 * blow-up) usually lands within ~15% of the outer bound — so real misses are still
 * counted.
 */
export const RACE_ATTEMPT_MAX_SLOWDOWN_VS_OUTER_HIGH = 0.15;

/**
 * Score a logged forecast against the earliest plausible race attempt after it
 * was issued. Earliest (not fastest) is deliberate: the race nearest the issue
 * date is the one the forecast was actually about.
 */
export function scoreForecast(f: LoggedForecast, efforts: EffortPoint[]): LoggedForecast {
  if (f.actualTimeSec != null) return f; // already scored
  const targetKm = f.distanceMeters / 1000;
  const issued = dayIso(f.issuedAt);
  const slowestCredible = f.outerHighSec * (1 + RACE_ATTEMPT_MAX_SLOWDOWN_VS_OUTER_HIGH);

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
    withinBand: match.timeSec >= f.outerLowSec && match.timeSec <= f.outerHighSec,
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
      outerBandHitRatePct: null,
      innerBandHitRatePct: null,
      medianSignedErrorSec: null,
      meanAbsErrorSec: null,
    };
  }
  const withinOuter = scored.filter((f) => f.withinBand).length;
  const withinInner = scored.filter(
    (f) => f.actualTimeSec! >= f.innerLowSec && f.actualTimeSec! <= f.innerHighSec,
  ).length;
  const signed = scored.map((f) => f.signedErrorSec ?? 0);
  const absErr = signed.map((s) => Math.abs(s));

  return {
    logged: forecasts.length,
    evaluated: scored.length,
    outerBandHitRatePct: Math.round((withinOuter / scored.length) * 100),
    innerBandHitRatePct: Math.round((withinInner / scored.length) * 100),
    medianSignedErrorSec: Math.round(median(signed)),
    meanAbsErrorSec: Math.round(absErr.reduce((a, b) => a + b, 0) / absErr.length),
  };
}
