import type { WorkoutType } from "@/lib/analytics/workoutType";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";

const styles: Record<WorkoutType, string> = {
  easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  recovery: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  long: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  tempo: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  interval: "bg-red-500/15 text-red-400 border-red-500/25",
  race: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25",
  unknown: "bg-zinc-500/10 text-zinc-500 border-white/10",
};

export function WorkoutTypeBadge({
  type,
  confidence,
}: {
  type: WorkoutType;
  confidence?: "low" | "medium" | "high";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${styles[type]}`}
      title={confidence ? `Confidence: ${confidence}` : undefined}
    >
      {WORKOUT_TYPE_LABELS[type]}
      {confidence === "low" && (
        <span className="opacity-60" aria-hidden>
          ?
        </span>
      )}
    </span>
  );
}
