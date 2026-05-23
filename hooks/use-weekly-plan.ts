"use client";

import { useCallback, useState } from "react";
import type { GenerateWeeklyPlanResult } from "@/lib/ai-planning";
import { PLAN_CONTEXT_MAX_CHARS } from "@/lib/plan/planContextConstants";

export type GenerateWeeklyPlanRequest = {
  forceFallback?: boolean;
  planningContext?: string;
};

export function useWeeklyPlan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateWeeklyPlanResult | null>(null);
  const [lastPlanningContext, setLastPlanningContext] = useState<string | null>(
    null
  );

  const generate = useCallback(async (opts?: GenerateWeeklyPlanRequest) => {
    setLoading(true);
    setError(null);
    const planningContext = opts?.planningContext?.trim().slice(
      0,
      PLAN_CONTEXT_MAX_CHARS
    );
    if (planningContext) {
      setLastPlanningContext(planningContext);
    }
    try {
      const res = await fetch("/api/me/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          forceFallback: opts?.forceFallback ?? false,
          planningContext: planningContext || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate plan");
      }
      const payload: GenerateWeeklyPlanResult = {
        plan: data.plan,
        guardrails: data.guardrails,
        source: data.source,
        validation: data.validation,
        integrity: data.integrity,
      };
      setResult(payload);
      return payload;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Plan failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    generate,
    loading,
    error,
    result,
    reset,
    lastPlanningContext,
  };
}
