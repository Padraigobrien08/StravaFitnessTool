import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { DashboardInsights } from "@/lib/analytics";
import { evaluateSessionExecution } from "./evaluateSessionExecution";
import type { SessionIntelligence } from "./types";

export function evaluateRecentSessions(
  runs: RunActivity[],
  fitById: Map<string, FitRunDetail>,
  labelById: Map<string, import("@/lib/analytics/workoutType").WorkoutClassification>,
  analytics: DashboardInsights | null,
  limit = 5,
): SessionIntelligence[] {
  const sorted = [...runs].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.slice(0, limit);

  return recent.map((run) => {
    const fit = fitById.get(run.id) ?? null;
    const workout = labelById.get(run.id) ?? {
      type: "unknown" as const,
      confidence: "low" as const,
      signals: [],
    };
    return evaluateSessionExecution(run, fit, workout, {
      analytics,
      historicalRuns: sorted,
    });
  });
}

export function sessionEffectivenessSummary(sessions: SessionIntelligence[]): string[] {
  const out: string[] = [];
  const strong = sessions.filter(
    (s) => s.executionQuality === "strong" || s.executionQuality === "excellent",
  );
  const highFatigue = sessions.filter((s) => s.fatigueCost === "high");

  if (strong.length >= 2) {
    out.push(
      `Recent execution quality appears strong in ${strong.length} of ${sessions.length} evaluated sessions`,
    );
  }
  if (highFatigue.length >= 2) {
    out.push("Multiple recent sessions carry high fatigue cost: recovery spacing may help");
  }

  const threshold = sessions.filter((s) =>
    s.likelyAdaptations.some((a) => /threshold|HM-specific/i.test(a)),
  );
  if (threshold.length >= 2) {
    out.push("Threshold-style work appears to be landing with reasonable execution");
  }

  return out.slice(0, 4);
}
