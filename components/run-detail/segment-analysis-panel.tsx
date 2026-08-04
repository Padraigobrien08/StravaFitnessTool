"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { SegmentRowView } from "@/lib/runs/workoutDetailViewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const roleStyles: Record<SegmentRowView["roleTone"], string> = {
  work: "bg-amber-500/12 text-amber-300/90 ring-amber-500/20",
  recovery: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/15",
  steady: "bg-accent/10 text-accent ring-accent/15",
  neutral: "bg-white/[0.04] text-zinc-500 ring-white/10",
};

export function SegmentAnalysisPanel({ segments }: { segments: SegmentRowView[] }) {
  if (segments.length === 0) {
    return (
      <PanelChrome title="Segment performance analysis" subdued>
        <p className="text-sm text-zinc-500">
          Lap data unavailable: FIT or Strava lap streams unlock segment analysis.
        </p>
      </PanelChrome>
    );
  }

  return (
    <PanelChrome title="Segment performance analysis">
      <p className={`${dash.muted} mb-4`}>
        Interpreted laps with effort role, highlights, and consistency notes.
      </p>
      <div className="overflow-x-auto rounded-xl border border-white/[0.05]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2.5 text-left">#</th>
              <th className="px-3 py-2.5 text-left">Role</th>
              <th className="px-3 py-2.5 text-left">Dist</th>
              <th className="px-3 py-2.5 text-left">Time</th>
              <th className="px-3 py-2.5 text-left">Pace</th>
              <th className="px-3 py-2.5 text-left">HR</th>
              <th className="px-3 py-2.5 text-left">Signal</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((row) => (
              <tr
                key={row.index}
                className={cn(
                  "border-b border-white/[0.03] transition-colors hover:bg-white/[0.03]",
                  row.highlight && "bg-accent/[0.05]",
                )}
              >
                <td className="px-3 py-2.5 text-zinc-500">{row.index}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                      roleStyles[row.roleTone],
                    )}
                  >
                    {row.role}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-zinc-400">{row.distance}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-zinc-400">{row.time}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-zinc-200">{row.pace}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-zinc-500">{row.hr}</td>
                <td className="px-3 py-2.5 text-xs text-accent/80">
                  {row.highlight ?? row.consistencyNote ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelChrome>
  );
}
