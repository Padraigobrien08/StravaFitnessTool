"use client";

import Link from "next/link";
import type { WeekExecutionSummary } from "@/lib/training-calendar/matchPlannedVsActual";
import type { ExecutionMatchStatus } from "@/lib/training-calendar/matchPlannedVsActual";
import { cn } from "@/lib/utils";

const statusStyles: Record<ExecutionMatchStatus, { label: string; className: string }> = {
  matched: { label: "Matched", className: "text-teal-400/90 bg-teal-500/10" },
  marked_done: {
    label: "Done",
    className: "text-teal-400/80 bg-teal-500/10",
  },
  partial: {
    label: "Partial",
    className: "text-amber-300/90 bg-amber-500/10",
  },
  missed: { label: "Missed", className: "text-red-300/80 bg-red-500/10" },
  skipped: { label: "Skipped", className: "text-zinc-500 bg-zinc-500/10" },
  rest_ok: { label: "Rest", className: "text-zinc-500 bg-zinc-500/10" },
  rest_unplanned_run: {
    label: "Extra run",
    className: "text-amber-300/80 bg-amber-500/10",
  },
  future: { label: "Upcoming", className: "text-zinc-600 bg-zinc-500/5" },
  no_data: { label: "—", className: "text-zinc-600 bg-zinc-500/5" },
};

export function PlanWeekExecution({
  summary,
  onHighlightDay,
}: {
  summary: WeekExecutionSummary;
  onHighlightDay?: (workoutId: string) => void;
}) {
  if (!summary.hasRunData && summary.rows.every((r) => r.status === "future")) {
    return null;
  }

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Planned vs actual
        </p>
        {summary.adherencePct != null ? (
          <p className="text-[11px] text-zinc-400">
            <span className="font-medium text-zinc-300">{summary.adherencePct}%</span> run sessions
            aligned
            {summary.partialDays > 0 ? (
              <span className="text-zinc-600"> · {summary.partialDays} partial</span>
            ) : null}
            {summary.missedDays > 0 ? (
              <span className="text-zinc-600"> · {summary.missedDays} missed</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {!summary.hasRunData ? (
        <p className="mt-2 text-[11px] text-zinc-600">
          Import or sync activities to compare this week against your plan.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {summary.rows.map((row) => {
            const style = statusStyles[row.status];
            const runId = row.actualRuns[0]?.id;
            return (
              <li key={row.workout.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/[0.03]"
                  onClick={() => onHighlightDay?.(row.workout.id)}
                >
                  <span className="w-8 shrink-0 text-[10px] font-medium text-zinc-600">
                    {row.workout.day}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-zinc-400 line-clamp-1">
                      <span className="text-zinc-500">Plan: </span>
                      {row.plannedLabel}
                    </p>
                    {row.actualLabel ? (
                      <p className="text-[11px] text-zinc-500 line-clamp-1">
                        <span className="text-zinc-600">Actual: </span>
                        {runId ? (
                          <Link
                            href={`/runs/${runId}`}
                            className="text-teal-500/80 hover:text-teal-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.actualLabel}
                          </Link>
                        ) : (
                          row.actualLabel
                        )}
                      </p>
                    ) : null}
                    {row.note ? <p className="text-[10px] text-zinc-600">{row.note}</p> : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase",
                      style.className,
                    )}
                  >
                    {style.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
