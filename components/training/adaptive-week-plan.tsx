"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { AdaptiveWeekPlanView } from "@/lib/training/viewModels";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingDown, TrendingUp, Minus, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import type { WorkoutType } from "@/lib/analytics/workoutType";

const STORAGE_KEY = "strideiq-plan-checks-v1";

const typeStyles: Record<WorkoutType, string> = {
  easy: "bg-teal-500/12 text-teal-300 ring-teal-500/20",
  recovery: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/15",
  tempo: "bg-amber-500/12 text-amber-300 ring-amber-500/20",
  interval: "bg-amber-500/12 text-amber-300 ring-amber-500/20",
  long: "bg-blue-500/12 text-blue-300 ring-blue-500/20",
  race: "bg-fuchsia-500/12 text-fuchsia-300 ring-fuchsia-500/15",
  unknown: "bg-white/[0.04] text-zinc-500 ring-white/10",
};

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

export function AdaptiveWeekPlan({
  plan,
  weekStart,
}: {
  plan: AdaptiveWeekPlanView;
  weekStart: string;
}) {
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    setChecked(loadChecks(weekStart));
  }, [weekStart]);

  const toggle = useCallback(
    (index: number) => {
      setChecked((prev) => {
        const next = [...prev];
        while (next.length < plan.sessions.length) next.push(false);
        next[index] = !next[index];
        saveChecks(weekStart, next);
        return next;
      });
    },
    [weekStart, plan.sessions.length],
  );

  const LoadIcon = plan.loadVsLastWeek?.startsWith("+")
    ? TrendingUp
    : plan.loadVsLastWeek?.startsWith("-")
      ? TrendingDown
      : Minus;

  return (
    <PanelChrome title="Recommended next week" href="/report" accent elevated>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.04] pb-4">
        <div>
          <p className="text-sm font-medium text-zinc-200">{plan.weekLabel}</p>
          <p className="mt-1 text-xs text-zinc-500 capitalize">
            {plan.templateLabel} template · {plan.totalKmLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan.isRaceWeek ? (
            <span className="rounded-md bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300/90 ring-1 ring-inset ring-fuchsia-500/20">
              Race week
            </span>
          ) : plan.isTaper ? (
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300/90 ring-1 ring-inset ring-amber-500/20">
              Taper
            </span>
          ) : null}
          {plan.isRecovery ? (
            <span className="rounded-md bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ring-1 ring-inset ring-white/10">
              Recovery
            </span>
          ) : null}
          <ConfidenceBadge level={plan.confidence} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-zinc-500">
        <span>
          Est. load <strong className="text-zinc-300">{plan.estimatedLoad}</strong>
        </span>
        {plan.loadVsLastWeek ? (
          <span className="inline-flex items-center gap-1">
            <LoadIcon className="h-3 w-3 text-teal-500/80" aria-hidden />
            {plan.loadVsLastWeek}
          </span>
        ) : null}
      </div>

      <ul className="mb-4 space-y-1 text-xs leading-relaxed text-zinc-500">
        {plan.rationale.map((r, i) => (
          <li key={i}>· {r}</li>
        ))}
      </ul>

      <div className="space-y-0 divide-y divide-white/[0.04] rounded-xl border border-white/[0.05] bg-white/[0.015]">
        {plan.sessions.map((s, i) => (
          <div
            key={`${s.day}-${i}`}
            className={cn(
              "flex gap-3 px-3 py-3.5 transition-colors sm:px-4",
              checked[i] && "bg-teal-500/[0.04]",
              s.isKey && !checked[i] && "bg-white/[0.02]",
            )}
          >
            <Checkbox
              checked={checked[i] ?? false}
              onCheckedChange={() => toggle(i)}
              className="mt-1"
              aria-label={`Mark ${s.day} ${s.typeLabel} complete`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-8 shrink-0 text-xs font-semibold text-zinc-500">{s.day}</span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                    typeStyles[s.type],
                  )}
                >
                  {WORKOUT_TYPE_LABELS[s.type]}
                </span>
                <span className="text-xs tabular-nums text-zinc-400">{s.kmRange}</span>
                <span className="ml-auto text-[10px] tabular-nums text-zinc-600">
                  L{s.loadScore}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-zinc-300">
                <span className="font-medium text-zinc-500">Goal · </span>
                {s.goal}
              </p>
            </div>
          </div>
        ))}
      </div>

      {plan.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {plan.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-amber-400/90">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-zinc-600">
        <Link href="/home" className="text-teal-400/90 hover:text-teal-300">
          Weekly narrative on Home
          <ArrowRight className="ml-1 inline h-3 w-3" />
        </Link>
      </p>
    </PanelChrome>
  );
}
