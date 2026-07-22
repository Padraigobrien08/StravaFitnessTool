import type { CoachingContext } from "@/lib/coaching-context";
import { parseWeeklyTrainingPlan } from "./weeklyPlanSchema";
import type {
  PlannedWorkout,
  ValidationIssue,
  ValidationResult,
  WeeklyPlanGuardrails,
  WeeklyTrainingPlan,
} from "./types";
import { DAY_ORDER } from "./weeklyPlanGuardrails";

const HARD_INTENSITY = new Set(["hard", "moderate"]);
const MEDICAL_PATTERNS = [
  /\bdiagnos(e|is|ed)\b/i,
  /\bprescri(be|ption)\b/i,
  /\bmedical advice\b/i,
  /\bsee a doctor\b/i,
  /\bguarantee(d)?\b.*\b(injury|recovery)\b/i,
  /\bclear(ed)?\b.*\b(return to play)\b/i,
];

const METRIC_CLAIM_PATTERNS = [
  /\btsb\b\s*[=:]\s*-?\d+/i,
  /\bctl\b\s*[=:]\s*\d+/i,
  /\breadiness\s*(score)?\s*(is|at|=)\s*\d{2,3}\b/i,
  /\bfreshness\s*(is|at|=)\s*\d{2,3}\b/i,
  /\bvo2\s*max\b/i,
];

function dayIndex(day: string): number {
  const d = day.slice(0, 3);
  const i = DAY_ORDER.findIndex((x) => x.toLowerCase() === d.toLowerCase());
  return i >= 0 ? i : -1;
}

function isHardRun(w: PlannedWorkout): boolean {
  if (w.modality !== "run") return false;
  if (w.type === "race") return w.intensity === "hard";
  return (
    w.intensity === "hard" || /\btempo|interval|threshold|quality\b/i.test(`${w.type} ${w.title}`)
  );
}

function countHardWorkouts(plan: WeeklyTrainingPlan): number {
  return plan.workouts.filter(isHardRun).length;
}

function totalRunKm(plan: WeeklyTrainingPlan): number {
  if (plan.totalRunDistanceKm != null) return plan.totalRunDistanceKm;
  return plan.workouts
    .filter((w) => w.modality === "run" && w.distanceKm)
    .reduce((s, w) => s + (w.distanceKm ?? 0), 0);
}

function collectPlanText(plan: WeeklyTrainingPlan): string {
  const parts = [
    plan.summary,
    plan.rationale.primaryGoal,
    ...plan.rationale.evidenceUsed,
    ...plan.rationale.tradeoffs,
    ...plan.rationale.risksManaged,
    ...plan.limitations,
    ...plan.workouts.map((w) => `${w.purpose} ${w.reasoning}`),
  ];
  if (plan.alternatives) {
    for (const a of plan.alternatives) {
      parts.push(a.summary, ...a.changes);
    }
  }
  return parts.join("\n");
}

function scanUnsupportedClaims(plan: WeeklyTrainingPlan): ValidationIssue[] {
  const text = collectPlanText(plan);
  const issues: ValidationIssue[] = [];
  const strippedForMedical = text
    .replace(/\bnot medical advice\b/gi, "")
    .replace(/\bnot a substitute for\b/gi, "");
  for (const p of MEDICAL_PATTERNS) {
    if (p.test(strippedForMedical)) {
      issues.push({
        code: "medical_claim",
        message: "Plan text may imply medical certainty or diagnosis",
        severity: "error",
      });
      break;
    }
  }
  for (const p of METRIC_CLAIM_PATTERNS) {
    if (p.test(text)) {
      issues.push({
        code: "invented_metric",
        message: "Plan may invent or restate precise metrics not in context",
        severity: "warning",
      });
      break;
    }
  }
  return issues;
}

