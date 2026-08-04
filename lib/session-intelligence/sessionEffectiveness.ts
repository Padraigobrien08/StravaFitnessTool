import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import type { DashboardInsights } from "@/lib/analytics";
import { evaluateSessionExecution } from "./evaluateSessionExecution";
import type { SessionIntelligence } from "./types";
import type { FatigueSnapshot } from "@/lib/analytics/fatigue";
import { isTrainingCurrent } from "@/lib/insights/consistency";

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

/**
 * The sessions evaluated here are the most recent ones on record, which is not
 * the same as recent. Pass `fatigue` so the summary can say "your last block"
 * rather than describing a finished block in the present tense.
 */
export function sessionEffectivenessSummary(
  sessions: SessionIntelligence[],
  fatigue?: Pick<FatigueSnapshot, "readiness" | "restDaysSinceLastRun">,
): string[] {
  const out: string[] = [];
  const current = !fatigue || isTrainingCurrent(fatigue);
  const strong = sessions.filter(
    (s) => s.executionQuality === "strong" || s.executionQuality === "excellent",
  );
  const highFatigue = sessions.filter((s) => s.fatigueCost === "high");

  if (strong.length >= 2) {
    out.push(
      current
        ? `Recent execution quality appears strong in ${strong.length} of ${sessions.length} evaluated sessions`
        : `Execution quality was strong in ${strong.length} of the last ${sessions.length} sessions you ran`,
    );
  }
  if (highFatigue.length >= 2) {
    out.push(
      current
        ? "Multiple recent sessions carry high fatigue cost: recovery spacing may help"
        : "Several of your last sessions carried high fatigue cost: worth spacing quality more on the way back",
    );
  }

  const threshold = sessions.filter((s) =>
    s.likelyAdaptations.some((a) => /threshold|HM-specific/i.test(a)),
  );
  if (threshold.length >= 2) {
    out.push(
      current
        ? "Threshold-style work appears to be landing with reasonable execution"
        : "Threshold-style work landed with reasonable execution in your last block",
    );
  }

  return out.slice(0, 4);
}
