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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-500/20 bg-teal-500/[0.05] px-3 py-2.5">
      <div>
        <p className="text-[11px] font-medium text-teal-300">Saved locally</p>
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
