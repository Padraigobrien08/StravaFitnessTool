import type { StravaImport } from "@/lib/strava/types";
import { classifyActivityModality } from "./modality";
import { modalityCoverageFromDistribution } from "./archetype";
import type { ActivityModality, ModalityCoverage } from "./types";

export function modalityCoverageFromImport(data: StravaImport): ModalityCoverage {
  const dist: Partial<Record<ActivityModality, number>> = {};
  for (const a of data.allActivities) {
    const m = classifyActivityModality(a.type);
    dist[m] = (dist[m] ?? 0) + 1;
  }
  return modalityCoverageFromDistribution(dist);
}

export interface ModalityCoverageRow {
  id: string;
  label: string;
  count: number;
}

export function modalityCoverageRows(coverage: ModalityCoverage): ModalityCoverageRow[] {
  const rows: ModalityCoverageRow[] = [
    { id: "running", label: "Running", count: coverage.running },
    { id: "cycling", label: "Cycling", count: coverage.cycling },
    { id: "swim", label: "Swim", count: coverage.swim },
    { id: "strength", label: "Strength", count: coverage.strength },
    {
      id: "mobility",
      label: "Mobility / recovery",
      count: coverage.mobilityRecovery,
    },
    { id: "hiit", label: "HIIT / CrossFit", count: coverage.hiitCrossfit },
    {
      id: "outdoor",
      label: "Outdoor endurance",
      count: coverage.outdoorEndurance,
    },
    { id: "sport", label: "Sport", count: coverage.sport },
    { id: "unknown", label: "Unclassified", count: coverage.unknown },
  ];
  return rows.filter((r) => r.count > 0);
}
