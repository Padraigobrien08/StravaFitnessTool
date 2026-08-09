import { afterAll, describe, expect, it } from "vitest";
import { hasTestDb } from "./testDatabase";
import { getSql } from "../client";
import { getForecasts, logForecast, saveForecastEvaluation } from "../forecast-log";
import type { LoggedForecast } from "@/lib/forecasting-v2/calibration";

// Opt-in and local-only: these tests DELETE rows. See testDatabase.ts.
const hasDb = hasTestDb;
const TEST_USER = "00000000-0000-0000-0000-0000000000f7";
const FC_ID = "forecast:hm:2026-05-01";

function makeForecast(overrides: Partial<LoggedForecast> = {}): LoggedForecast {
  return {
    forecastId: FC_ID,
    distanceKey: "hm",
    distanceMeters: 21097,
    issuedAt: "2026-05-01T08:00:00.000Z",
    mostLikelyTimeSec: 5400,
    outerLowSec: 5250,
    innerLowSec: 5330,
    innerHighSec: 5470,
    outerHighSec: 5550,
    ...overrides,
  };
}

describe.skipIf(!hasDb)("forecast-log DB persistence", () => {
  afterAll(async () => {
    try {
      await getSql()`DELETE FROM forecast_log WHERE user_id = ${TEST_USER}::uuid`;
      await getSql()`DELETE FROM users WHERE id = ${TEST_USER}::uuid`.catch(() => {});
    } catch {
      /* ignore cleanup errors */
    }
  });

  it("logs a forecast and reads it back", async () => {
    await getSql()`
      INSERT INTO users (id, email) VALUES (${TEST_USER}::uuid, 'f7-test@example.com')
      ON CONFLICT (id) DO NOTHING
    `;
    await logForecast(TEST_USER, makeForecast());
    const found = (await getForecasts(TEST_USER)).find((f) => f.forecastId === FC_ID);
    expect(found).toBeDefined();
    expect(found!.mostLikelyTimeSec).toBe(5400);
    expect(found!.actualTimeSec).toBeUndefined();
  });

  it("logging is idempotent (first write wins)", async () => {
    await logForecast(TEST_USER, makeForecast({ mostLikelyTimeSec: 9999 }));
    const matching = (await getForecasts(TEST_USER)).filter((f) => f.forecastId === FC_ID);
    expect(matching).toHaveLength(1);
    expect(matching[0].mostLikelyTimeSec).toBe(5400);
  });

  it("saveForecastEvaluation writes back the score", async () => {
    await saveForecastEvaluation(TEST_USER, {
      ...makeForecast(),
      actualTimeSec: 5420,
      actualDate: "2026-06-10",
      withinBand: true,
      signedErrorSec: 20,
      evaluatedAt: "2026-06-11T00:00:00.000Z",
    });
    const found = (await getForecasts(TEST_USER)).find((f) => f.forecastId === FC_ID)!;
    expect(found.actualTimeSec).toBe(5420);
    expect(found.withinBand).toBe(true);
  });
});
