import type { CoachingContext } from "@/lib/coaching-context";
import type { WeeklyPlanGuardrails, WeeklyTrainingPlan, PlannedWorkout } from "./types";

function session(
  partial: Omit<PlannedWorkout, "constraintsApplied" | "reasoning"> & {
    constraintsApplied?: string[];
    reasoning?: string;
  },
): PlannedWorkout {
  return {
    constraintsApplied: partial.constraintsApplied ?? ["Deterministic fallback"],
    reasoning: partial.reasoning ?? "Conservative default session based on current training state.",
    ...partial,
  };
}

export function buildSafeFallbackWeeklyPlan(
  context: CoachingContext,
  guardrails: WeeklyPlanGuardrails,
): WeeklyTrainingPlan {
  const type = guardrails.planTypeHint;
  const cap = guardrails.maxWeeklyRunKm;
  const evidence = [
    ...guardrails.evidenceUsed,
    ...context.dataQuality.confidenceLimitations.slice(0, 2),
  ].filter(Boolean);

  let workouts: PlannedWorkout[] = [];
  let summary = "";
  let primaryGoal = "Maintain aerobic rhythm without excess fatigue";
  let hardSessionCount = 0;

  if (type === "race_week" || guardrails.raceWeek) {
    hardSessionCount = 1;
    workouts = [
      session({
        day: "Mon",
        modality: "run",
        type: "easy",
        title: "Easy aerobic",
        distanceKm: 5,
        intensity: "easy",
        purpose: "Keep legs loose without fatigue",
      }),
      session({
        day: "Wed",
        modality: "run",
        type: "easy",
        title: "Strides",
        distanceKm: 4,
        durationMin: 30,
        intensity: "easy",
        purpose: "Easy run with 4–6 × 20 sec strides — not a workout",
        constraintsApplied: ["No hard sessions before race — strides only"],
      }),
      session({
        day: "Fri",
        modality: "run",
        type: "shakeout",
        title: "Pre-race shakeout",
        distanceKm: 3,
        intensity: "easy",
        purpose: "Optional easy jog or rest",
      }),
      session({
        day: "Sun",
        modality: "run",
        type: "race",
        title: context.goal?.raceType ?? "Race",
        distanceKm: context.goal
          ? Math.round((context.goal.distanceMeters / 1000) * 10) / 10
          : 21.1,
        intensity: "hard",
        purpose: "Race execution — even pacing, trust the taper",
      }),
    ];
    summary =
      "Race week: minimal volume, one optional sharpener, race on the weekend. Freshness over fitness.";
    primaryGoal = "Arrive fresh and execute race day";
  } else if (type === "recovery" || context.currentState.fatigueState === "fatigued") {
    workouts = [
      session({
        day: "Mon",
        modality: "rest",
        type: "rest",
        title: "Rest",
        intensity: "rest",
        purpose: "Absorb recent load",
      }),
      session({
        day: "Wed",
        modality: "run",
        type: "easy",
        title: "Easy run",
        distanceKm: 6,
        intensity: "easy",
        purpose: "Conversational aerobic",
      }),
      session({
        day: "Fri",
        modality: "mobility",
        type: "mobility",
        title: "Mobility",
        durationMin: 25,
        intensity: "recovery",
        purpose: "Restore range of motion",
      }),
      session({
        day: "Sun",
        modality: "run",
        type: "easy",
        title: "Easy endurance",
        distanceKm: 7,
        intensity: "easy",
        purpose: "Optional easy volume — stop if heavy",
      }),
    ];
    summary = "Recovery week: reduced run volume, extra rest, no hard sessions.";
    primaryGoal = "Restore freshness before building again";
  } else if (type === "taper" || guardrails.taperPhase) {
    hardSessionCount = 1;
    const longKm = Math.min(guardrails.longRunMaxKm, 12);
    workouts = [
      session({
        day: "Mon",
        modality: "run",
        type: "easy",
        title: "Easy aerobic",
        distanceKm: 6,
        intensity: "easy",
        purpose: "Maintain rhythm",
      }),
      session({
        day: "Wed",
        modality: "run",
        type: "tempo",
        title: "Short tempo",
        distanceKm: 5,
        intensity: "moderate",
        purpose: "Brief steady effort — not a full workout",
        constraintsApplied: ["Single quality session"],
      }),
      session({
        day: "Sat",
        modality: "run",
        type: "long",
        title: "Moderate long run",
        distanceKm: longKm,
        intensity: "easy",
        purpose: "Last longer effort before race — keep it controlled",
      }),
      session({
        day: "Sun",
        modality: "recovery",
        type: "recovery",
        title: "Recovery",
        distanceKm: 4,
        intensity: "recovery",
        purpose: "Flush legs",
      }),
    ];
    summary = `Taper week: volume ~${Math.round(cap)} km cap, one short quality touch, controlled long run.`;
    primaryGoal = "Reduce fatigue while keeping specificity";
  } else if (!context.goal) {
    const per = Math.round((cap / 4) * 10) / 10;
    workouts = [
      session({
        day: "Mon",
        modality: "rest",
        type: "rest",
        title: "Rest or cross-train",
        intensity: "rest",
        purpose: "Recovery from weekend",
      }),
      session({
        day: "Tue",
        modality: "run",
        type: "easy",
        title: "Easy run",
        distanceKm: per,
        intensity: "easy",
        purpose: "Aerobic maintenance",
      }),
      session({
        day: "Thu",
        modality: "run",
        type: "easy",
        title: "Easy run",
        distanceKm: per,
        intensity: "easy",
        purpose: "Volume support",
      }),
      session({
        day: "Sat",
        modality: "run",
        type: "long",
        title: "Long run",
        distanceKm: Math.min(guardrails.longRunMaxKm, per * 1.4),
        intensity: "easy",
        purpose: "Weekly endurance anchor",
      }),
    ];
    summary = "Maintenance week: steady easy volume, no race-specific sharpening.";
    primaryGoal = "Sustain consistency without a target race";
  } else {
    hardSessionCount = Math.min(2, guardrails.maxHardSessions);
    const easyKm = Math.round(cap * 0.22 * 10) / 10;
    const longKm = Math.min(guardrails.longRunMaxKm, cap * 0.35);
    workouts = [
      session({
        day: "Mon",
        modality: "run",
        type: "easy",
        title: "Easy run",
        distanceKm: easyKm,
        intensity: "easy",
        purpose: "Start the week relaxed",
      }),
      session({
        day: "Wed",
        modality: "run",
        type: "tempo",
        title: "Steady tempo",
        distanceKm: Math.max(5, easyKm),
        intensity: hardSessionCount > 0 ? "hard" : "moderate",
        purpose: "Controlled quality — not all-out",
      }),
      session({
        day: "Fri",
        modality: "run",
        type: "easy",
        title: "Easy run",
        distanceKm: easyKm,
        intensity: "easy",
        purpose: "Volume between quality days",
      }),
      session({
        day: "Sun",
        modality: "run",
        type: "long",
        title: "Long run",
        distanceKm: longKm,
        intensity: "easy",
        purpose: "Durability support for goal race",
      }),
    ];
    if (context.modalityContext.strengthSummary.includes("strength")) {
      workouts.push(
        session({
          day: "Tue",
          modality: "strength",
          type: "strength",
          title: "Strength support",
          durationMin: 35,
          intensity: "moderate",
          purpose: "Maintain durability — avoid failure sets",
          constraintsApplied: ["Not within 24h of hard run"],
        }),
      );
    }
    summary = `Build week toward ${context.goal.raceType}: modest progression within ${cap} km cap.`;
    primaryGoal = `Progress toward ${context.goal.raceType} on ${context.goal.raceDate ?? "goal date"}`;
  }

  const totalRunDistanceKm =
    Math.round(
      workouts.filter((w) => w.modality === "run").reduce((s, w) => s + (w.distanceKm ?? 0), 0) *
        10,
    ) / 10;

  hardSessionCount = workouts.filter((w) => w.modality === "run" && w.intensity === "hard").length;

  return {
    weekStart: guardrails.weekStart,
    planType: type,
    summary,
    totalRunDistanceKm,
    hardSessionCount,
    workouts,
    rationale: {
      primaryGoal,
      evidenceUsed: evidence.length ? evidence : ["Limited data — conservative template"],
      tradeoffs: ["Deterministic plan used when LLM output is unavailable or invalid"],
      risksManaged: guardrails.constraintNotes.slice(0, 4),
    },
    confidence: context.dataQuality.hrCoverage === "high" ? "medium" : "low",
    limitations: [
      "This is a rule-based fallback plan, not a personalized LLM synthesis.",
      "Adjust sessions based on how you feel — not medical advice.",
      ...context.dataQuality.confidenceLimitations.slice(0, 2),
    ],
  };
}
