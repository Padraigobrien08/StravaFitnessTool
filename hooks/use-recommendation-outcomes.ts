"use client";

import { useEffect, useState } from "react";
import type { RecommendationOutcomesResult } from "@/lib/recommendation-outcomes/service";

/** Fetch recommendation-outcome tracking (server-persisted) once on mount. */
export function useRecommendationOutcomes(enabled: boolean): RecommendationOutcomesResult | null {
  const [data, setData] = useState<RecommendationOutcomesResult | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch("/api/me/recommendation-outcomes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RecommendationOutcomesResult | null) => {
        if (!cancelled && d?.recommendations) setData(d);
      })
      .catch(() => {
        /* offline / no DB — panel simply hides */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return data;
}
