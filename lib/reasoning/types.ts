import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { RunActivity } from "@/lib/strava/types";
import type { WorkoutClassification } from "@/lib/analytics/workoutType";
import type { IntelligenceConfidence } from "@/lib/intelligence/types";

export interface ReasoningContext {
  runs: RunActivity[];
  fitByRunId: Map<string, FitRunDetail>;
  labelByRunId: Map<string, WorkoutClassification>;
  analytics: DashboardInsights;
  quality: ImportQualityReport;
  raceGoal: RaceGoal | null;
}

export interface ReasoningResult<T> {
  payload: T;
  evidence: string[];
  assumptions: string[];
  limitations: string[];
  confidence: IntelligenceConfidence;
}

export type CompareSessionType = "tempo" | "interval" | "long" | "race";

export interface CompareSessionsArgs {
  type?: CompareSessionType;
  n?: number;
}

export interface ExplainReadinessDeltaArgs {
  weeks?: number;
}

export type BestPhaseMetric = "aerobic" | "volume" | "consistency" | "efficiency";

export interface FindBestPhaseArgs {
  metric?: BestPhaseMetric;
}

export type AttributeMetric = "pace" | "efficiency" | "volume";

export interface AttributeImprovementArgs {
  metric?: AttributeMetric;
}

export interface AnalyzeFadePatternArgs {
  distanceKm?: number;
}

export interface PrContextArgs {
  bucket?: "5k" | "10k" | "hm" | "long";
  runId?: string;
}

export interface PhaseBlockMetrics {
  label: string;
  weekStart: string;
  weekEnd: string;
  distanceKm: number;
  runCount: number;
  runsPerWeek: number;
  hardPct: number;
  longestRunKm: number;
  longRunPctOfVolume: number;
  meanEfficiency: number | null;
  weeklyKmVariance: number;
  aerobicScore: number;
}
