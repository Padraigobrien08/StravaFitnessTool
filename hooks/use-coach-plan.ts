"use client";

import { useCallback } from "react";
import type { PlanToolResult, WeeklyTrainingPlan } from "@/lib/ai-planning";
import {
  buildCalendarCoachPayload,
  calendarWeekToWeeklyPlan,
  getCalendarWeek,
  targetPlanWeekStart,
} from "@/lib/training-calendar";

export type CoachPlanApiResponse = PlanToolResult & {
  kind?: "generate" | "modify" | "explain";
  toolsUsed?: string[];
  explanationOnly?: string;
  devRecentRuns?: unknown[];
};

export function useCoachPlanRequest() {
  const requestPlan = useCallback(
    async (params: {
      message: string;
      previousPlan?: WeeklyTrainingPlan;
    }): Promise<CoachPlanApiResponse> => {
      const saved = getCalendarWeek(targetPlanWeekStart());
      const previousPlan =
        params.previousPlan ??
        (saved ? calendarWeekToWeeklyPlan(saved) : undefined);
      const calendarPayload = buildCalendarCoachPayload(saved, null);

      const res = await fetch("/api/me/coach/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: params.message,
          previousPlan,
          calendarContext: calendarPayload.summaryText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Planning request failed");
      }
      return data as CoachPlanApiResponse;
    },
    []
  );

  return { requestPlan };
}
