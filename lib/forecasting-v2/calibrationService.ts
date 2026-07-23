import type { EffortPoint } from "@/lib/analytics/predictions";
import { getForecasts, logForecast, saveForecastEvaluation } from "@/lib/db/forecast-log";
import type { RaceForecastV2 } from "./forecastTypes";
import {
  scoreForecast,
  summarizeCalibration,
  type CalibrationSummary,
  type LoggedForecast,
} from "./calibration";

/** Record the current forecast for later scoring. Fire-and-forget; never throws. */
export async function logForecastForCalibration(
  userId: string,
  forecast: RaceForecastV2,
  distanceKey: string,
  now: Date = new Date(),
): Promise<void> {
  const issueDate = now.toISOString().slice(0, 10);
  const logged: LoggedForecast = {
    forecastId: `forecast:${distanceKey}:${issueDate}`,
    distanceKey,
    distanceMeters: forecast.distanceMeters,
    issuedAt: now.toISOString(),
    mostLikelyTimeSec: forecast.mostLikelyTimeSec,
    p10Sec: forecast.predictionIntervalSec.p10,
    p25Sec: forecast.predictionIntervalSec.p25,
    p75Sec: forecast.predictionIntervalSec.p75,
    p90Sec: forecast.predictionIntervalSec.p90,
  };
  try {
    await logForecast(userId, logged);
  } catch {
    /* non-fatal — logging must never break the forecast itself */
  }
}

export interface ForecastCalibrationResult {
  forecasts: LoggedForecast[];
  summary: CalibrationSummary;
}

/**
 * Load logged forecasts, score any still-pending ones against actual efforts,
 * persist newly-scored rows, and summarize how well-calibrated the model is.
 */
export async function evaluateForecastCalibration(
  userId: string,
  efforts: EffortPoint[],
): Promise<ForecastCalibrationResult> {
  const logged = await getForecasts(userId);
  const forecasts: LoggedForecast[] = [];
  for (const f of logged) {
    if (f.actualTimeSec != null) {
      forecasts.push(f);
      continue;
    }
    const scored = scoreForecast(f, efforts);
    if (scored.actualTimeSec != null) {
      try {
        await saveForecastEvaluation(userId, scored);
      } catch {
        /* non-fatal — return the in-memory score even if persistence fails */
      }
    }
    forecasts.push(scored);
  }
  return { forecasts, summary: summarizeCalibration(forecasts) };
}
