/**
 * Modality-aware training intelligence types.
 * Canonical classifier: Strava API v3 `sport_type` (not legacy `type`).
 * @see https://developers.strava.com/docs/reference/
 */

export type ActivityModality =
  | "run"
  | "aerobic_cross_training"
  | "bike"
  | "swim"
  | "strength"
  | "mobility"
  | "recovery"
  | "high_intensity_cross_training"
  | "sport"
  | "outdoor_endurance"
  | "unknown";

export type ActivitySource = "strava_api" | "strava_export" | "manual";

export type PerceivedIntensity = "low" | "moderate" | "high" | "unknown";

export type DirectnessLevel =
  | "direct_performance_evidence"
  | "supporting_context"
  | "fatigue_context"
  | "recovery_context"
  | "low_confidence_inference";

export interface IntensityInference {
  level: PerceivedIntensity;
  confidence: "low" | "medium" | "high";
  evidence: string[];
}

export interface NormalizedActivity {
  id: string;
  source: ActivitySource;
  sportType: string;
  modality: ActivityModality;
  name: string;
  startDate: string;
  startDateLocal?: string;
  movingTimeSec: number;
  elapsedTimeSec: number;
  distanceMeters?: number;
  elevationGainMeters?: number;
  avgHr?: number;
  maxHr?: number;
  calories?: number;
  cadence?: number;
  power?: number;
  trainer?: boolean;
  commute?: boolean;
  hasStreams: boolean;
  hasLaps: boolean;
  perceivedIntensity: PerceivedIntensity;
  intensity: IntensityInference;
  inferredPurpose?: string;
  confidence: "low" | "medium" | "high";
  /** Run-only: quality/long classification from workout labels */
  isHardRun?: boolean;
}

export type InterferenceSeverity = "low" | "medium" | "high";

export interface InterferenceFlag {
  id: string;
  severity: InterferenceSeverity;
  kind:
    | "near_quality_run"
    | "race_week"
    | "weekly_hi_density"
    | "hybrid_cluster";
  nonRunActivityName: string;
  nonRunSportType: string;
  nonRunDate: string;
  anchorRunName?: string;
  anchorRunDate?: string;
  hoursApart: number;
  message: string;
  evidence: string[];
  confidence: "low" | "medium" | "high";
}

export interface TrainingSupportSignal {
  id: string;
  dimension:
    | "aerobic_support"
    | "strength"
    | "mobility"
    | "recovery_behavior"
    | "durability"
    | "modality_balance"
    | "hybrid_load"
    | "context";
  label: string;
  trend: "positive" | "neutral" | "warning";
  evidence: string[];
  confidence: "low" | "medium" | "high";
  limitations: string[];
  directness: DirectnessLevel;
}

export interface EcosystemInsight {
  id: string;
  category:
    | "aerobic_support"
    | "strength_support"
    | "mobility_support"
    | "recovery_behavior"
    | "interference_risk"
    | "durability_support"
    | "modality_balance"
    | "hybrid_load";
  title: string;
  severity: "positive" | "neutral" | "warning";
  evidence: string[];
  recommendation?: string;
  confidence: "low" | "medium" | "high";
  limitations: string[];
  directness: DirectnessLevel;
}

export interface EcosystemScores {
  aerobicSupport: number;
  strengthSupport: number;
  mobilitySupport: number;
  recoveryBehavior: number;
  interferenceRisk: number;
  durabilitySupport: number;
  modalityBalance: number;
}

export type RollingWindowDays = 7 | 14 | 28 | 56 | 84;

export interface ModalitySessionCounts {
  sessions: number;
  minutes: number;
}

export interface WeeklyTrainingEcosystem {
  weekStart: string;
  label: string;
  runDistanceKm: number;
  runCount: number;
  runHardCount: number;
  runMinutes: number;
  bikeMinutes: number;
  swimMinutes: number;
  aerobicCrossTrainingMinutes: number;
  strengthSessions: number;
  mobilitySessions: number;
  recoverySessions: number;
  hiitSessions: number;
  sportSessions: number;
  /** @deprecated use hiitSessions + sportSessions */
  hiitOrSportSessions: number;
  totalNonRunMinutes: number;
  totalTrainingMinutes: number;
  highIntensitySessions: number;
  lowIntensitySessions: number;
  modalityDistribution: Partial<Record<ActivityModality, number>>;
  interferenceFlags: InterferenceFlag[];
  supportSignals: TrainingSupportSignal[];
}

export interface RollingEcosystemSnapshot
  extends Omit<
    WeeklyTrainingEcosystem,
    "weekStart" | "label" | "interferenceFlags" | "supportSignals"
  > {
  windowDays: RollingWindowDays;
}

export interface ModalityCoverage {
  running: number;
  cycling: number;
  swim: number;
  strength: number;
  mobilityRecovery: number;
  hiitCrossfit: number;
  outdoorEndurance: number;
  sport: number;
  unknown: number;
  total: number;
}

export type AthleteArchetype =
  | "runner"
  | "hybrid_runner"
  | "triathlete"
  | "cyclist"
  | "strength_endurance"
  | "multisport"
  | "unknown";

export interface AthleteArchetypeResult {
  archetype: AthleteArchetype;
  label: string;
  confidence: "low" | "medium" | "high";
  evidence: string[];
  coachingNotes: string[];
}

export interface TotalTrainingContext {
  last28Days: {
    runSessions: number;
    nonRunSessions: number;
    totalMovingHours: number;
    runMovingHours: number;
    crossTrainingMovingHours: number;
    bikeHours: number;
    swimHours: number;
    strengthSessions: number;
    mobilitySessions: number;
  };
  sportMix: { sportType: string; count: number; modality: ActivityModality }[];
  headline: string;
}

export interface TrainingEcosystemAnalysis {
  activities: NormalizedActivity[];
  scores: EcosystemScores;
  archetype: AthleteArchetypeResult;
  currentWeek: WeeklyTrainingEcosystem;
  recentWeeks: WeeklyTrainingEcosystem[];
  rolling: Partial<Record<RollingWindowDays, RollingEcosystemSnapshot>>;
  modalityCoverage: ModalityCoverage;
  totalContext: TotalTrainingContext;
  interferenceFlags: InterferenceFlag[];
  supportSignals: TrainingSupportSignal[];
  ecosystemInsights: EcosystemInsight[];
  raceWeekWarnings: InterferenceFlag[];
  readinessContextNote: string | null;
  fatigueContextNote: string | null;
  confidence: "low" | "medium" | "high";
  limitations: string[];
}
