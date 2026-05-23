import type { WorkoutClassification } from "@/lib/analytics/workoutType";
import type { ExecutionQuality } from "./types";

export function inferLikelyAdaptation(
  workout: WorkoutClassification,
  executionQuality: ExecutionQuality,
  lateFadePct: number | null
): string[] {
  const out: string[] = [];
  const type = workout.type;

  if (type === "easy" || type === "recovery") {
    if (executionQuality === "strong" || executionQuality === "excellent") {
      out.push("Likely supports aerobic base maintenance with low structural stress");
    } else {
      out.push("Easy stimulus present; execution variability may limit adaptation signal");
    }
  }

  if (type === "tempo" || type === "interval") {
    if (executionQuality === "strong" || executionQuality === "excellent") {
      out.push("Appears to support lactate-threshold / HM-specific adaptation");
    } else if (executionQuality === "moderate") {
      out.push("Threshold stimulus present; uneven execution may reduce adaptation yield");
    } else {
      out.push("Quality work attempted; fatigue may have limited threshold adaptation");
    }
  }

  if (type === "long") {
    if (lateFadePct != null && lateFadePct > 8) {
      out.push("Durability signal mixed — late fade suggests aerobic limit under length");
    } else if (executionQuality === "strong" || executionQuality === "excellent") {
      out.push("Supports HM durability and glycogen management patterns");
    } else {
      out.push("Long-run time-on-feet stimulus with moderate execution quality");
    }
  }

  if (type === "race") {
    out.push("Race-specific execution and pacing practice");
  }

  return out.slice(0, 3);
}
