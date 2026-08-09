"use client";

import { Eyebrow, Panel } from "@/components/console/console-kit";
import type { GoalScenarioResult } from "@/lib/goals/goalScenarios";
import { cn } from "@/lib/utils";

function probColor(pct: number | null): string {
  if (pct == null) return "text-zinc-500";
  if (pct >= 70) return "text-accent";
  if (pct >= 45) return "text-amber-400/85";
  return "text-rose-400/85";
}

export function GoalScenariosPanel({ scenarios }: { scenarios: GoalScenarioResult }) {
  return (
    <div className="space-y-4">
      <Panel>
        <Eyebrow className="mb-2.5">What would it take?</Eyebrow>
        <p className="text-sm leading-relaxed text-zinc-300">{scenarios.recommendation}</p>
        {scenarios.hasTarget ? (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
            <span>
              Target{" "}
              <span className="font-mono font-medium tabular-nums text-zinc-300">
                {scenarios.targetLabel}
              </span>
            </span>
            <span>
              Current projection{" "}
              <span className="font-mono font-medium tabular-nums text-zinc-300">
                {/* baselineTimeSec formatted upstream via the maintain scenario */}
                {scenarios.scenarios.find((s) => s.id === "maintain")?.projectedTimeLabel}
              </span>
            </span>
            {scenarios.baselineProbabilityPct != null ? (
              <span>
                Baseline chance{" "}
                <span
                  className={cn(
                    "font-mono font-medium tabular-nums",
                    probColor(scenarios.baselineProbabilityPct),
                  )}
                >
                  {scenarios.baselineProbabilityPct}%
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel>
        <Eyebrow className="mb-2.5">Training scenarios</Eyebrow>
        <div className="space-y-2.5">
          {scenarios.scenarios.map((s) => (
            <div
              key={s.id}
              className={cn(
                "rounded-lg p-3 ring-1",
                s.meetsTarget
                  ? "bg-accent/[0.05] ring-accent/25"
                  : "bg-[var(--surface-subdued)] ring-[var(--border-subtle)]",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-zinc-200">{s.label}</p>
                <div className="flex items-baseline gap-3 font-mono tabular-nums">
                  <span className="text-sm text-zinc-400">{s.projectedTimeLabel}</span>
                  {s.probabilityPct != null ? (
                    <span className={cn("text-sm font-semibold", probColor(s.probabilityPct))}>
                      {s.probabilityPct}/100
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">{s.leverSummary}</p>
              {s.rationale.length > 0 ? (
                <p className="mt-1 text-xs text-zinc-500">{s.rationale[0]}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

      {(scenarios.evidence.length > 0 || scenarios.limitations.length > 0) && (
        <Panel>
          <Eyebrow className="mb-2.5">Basis</Eyebrow>
          {scenarios.evidence.length > 0 ? (
            <ul className="space-y-1 text-xs text-zinc-500">
              {scenarios.evidence.map((e, i) => (
                <li key={i}>· {e}</li>
              ))}
            </ul>
          ) : null}
          {scenarios.limitations.length > 0 ? (
            <>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Caveats
              </p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-500">
                {scenarios.limitations.map((l, i) => (
                  <li key={i}>· {l}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Panel>
      )}
    </div>
  );
}
