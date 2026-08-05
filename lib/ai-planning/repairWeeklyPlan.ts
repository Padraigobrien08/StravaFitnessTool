import type { WeeklyPlanGuardrails, WeeklyTrainingPlan, PlannedWorkout } from "./types";
import { softenMedicalLanguage } from "@/lib/safety/medicalLanguage";

function isHardRun(w: PlannedWorkout): boolean {
  if (w.modality !== "run") return false;
  if (w.type === "race") return w.intensity === "hard";
  return (
    w.intensity === "hard" || /\btempo|interval|threshold|quality\b/i.test(`${w.type} ${w.title}`)
  );
}

export function repairWeeklyPlan(
  plan: WeeklyTrainingPlan,
  guardrails: WeeklyPlanGuardrails,
): WeeklyTrainingPlan {
  let workouts = [...plan.workouts];

  if (plan.weekStart !== guardrails.weekStart) {
    plan = { ...plan, weekStart: guardrails.weekStart };
  }

  if (guardrails.raceWeek && plan.planType !== "race_week" && plan.planType !== "taper") {
    plan = { ...plan, planType: "race_week" };
  }

  const hardIndices = workouts.map((w, i) => (isHardRun(w) ? i : -1)).filter((i) => i >= 0);

  if (hardIndices.length > guardrails.maxHardSessions) {
    const keep = hardIndices.slice(0, guardrails.maxHardSessions);
    workouts = workouts.map((w, i) => {
      if (hardIndices.includes(i) && !keep.includes(i)) {
        return {
          ...w,
          intensity: "easy" as const,
          type: "easy",
          title: w.title.replace(/tempo|interval|hard/gi, "easy"),
          constraintsApplied: [
            ...w.constraintsApplied,
            `Capped to ${guardrails.maxHardSessions} hard session(s)`,
          ],
          reasoning: `${w.reasoning} (adjusted: hard session cap)`,
        };
      }
      return w;
    });
  }

  workouts = workouts.map((w) => {
    if (w.modality === "run" && (w.distanceKm ?? 0) > guardrails.longRunMaxKm + 0.5) {
      return {
        ...w,
        distanceKm: guardrails.longRunMaxKm,
        constraintsApplied: [
          ...w.constraintsApplied,
          `Long run capped at ${guardrails.longRunMaxKm} km`,
        ],
      };
    }
    if (guardrails.raceWeek && w.modality === "strength" && /\b(hard|heavy|max)\b/i.test(w.title)) {
      return {
        ...w,
        intensity: "easy" as const,
        type: "mobility",
        title: "Light mobility / activation",
        constraintsApplied: [...w.constraintsApplied, "No heavy strength in race week"],
      };
    }
    return w;
  });

  const runKm = workouts
    .filter((w) => w.modality === "run")
    .reduce((s, w) => s + (w.distanceKm ?? 0), 0);

  let scaled = workouts;
  if (runKm > guardrails.maxWeeklyRunKm) {
    const scale = guardrails.maxWeeklyRunKm / runKm;
    scaled = workouts.map((w) =>
      w.modality === "run" && w.distanceKm
        ? {
            ...w,
            distanceKm: Math.round(w.distanceKm * scale * 10) / 10,
            constraintsApplied: [...w.constraintsApplied, "Volume scaled to weekly cap"],
          }
        : w,
    );
  }

  const hardSessionCount = scaled.filter(isHardRun).length;

  const limitations = [
    ...plan.limitations,
    "Plan was automatically adjusted to satisfy StrideIQ safety guardrails.",
  ];

  return {
    ...plan,
    workouts: scaled,
    hardSessionCount,
    totalRunDistanceKm:
      Math.round(
        scaled.filter((w) => w.modality === "run").reduce((s, w) => s + (w.distanceKm ?? 0), 0) *
          10,
      ) / 10,
    limitations: [...new Set(limitations)].slice(0, 8),
    rationale: {
      ...plan.rationale,
      risksManaged: [...plan.rationale.risksManaged, "Guardrail repair applied where needed"],
    },
  };
}

/**
 * Soften medical wording across **every** prose field of the plan.
 *
 * Field coverage matters as much as vocabulary: this previously cleaned only
 * `summary`, `purpose`, `reasoning` and `limitations`, so medical language in the
 * rationale or alternatives reached the user untouched. Anything not rewritable
 * is caught by `containsMedicalClaim` in the integrity layer, which fails the plan
 * and ultimately swaps in the safe fallback.
 *
 * `day`, `weekStart`, `modality` and `intensity` are structural/enum fields and
 * are deliberately left alone.
 */
export function stripMedicalLanguage(plan: WeeklyTrainingPlan): WeeklyTrainingPlan {
  const clean = softenMedicalLanguage;

  return {
    ...plan,
    summary: clean(plan.summary),
    workouts: plan.workouts.map((w) => ({
      ...w,
      type: clean(w.type),
      title: clean(w.title),
      purpose: clean(w.purpose),
      reasoning: clean(w.reasoning),
      constraintsApplied: w.constraintsApplied.map(clean),
    })),
    limitations: plan.limitations.map(clean),
    rationale: {
      ...plan.rationale,
      primaryGoal: clean(plan.rationale.primaryGoal),
      evidenceUsed: plan.rationale.evidenceUsed.map(clean),
      tradeoffs: plan.rationale.tradeoffs.map(clean),
      risksManaged: plan.rationale.risksManaged.map(clean),
    },
    ...(plan.alternatives
      ? {
          alternatives: plan.alternatives.map((a) => ({
            ...a,
            name: clean(a.name),
            summary: clean(a.summary),
            changes: a.changes.map(clean),
          })),
        }
      : {}),
  };
}