export function validateWeeklyPlan(
  plan: WeeklyTrainingPlan,
  context: CoachingContext,
  guardrails: WeeklyPlanGuardrails,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const parsed = parseWeeklyTrainingPlan(plan);
  if (!parsed.success) {
    issues.push({
      code: "schema",
      message: parsed.error.issues[0]?.message ?? "Invalid plan schema",
      severity: "error",
    });
    return { valid: false, issues };
  }

  if (plan.weekStart !== guardrails.weekStart) {
    issues.push({
      code: "week_start",
      message: `weekStart should be ${guardrails.weekStart}`,
      severity: "warning",
    });
  }

  const hardCount = countHardWorkouts(plan);
  if (hardCount > guardrails.maxHardSessions) {
    issues.push({
      code: "hard_sessions",
      message: `${hardCount} hard runs exceeds max ${guardrails.maxHardSessions}`,
      severity: "error",
    });
  }
  if (plan.hardSessionCount > guardrails.maxHardSessions) {
    issues.push({
      code: "hard_count_field",
      message: "hardSessionCount exceeds guardrail",
      severity: "error",
    });
  }

  const runKm = totalRunKm(plan);
  if (runKm > guardrails.maxWeeklyRunKm * 1.05) {
    issues.push({
      code: "volume_high",
      message: `Run volume ~${runKm} km exceeds cap ${guardrails.maxWeeklyRunKm} km`,
      severity: "error",
    });
  }
  if (runKm > 0 && runKm < guardrails.minWeeklyRunKm * 0.85 && plan.planType !== "race_week") {
    issues.push({
      code: "volume_low",
      message: `Run volume unusually low for plan type`,
      severity: "warning",
    });
  }

  if (guardrails.raceWeek && !["taper", "race_week"].includes(plan.planType)) {
    issues.push({
      code: "race_week_type",
      message: "Race week should use planType taper or race_week",
      severity: "error",
    });
  }
  if (guardrails.daysUntilRace != null && guardrails.daysUntilRace <= 10 && hardCount > 1) {
    issues.push({
      code: "race_taper_hard",
      message: "Too many hard sessions within 10 days of race",
      severity: "error",
    });
  }

  const longRun = plan.workouts
    .filter((w) => w.modality === "run")
    .reduce((m, w) => Math.max(m, w.distanceKm ?? 0), 0);
  if (longRun > guardrails.longRunMaxKm + 1) {
    issues.push({
      code: "long_run",
      message: `Long run ${longRun} km exceeds cap ${guardrails.longRunMaxKm} km`,
      severity: "error",
    });
  }

  if (guardrails.raceWeek) {
    const hardStrength = plan.workouts.filter(
      (w) =>
        w.modality === "strength" &&
        HARD_INTENSITY.has(w.intensity) &&
        /\b(hard|heavy|max)\b/i.test(w.title + w.type),
    );
    if (hardStrength.length > 0) {
      issues.push({
        code: "race_strength",
        message: "Avoid heavy strength in race week",
        severity: "error",
      });
    }
  }

  const hardDays = plan.workouts
    .filter((w) => w.modality === "run" && w.intensity === "hard")
    .map((w) => dayIndex(w.day))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  for (let i = 1; i < hardDays.length; i++) {
    if (hardDays[i] - hardDays[i - 1] < guardrails.minEasyDaysBetweenHard + 1) {
      issues.push({
        code: "intensity_stacking",
        message: "Hard run sessions are stacked without recovery spacing",
        severity: "error",
      });
      break;
    }
  }

  const restDays = plan.workouts.filter(
    (w) => w.modality === "rest" || w.intensity === "rest",
  ).length;
  if (restDays < guardrails.minRestDays && plan.planType !== "build") {
    issues.push({
      code: "rest_days",
      message: `Include at least ${guardrails.minRestDays} rest day(s)`,
      severity: "warning",
    });
  }

  if (!plan.rationale?.evidenceUsed?.length) {
    issues.push({
      code: "rationale",
      message: "Missing rationale.evidenceUsed",
      severity: "error",
    });
  }
  if (!plan.limitations?.length) {
    issues.push({
      code: "limitations",
      message: "Missing limitations",
      severity: "error",
    });
  }

  issues.push(...scanUnsupportedClaims(plan));

  const hardCross = plan.workouts.filter(
    (w) =>
      w.modality === "cross_training" &&
      (w.intensity === "hard" || /\bhiit|crossfit\b/i.test(w.type)),
  );
  if (guardrails.avoidIntensityStacking && hardCross.length > 0 && hardCount >= 1) {
    issues.push({
      code: "modality_interference",
      message: "Hard cross-training plus hard runs may violate interference guardrails",
      severity: "warning",
    });
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  return { valid: !hasErrors, issues };
}
