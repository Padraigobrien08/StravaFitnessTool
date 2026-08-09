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

export type CoachConfidence = "low" | "medium" | "medium-high" | "high";

/**
 * The prompt asks for one of four levels — low, medium, medium-high, high — and this
 * read only three of them. `"medium-high".includes("high")` is true, so the hedged level
 * was displayed as the confident one, rounding the model's own caveat upward. Order
 * matters here for exactly that reason: the compound has to be tested before "high".
 */
export function confidenceLevel(raw: string | null): CoachConfidence | null {
  if (!raw) return null;
  const l = raw.toLowerCase();
  if (/medium[\s_-]*high/.test(l)) return "medium-high";
  if (l.includes("high")) return "high";
  if (l.includes("medium") || l.includes("moderate")) return "medium";
  if (l.includes("low")) return "low";
  return null;
}

/**
 * What the answer was actually grounded in.
 *
 * Three states, deliberately distinguished:
 *
 *  - `tools`   — these tools ran, so their results are in the reply's context.
 *  - `none`    — the model answered without calling anything. Worth saying: it is the
 *                one case where "grounded in" would be a lie, and the reader is the
 *                only one who can judge whether that matters for their question.
 *  - `unknown` — no record either way. Threads persisted before `toolsUsed` existed
 *                deserialize with it absent, and absent is not the same as none.
 */
export type Grounding =
  { kind: "tools"; labels: string[] } | { kind: "none" } | { kind: "unknown" };

/**
 * Derived from the tool calls alone.
 *
 * This used to merge the real `toolsUsed` list with regexes run over the model's own
 * `## Evidence` prose — `/readiness|freshness|tsb/` and friends. So a reply that merely
 * *mentioned* readiness earned a "readiness" grounding chip, and a reply that called no
 * tools at all could still be labelled grounded in four things. The badge exists to
 * certify that numbers came from the engines rather than the model; deriving it from
 * what the model wrote is the one way of computing it that cannot do that.
 *
 * The second half of that fix is in the provider loops: `toolsUsed` was appended to
 * *before* the tool ran, so a call that threw — a database blip, a bad argument — still
 * produced its grounding chip. The model was correctly told the call failed and would
 * answer around it, while the badge told the reader that failure was the evidence. Both
 * loops now push only after a non-error outcome, so what arrives here is the set of
 * calls that actually returned data.
 */
export function describeGrounding(toolsUsed: string[] | undefined): Grounding {
  if (toolsUsed === undefined) return { kind: "unknown" };
  if (toolsUsed.length === 0) return { kind: "none" };

  const labels = [
    ...new Set(toolsUsed.map((t) => TOOL_GROUNDING[t] ?? labelForTool(t).toLowerCase())),
  ].filter(Boolean);

  return labels.length > 0 ? { kind: "tools", labels: labels.slice(0, 4) } : { kind: "none" };
}

export function primaryLimitation(parsed: ParsedCoachResponse): string | null {
  const line = parsed.limitations.find(Boolean);
  return line?.trim() || null;
}
