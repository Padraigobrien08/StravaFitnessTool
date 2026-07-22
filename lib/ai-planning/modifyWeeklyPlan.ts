import type { PlanModificationKind } from "./planningIntent";
import type { WeeklyPlanGuardrails, WeeklyTrainingPlan } from "./types";

function normalizeDay(day: string): string {
  return day.slice(0, 3).charAt(0).toUpperCase() + day.slice(1, 3).toLowerCase();
}

function recalcTotals(plan: WeeklyTrainingPlan): WeeklyTrainingPlan {
  const runKm = plan.workouts
    .filter((w) => w.modality === "run")
    .reduce((s, w) => s + (w.distanceKm ?? 0), 0);
  const hardSessionCount = plan.workouts.filter(
    (w) =>
      w.modality === "run" &&
      (w.intensity === "hard" || /\btempo|interval|threshold|race\b/i.test(`${w.type} ${w.title}`)),
  ).length;
  return {
    ...plan,
    totalRunDistanceKm: Math.round(runKm * 10) / 10,
    hardSessionCount,
  };
}

export function applyPlanModification(
  plan: WeeklyTrainingPlan,
  modification: PlanModificationKind,
  guardrails: WeeklyPlanGuardrails,
  opts?: { availableDays?: string[] },
): WeeklyTrainingPlan {
  let workouts = [...plan.workouts];

  switch (modification) {
    case "remove_strength":
      workouts = workouts.filter((w) => w.modality !== "strength");
      break;
    case "add_mobility": {
      if (!workouts.some((w) => w.modality === "mobility")) {
        workouts.push({
          day: "Thu",
          modality: "mobility",
          type: "mobility",
          title: "Mobility / recovery",
          durationMin: 25,
          intensity: "recovery",
          purpose: "Support recovery and range of motion",
          constraintsApplied: ["Added per athlete request"],
          reasoning: "Light mobility complements run load without adding intensity.",
        });
      }
      break;
    }
    case "reduce_volume":
      workouts = workouts.map((w) =>
        w.modality === "run" && w.distanceKm
          ? {
              ...w,
              distanceKm: Math.round(w.distanceKm * 0.85 * 10) / 10,
              constraintsApplied: [...w.constraintsApplied, "Volume reduced ~15%"],
            }
          : w,
      );
      break;
    case "more_conservative":
      workouts = workouts.map((w) => {
        if (w.modality !== "run") return w;
        if (w.intensity === "hard") {
          return {
            ...w,
            intensity: "moderate" as const,
            type: "steady",
            title: w.title.replace(/hard|tempo|interval/gi, "steady"),
            constraintsApplied: [...w.constraintsApplied, "Softened for conservative adjustment"],
          };
        }
        return w;
      });
      if (plan.hardSessionCount > 1) {
        let hardSeen = 0;
        workouts = workouts.map((w) => {
          if (
            w.modality === "run" &&
            (w.intensity === "hard" || w.intensity === "moderate") &&
            /\btempo|interval|threshold\b/i.test(w.type)
          ) {
            hardSeen++;
            if (hardSeen > guardrails.maxHardSessions) {
              return {
                ...w,
                intensity: "easy" as const,
                type: "easy",
                constraintsApplied: [
                  ...w.constraintsApplied,
                  "Capped hard sessions (conservative)",
                ],
              };
            }
          }
          return w;
        });
      }
      break;
    case "more_aggressive": {
      const easyRun = workouts.find(
        (w) => w.modality === "run" && w.intensity === "easy" && w.type !== "race",
      );
      if (
        easyRun &&
        plan.hardSessionCount < guardrails.maxHardSessions &&
        plan.planType !== "race_week"
      ) {
        workouts = workouts.map((w) =>
          w === easyRun
            ? {
                ...w,
                intensity: "moderate" as const,
                type: "tempo",
                title: "Controlled tempo",
                purpose: "Modest quality touch — still within guardrails",
                constraintsApplied: [
                  ...w.constraintsApplied,
                  "Aggressive-but-safe: one quality upgrade",
                ],
              }
            : w,
        );
      }
      break;
    }
    case "limit_days": {
      const allowed = new Set((opts?.availableDays ?? []).map(normalizeDay));
      if (allowed.size > 0) {
        workouts = workouts
          .filter((w) => {
            if (w.modality === "rest") return true;
            return allowed.has(normalizeDay(w.day));
          })
          .map((w) => ({
            ...w,
            constraintsApplied: [
              ...w.constraintsApplied,
              `Scheduled for available days: ${[...allowed].join(", ")}`,
            ],
          }));
      }
      break;
    }
  }

  const limitations = [
    ...plan.limitations,
    `Adjusted: ${modification.replace(/_/g, " ")} (follow-up)`,
  ];

  return recalcTotals({
    ...plan,
    workouts,
    limitations: [...new Set(limitations)].slice(0, 8),
    rationale: {
      ...plan.rationale,
      tradeoffs: [...plan.rationale.tradeoffs, `Follow-up modification applied: ${modification}`],
    },
  });
}
