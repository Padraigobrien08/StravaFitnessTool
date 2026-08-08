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
  // Kept beside the message so the UI can explain the failure in plain language
  // instead of rendering the API's HTTP reason ("Unauthorized") verbatim.
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [result, setResult] = useState<GenerateWeeklyPlanResult | null>(null);
  const [lastPlanningContext, setLastPlanningContext] = useState<string | null>(null);

  const generate = useCallback(async (opts?: GenerateWeeklyPlanRequest) => {
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    const planningContext = opts?.planningContext?.trim().slice(0, PLAN_CONTEXT_MAX_CHARS);
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
      // Record the status before touching the body. A gateway timeout or proxy error
      // returns a status with an HTML body, and `res.json()` throws on it — so
      // parsing first meant the status was lost in exactly the case the UI most needs
      // it, leaving `planErrorPresentation` to render a JSON parse error instead of
      // "the planner is unavailable".
      if (!res.ok) setErrorStatus(res.status);

      const data = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to generate plan (${res.status})`);
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
    setErrorStatus(null);
  }, []);

  return {
    generate,
    loading,
    error,
    errorStatus,
    result,
    reset,
    lastPlanningContext,
  };
}
