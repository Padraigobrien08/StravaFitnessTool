"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { WhatThisMeans } from "@/components/layout/what-this-means";
import { WorkoutTypeBadge } from "@/components/workout/workout-type-badge";
import type { WeekPlan } from "@/lib/training/planEngine";

const STORAGE_KEY = "strideiq-plan-checks-v1";

function loadChecks(weekStart: string): boolean[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, boolean[]>;
    return map[weekStart] ?? [];
  } catch {
    return [];
  }
}

function saveChecks(weekStart: string, checks: boolean[]) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean[]>) : {};
    map[weekStart] = checks;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function NextWeekPlanPanel({
  plan,
  compact = false,
}: {
  plan: WeekPlan;
  compact?: boolean;
}) {
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    setChecked(loadChecks(plan.weekStart));
  }, [plan.weekStart]);

  const toggle = useCallback(
    (index: number) => {
      setChecked((prev) => {
        const next = [...prev];
        while (next.length < plan.sessions.length) next.push(false);
        next[index] = !next[index];
        saveChecks(plan.weekStart, next);
        return next;
      });
    },
    [plan.weekStart, plan.sessions.length]
  );

  return (
    <Card className={compact ? "" : "border-emerald-500/20"}>
      <CardHeader>
        <CardTitle>
          Recommended next week
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {plan.weekLabel}
          </span>
        </CardTitle>
        <p className="text-xs text-zinc-500 capitalize">
          Template: {plan.template.replace(/_/g, " ")} ·{" "}
          {plan.totalKmRange[0]}–{plan.totalKmRange[1]} km
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1 text-sm text-zinc-400">
          {plan.rationale.map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>

        <ol className="space-y-3">
          {plan.sessions.map((s, i) => (
            <li
              key={`${s.day}-${i}`}
              className={`flex gap-3 rounded-lg border px-3 py-3 ${
                checked[i]
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <Checkbox
                checked={checked[i] ?? false}
                onCheckedChange={() => toggle(i)}
                className="mt-1"
                aria-label={`Mark session ${i + 1} complete`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {s.day && (
                    <span className="text-xs font-medium text-zinc-500">
                      {s.day}
                    </span>
                  )}
                  <WorkoutTypeBadge type={s.type} />
                  <span className="text-xs text-zinc-600">
                    {s.distanceKmRange[0]}–{s.distanceKmRange[1]} km
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>

        {plan.warnings.length > 0 && (
          <ul className="space-y-1 text-xs text-amber-400/90">
            {plan.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        )}

        {!compact && (
          <WhatThisMeans>
            Plan uses your freshness (TSB), intensity balance, race countdown,
            and recent weekly volume. Hard sessions are limited when fatigue is
            high; volume will not exceed ~15% vs last week without a warning.
          </WhatThisMeans>
        )}
      </CardContent>
    </Card>
  );
}

export { formatPlanForReport } from "@/lib/training/viewModels";
