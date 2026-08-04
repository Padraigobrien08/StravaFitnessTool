import type { DashboardInsights } from "@/lib/analytics";
import { hrCoveragePct } from "@/lib/analytics/intensityAdvisor";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import type { RunActivity } from "@/lib/strava/types";
import type { CoachingDataQuality, CoverageLevel } from "./types";

function levelFromRatio(ratio: number): CoverageLevel {
  if (ratio >= 0.75) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

export function buildDataQualityContext(
  insights: DashboardInsights,
  quality: ImportQualityReport,
  runs?: RunActivity[],
): CoachingDataQuality {
  const hrPct = hrCoveragePct(runs ?? []) / 100;
  const withStreams = insights.trainingEcosystem.activities.filter((a) => a.hasStreams).length;
  const streamRatio =
    insights.trainingEcosystem.activities.length > 0
      ? withStreams / insights.trainingEcosystem.activities.length
      : 0;

  const limitations: string[] = [
    ...quality.warnings.slice(0, 3),
    ...insights.trainingEcosystem.limitations.slice(0, 3),
  ];
  if (insights.dataConfidence === "low") {
    limitations.push("Overall analytics confidence is low: treat coaching as directional.");
  }
  if (quality.overallConfidence === "low") {
    limitations.push("Import quality is limited (sparse HR, streams, or history).");
  }

  const unique = [...new Set(limitations)].slice(0, 6);

  return {
    activityCount: quality.activityCount,
    hrCoverage: levelFromRatio(hrPct),
    streamCoverage: levelFromRatio(streamRatio),
    confidenceLimitations: unique,
  };
}
