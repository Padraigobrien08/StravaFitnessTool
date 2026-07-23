"use client";

import { useEffect, useState } from "react";
import type { ForecastCalibrationResult } from "@/lib/forecasting-v2/calibrationService";

/** Fetch the forecaster's self-calibration read (server-persisted) once on mount. */
export function useForecastAccuracy(enabled: boolean): ForecastCalibrationResult | null {
  const [data, setData] = useState<ForecastCalibrationResult | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch("/api/me/forecast-accuracy", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ForecastCalibrationResult | null) => {
        if (!cancelled && d?.summary) setData(d);
      })
      .catch(() => {
        /* offline / no DB — panel hides */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return data;
}
