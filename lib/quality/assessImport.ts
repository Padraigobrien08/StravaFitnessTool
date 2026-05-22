import type { StravaImport } from "@/lib/strava/types";
import type { TrainingDataset } from "@/lib/domain/activity";
import { mapStravaImport } from "@/lib/domain/mapFromStrava";

export type ConfidenceLevel = "low" | "medium" | "high";

export interface FieldCoverage {
  label: string;
  count: number;
  total: number;
  level: ConfidenceLevel;
}

export interface ImportQualityReport {
  runCount: number;
  activityCount: number;
  fitParsed: number;
  fitReferenced: number;
  skippedFit: number;
  lastImport: string;
  exportLabel?: string;
  sportTypes: string[];
  fieldCoverage: FieldCoverage[];
  warnings: string[];
  overallConfidence: ConfidenceLevel;
}

function coverageLevel(ratio: number): ConfidenceLevel {
  if (ratio >= 0.85) return "high";
  if (ratio >= 0.5) return "medium";
  return "low";
}

export function assessImportQuality(data: StravaImport): ImportQualityReport {
  const dataset = mapStravaImport(data);
  const runs = dataset.runs;
  const total = runs.length;

  const withHr = runs.filter((r) => r.avgHeartRate != null).length;
  const withElev = runs.filter((r) => r.elevationGainM != null).length;
  const withLoad = runs.filter((r) => r.trainingLoad != null).length;
  const withCadence = runs.filter((r) => r.avgCadence != null).length;
  const withFitRef = runs.filter((r) => r.fitFilename).length;
  const fitParsed = data.fitRunIds?.length ?? 0;

  const sportSet = new Set(
    data.allActivities.map((a) => a.type).filter(Boolean)
  );

  const fieldCoverage: FieldCoverage[] = [
    {
      label: "Distance & time",
      count: total,
      total,
      level: "high",
    },
    {
      label: "Heart rate",
      count: withHr,
      total,
      level: coverageLevel(total ? withHr / total : 0),
    },
    {
      label: "Elevation",
      count: withElev,
      total,
      level: coverageLevel(total ? withElev / total : 0),
    },
    {
      label: "Training load",
      count: withLoad,
      total,
      level: coverageLevel(total ? withLoad / total : 0),
    },
    {
      label: "Cadence",
      count: withCadence,
      total,
      level: coverageLevel(total ? withCadence / total : 0),
    },
    {
      label: "FIT streams",
      count: fitParsed,
      total: withFitRef || total,
      level: coverageLevel(
        withFitRef ? fitParsed / withFitRef : fitParsed / (total || 1)
      ),
    },
  ];

  const warnings: string[] = [];
  if (withHr < total * 0.5) {
    warnings.push("Many runs lack HR — effort zones and load may be incomplete.");
  }
  if (withFitRef > 0 && fitParsed < withFitRef * 0.5) {
    warnings.push(
      `${withFitRef - fitParsed} runs reference FIT files not yet imported. Use Step 2 on Import.`
    );
  }
  if (total < 15) {
    warnings.push("Small sample size — trends and predictions are indicative only.");
  }

  const levels = fieldCoverage.map((f) => f.level);
  let overallConfidence: ConfidenceLevel = "medium";
  if (levels.filter((l) => l === "low").length >= 3) overallConfidence = "low";
  if (total >= 40 && withHr / total >= 0.85) overallConfidence = "high";

  return {
    runCount: total,
    activityCount: data.allActivities.length,
    fitParsed,
    fitReferenced: withFitRef,
    skippedFit: Math.max(0, withFitRef - fitParsed),
    lastImport: data.importedAt,
    exportLabel: data.exportLabel,
    sportTypes: [...sportSet].sort(),
    fieldCoverage,
    warnings,
    overallConfidence,
  };
}

export function formatQualitySummary(report: ImportQualityReport): string {
  const lines = [
    `${report.runCount} runs imported`,
    report.fitParsed > 0
      ? `${report.fitParsed} with FIT lap/stream data`
      : report.fitReferenced > 0
        ? `0 FIT parsed (${report.fitReferenced} referenced in CSV)`
        : null,
    `Last import: ${new Date(report.lastImport).toLocaleString()}`,
    report.sportTypes.length > 0
      ? `Sports: ${report.sportTypes.slice(0, 5).join(", ")}${report.sportTypes.length > 5 ? "…" : ""}`
      : null,
  ].filter(Boolean);
  return lines.join(" · ");
}
