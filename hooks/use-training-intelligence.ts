"use client";

import { useMemo } from "react";
import { useStrava } from "@/lib/context/strava-context";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { generateInsights } from "@/lib/insights/generate";
import { mapStravaImport } from "@/lib/domain/mapFromStrava";

export function useTrainingIntelligence() {
  const { importData, insights, loading, fitStatus } = useStrava();

  return useMemo(() => {
    if (!importData || !insights) {
      return {
        loading,
        dataset: null,
        quality: null,
        insights: [],
        analytics: null,
      };
    }
    const quality = assessImportQuality(importData);
    const generated = generateInsights(insights, quality);
    return {
      loading,
      dataset: mapStravaImport(importData),
      quality,
      insights: generated,
      analytics: insights,
      fitRunCount: fitStatus.parsed,
    };
  }, [importData, insights, loading, fitStatus.parsed]);
}
