import type { PlanPreference, WeeklyPlanGuardrails } from "./types";

export function applyPlanPreferenceToGuardrails(
  guardrails: WeeklyPlanGuardrails,
  preference?: PlanPreference
): WeeklyPlanGuardrails {
  if (!preference || preference === "balanced") return guardrails;

  if (preference === "conservative") {
    return {
      ...guardrails,
      maxHardSessions: Math.max(0, guardrails.maxHardSessions - 1),
      maxWeeklyRunKm: Math.round(guardrails.maxWeeklyRunKm * 0.9 * 10) / 10,
      maxVolumeIncreasePct: Math.min(guardrails.maxVolumeIncreasePct, 5),
      longRunMaxKm: Math.round(guardrails.longRunMaxKm * 0.9 * 10) / 10,
      constraintNotes: [
        ...guardrails.constraintNotes,
        "Conservative preference: reduced volume and hard-session cap",
      ],
    };
  }

  return {
    ...guardrails,
    maxHardSessions: Math.min(
      guardrails.maxHardSessions + 1,
      guardrails.raceWeek ? 1 : 2
    ),
    maxWeeklyRunKm: Math.round(guardrails.maxWeeklyRunKm * 1.05 * 10) / 10,
    maxVolumeIncreasePct: Math.min(guardrails.maxVolumeIncreasePct + 5, 15),
    constraintNotes: [
      ...guardrails.constraintNotes,
      "Aggressive-but-safe: slight volume/quality headroom within caps",
    ],
  };
}
