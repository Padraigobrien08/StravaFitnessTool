import type { ParsedCoachResponse } from "./parseResponse";
import { labelForTool } from "./toolLabels";

const TOOL_GROUNDING: Record<string, string> = {
  get_readiness: "readiness",
  explain_readiness_delta: "readiness",
  get_fatigue_load: "fatigue & load",
  get_week_plan: "weekly structure",
  get_predictions: "race projections",
  get_race_strategy: "pacing strategy",
  compare_sessions: "session comparison",
  get_training_ecosystem: "training ecosystem",
  get_coach_brief: "training brief",
  list_recent_runs: "activity history",
  get_run_detail: "run execution detail",
  get_data_quality: "data quality",
};

export function confidenceLevel(
  raw: string | null
): "low" | "medium" | "high" | null {
  if (!raw) return null;
  const l = raw.toLowerCase();
  if (l.includes("high")) return "high";
  if (l.includes("medium") || l.includes("moderate")) return "medium";
  if (l.includes("low")) return "low";
  return null;
}

export function inferGroundedIn(
  parsed: ParsedCoachResponse,
  toolsUsed?: string[]
): string[] {
  const fromTools = (toolsUsed ?? [])
    .map((t) => TOOL_GROUNDING[t] ?? labelForTool(t).toLowerCase())
    .filter(Boolean);

  const fromEvidence = parsed.evidence
    .join(" ")
    .toLowerCase();
  const hints: string[] = [];
  if (/readiness|freshness|tsb/.test(fromEvidence)) hints.push("readiness");
  if (/volume|km|week/.test(fromEvidence)) hints.push("volume");
  if (/threshold|interval|tempo|pace/.test(fromEvidence)) hints.push("sessions");
  if (/race|half|marathon/.test(fromEvidence)) hints.push("race prep");
  if (/strength|gym|cross|modality|ecosystem/.test(fromEvidence))
    hints.push("ecosystem");

  const merged = [...fromTools, ...hints];
  return [...new Set(merged)].slice(0, 4);
}

export function primaryLimitation(parsed: ParsedCoachResponse): string | null {
  const line = parsed.limitations.find(Boolean);
  return line?.trim() || null;
}
