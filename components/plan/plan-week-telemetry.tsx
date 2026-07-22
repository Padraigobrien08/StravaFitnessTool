"use client";

import type { PlanWeekTelemetry } from "@/lib/plan/planWorkspaceView";

export function PlanWeekTelemetryStrip({ telemetry }: { telemetry: PlanWeekTelemetry }) {
  const chips = [
    telemetry.volumeKm != null
      ? { label: "Volume", value: `${telemetry.volumeKm} km planned` }
      : null,
    {
      label: "Intensity",
      value: `${telemetry.hardSessions} hard session${telemetry.hardSessions === 1 ? "" : "s"}`,
    },
    { label: "Freshness", value: `${telemetry.freshness} · ${telemetry.freshnessLabel}` },
    { label: "Goal alignment", value: telemetry.goalAlignment },
    telemetry.riskSummary ? { label: "Risk", value: telemetry.riskSummary, warn: true } : null,
    { label: "Confidence", value: telemetry.confidence },
  ].filter(Boolean) as {
    label: string;
    value: string;
    warn?: boolean;
  }[];

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <div
          key={c.label}
          className={
            c.warn
              ? "rounded-md bg-amber-500/[0.06] px-2.5 py-1.5 ring-1 ring-amber-500/15"
              : "rounded-md bg-[var(--surface)] px-2.5 py-1.5 ring-1 ring-[var(--border-subtle)]"
          }
        >
          <p className="text-[9px] uppercase tracking-wide text-zinc-600">{c.label}</p>
          <p
            className={
              c.warn
                ? "text-[11px] font-medium text-amber-200/80"
                : "text-[11px] font-medium text-zinc-300"
            }
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
