import { getSql } from "./client";
import type { LoggedForecast } from "@/lib/forecasting-v2/calibration";

let ensured = false;

/** Creates the forecast log table if migration 007 was not applied yet. */
export async function ensureForecastLogSchema(): Promise<void> {
  if (ensured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS forecast_log (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      forecast_id TEXT NOT NULL,
      record JSONB NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, forecast_id)
    )
  `;
  ensured = true;
}

/** Record a forecast at the moment it is shown. First write wins (idempotent). */
export async function logForecast(userId: string, forecast: LoggedForecast): Promise<void> {
  await ensureForecastLogSchema();
  const sql = getSql();
  await sql`
    INSERT INTO forecast_log (user_id, forecast_id, record, issued_at, updated_at)
    VALUES (${userId}::uuid, ${forecast.forecastId}, ${JSON.stringify(forecast)}::jsonb, NOW(), NOW())
    ON CONFLICT (user_id, forecast_id) DO NOTHING
  `;
}

/** All logged forecasts for a user, newest first. Returns [] on DB failure. */
export async function getForecasts(userId: string): Promise<LoggedForecast[]> {
  try {
    await ensureForecastLogSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT record FROM forecast_log
      WHERE user_id = ${userId}::uuid
      ORDER BY issued_at DESC
    `;
    return rows.map((r) => (r as { record: LoggedForecast }).record);
  } catch {
    return [];
  }
}

/** Write back a scored forecast (actual effort matched). */
export async function saveForecastEvaluation(
  userId: string,
  forecast: LoggedForecast,
): Promise<void> {
  await ensureForecastLogSchema();
  const sql = getSql();
  await sql`
    INSERT INTO forecast_log (user_id, forecast_id, record, updated_at)
    VALUES (${userId}::uuid, ${forecast.forecastId}, ${JSON.stringify(forecast)}::jsonb, NOW())
    ON CONFLICT (user_id, forecast_id) DO UPDATE SET
      record = EXCLUDED.record,
      updated_at = NOW()
  `;
}
