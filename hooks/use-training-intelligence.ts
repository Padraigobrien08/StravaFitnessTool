"use client";

import { useMemo } from "react";
import { useStrava } from "@/lib/context/strava-context";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { generateInsights } from "@/lib/insights/generate";

/**
 * `runs` replaces what used to be `dataset`, a second copy of every run in a parallel
 * shape produced by `mapStravaImport`. One consumer read it (`/report`), and it
 * converted the fields straight back: `distanceM: r.distanceKm * 1000`. The round trip
 * cancelled itself, so the runs are handed over as parsed.
 */
export function useTrainingIntelligence() {
  const { importData, insights, loading, fitStatus } = useStrava();

  return useMemo(() => {
    if (!importData || !insights) {
      return {
        loading,
        runs: [],
        quality: null,
        insights: [],
        analytics: null,
      };
    }
    const quality = assessImportQuality(importData);
    const generated = generateInsights(insights, quality);
    return {
      loading,
      runs: importData.runs,
      quality,
      insights: generated,
      analytics: insights,
      fitRunCount: fitStatus.parsed,
    };
  }, [importData, insights, loading, fitStatus.parsed]);
}
