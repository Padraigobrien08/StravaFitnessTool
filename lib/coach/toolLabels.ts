/** Human-readable intelligence provenance (not raw MCP names). */

export const TOOL_LABELS: Record<string, string> = {
  compare_sessions: "Workout comparison",
  explain_readiness_delta: "Readiness analysis",
  find_best_phase: "Training phase model",
  attribute_improvement: "Adaptation patterns",
  analyze_fade_pattern: "Pace fade analysis",
  pr_context: "PR retrospective",
  get_coach_brief: "Training brief",
  get_readiness: "Readiness engine",
  get_predictions: "Race prediction model",
  get_week_plan: "Weekly plan engine",
  get_race_strategy: "Pacing strategy",
  get_fatigue_load: "Fatigue & load model",
  list_recent_runs: "Activity index",
  get_data_quality: "Data quality audit",
  get_connection_status: "Connection status",
  get_training_ecosystem: "Training ecosystem",
  get_training_ecosystem_summary: "Ecosystem summary",
  get_modality_distribution: "Modality distribution",
  get_cross_training_support: "Cross-training support",
  get_interference_risks: "Interference risks",
  get_athlete_archetype: "Athlete archetype",
  compare_modality_blocks: "Modality block compare",
  get_race_week_interference_check: "Race-week interference",
  get_strength_mobility_support: "Strength & mobility",
};

export function labelForTool(name: string): string {
  return TOOL_LABELS[name] ?? "Training intelligence";
}

export function loadingMessageForTool(name: string): string {
  const map: Record<string, string> = {
    compare_sessions: "Comparing session execution…",
    explain_readiness_delta: "Tracing readiness changes…",
    find_best_phase: "Ranking training phases…",
    attribute_improvement: "Mining adaptation patterns…",
    analyze_fade_pattern: "Analyzing late-run fade…",
    pr_context: "Reconstructing pre-PR training…",
    get_readiness: "Computing readiness…",
    get_week_plan: "Building weekly plan…",
    get_predictions: "Running race projections…",
    get_fatigue_load: "Analyzing fatigue & load…",
    get_coach_brief: "Synthesizing training brief…",
    get_training_ecosystem: "Analyzing cross-training ecosystem…",
  };
  return map[name] ?? "Running intelligence engines…";
}

export const DEFAULT_LOADING_PHASES = [
  "Accessing your training intelligence…",
  "Grounding analysis in deterministic engines…",
  "Synthesizing coaching response…",
];
