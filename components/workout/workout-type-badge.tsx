import type { WorkoutType } from "@/lib/analytics/workoutType";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const styles: Record<WorkoutType, string> = {
  easy: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  recovery: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  long: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  tempo: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  interval: "bg-red-500/15 text-red-400 border-red-500/25",
  race: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25",
  unknown: "bg-zinc-500/10 text-zinc-500 border-white/10",
};

function WorkoutBadgeInner({
  type,
  confidence,
}: {
  type: WorkoutType;
  confidence?: "low" | "medium" | "high";
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", styles[type])}>
      {WORKOUT_TYPE_LABELS[type]}
      {confidence === "low" && (
        <span className="opacity-60" aria-hidden>
          ?
        </span>
      )}
    </Badge>
  );
}

export function WorkoutTypeBadge({
  type,
  confidence,
}: {
  type: WorkoutType;
  confidence?: "low" | "medium" | "high";
}) {
  if (!confidence) {
    return <WorkoutBadgeInner type={type} confidence={confidence} />;
  }

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex">
        <WorkoutBadgeInner type={type} confidence={confidence} />
      </TooltipTrigger>
      <TooltipContent>Confidence: {confidence}</TooltipContent>
    </Tooltip>
  );
}
