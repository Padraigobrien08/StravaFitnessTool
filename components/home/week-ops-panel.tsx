"use client";

import type { WeekOpsViewModel } from "@/lib/home/dashboardData";
import { PanelChrome } from "./primitives/panel-chrome";
import { WorkoutSessionRow } from "./primitives/workout-pill";
import { formatKm, formatKmValue } from "@/lib/utils";
import { dash } from "./primitives/tokens";

export function WeekOpsPanel({
  title,
  ops,
  href,
}: {
  title: string;
  ops: WeekOpsViewModel;
  href: string;
}) {
  const sessions =
    ops.sessions.length > 0
      ? ops.sessions
      : ops.laneByDay.filter((s): s is NonNullable<typeof s> => s != null);

  return (
    <PanelChrome title={title} href={href} subdued>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/[0.04] pb-3">
        <p className="text-sm font-medium text-zinc-200">{ops.weekLabel}</p>
        <p className={dash.muted}>
          {ops.runCount} sessions · {formatKm(ops.loadKm)}
          {ops.loadDeltaPct !== null ? (
            <span className={ops.loadDeltaPct >= 0 ? " text-accent/80" : " text-amber-500/80"}>
              {" "}
              ({ops.loadDeltaPct >= 0 ? "+" : ""}
              {ops.loadDeltaPct}%)
            </span>
          ) : null}
          <span className="text-zinc-600"> · load {formatKmValue(ops.totalLoadScore)}</span>
        </p>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {sessions.length > 0 ? (
          sessions.map((s, i) => (
            <WorkoutSessionRow
              key={`${s.day}-${i}`}
              day={s.day}
              type={s.type}
              kmRange={s.kmRange}
              loadScore={s.loadScore}
            />
          ))
        ) : (
          <p className="py-4 text-xs text-zinc-500">No sessions in this window yet.</p>
        )}
      </div>
    </PanelChrome>
  );
}
