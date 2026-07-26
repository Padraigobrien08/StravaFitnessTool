"use client";

import { formatPlanTimestamp } from "@/lib/plan/planWorkspaceView";
import type { TrainingCalendarWeek } from "@/lib/training-calendar";
import { historyCount } from "@/lib/training-calendar/calendarHistory";

export function PlanSavedStateCard({
  week,
  historyAvailable,
  modified,
}: {
  week: TrainingCalendarWeek;
  historyAvailable: number;
  modified: boolean;
}) {
  const revision = week.revision ?? 1;

  return (
    <div
      style={{ background: "var(--home-signal-wash)" }}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 ring-1 ring-[var(--home-signal-line)]"
    >
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Saved locally
        </p>
        <p className="text-[10px] text-zinc-600">
          Updated {formatPlanTimestamp(week.updatedAt)}
          {revision > 1 ? ` · Version ${revision}` : ""}
          {modified ? " · Edited after save" : ""}
          {historyAvailable > 0
            ? ` · ${historyAvailable} prior snapshot${historyAvailable === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>
      <p className="text-[10px] text-zinc-700">
        Persists in this browser ·{" "}
        {historyCount(week.weekStart) > 0 ? "revert available" : "first save"}
      </p>
    </div>
  );
}
