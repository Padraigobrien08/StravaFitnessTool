import type { WorkoutType } from "@/lib/analytics/workoutType";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import { cn } from "@/lib/utils";

const typeStyles: Record<WorkoutType, string> = {
  easy: "bg-teal-500/12 text-teal-300 ring-teal-500/20",
  recovery: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/15",
  tempo: "bg-amber-500/12 text-amber-300 ring-amber-500/20",
  interval: "bg-amber-500/12 text-amber-300 ring-amber-500/20",
  long: "bg-blue-500/12 text-blue-300 ring-blue-500/20",
  race: "bg-fuchsia-500/12 text-fuchsia-300 ring-fuchsia-500/15",
  unknown: "bg-white/[0.04] text-zinc-500 ring-white/10",
};

/** Horizontal planner row: Mon · Easy · 5–7 km */
export function WorkoutSessionRow({
  day,
  type,
  kmRange,
  loadScore,
}: {
  day: string;
  type: WorkoutType;
  label?: string;
  kmRange?: string;
  loadScore?: number;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2.5 transition-colors duration-200 hover:bg-white/[0.03]">
      <span className="w-9 shrink-0 text-xs font-medium text-zinc-500">{day}</span>
      <span
        className={cn(
          "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
          typeStyles[type],
        )}
      >
        {WORKOUT_TYPE_LABELS[type]}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{kmRange ?? "—"}</span>
      {loadScore != null ? (
        <span className="shrink-0 text-[10px] tabular-nums text-zinc-600">L{loadScore}</span>
      ) : null}
    </div>
  );
}
