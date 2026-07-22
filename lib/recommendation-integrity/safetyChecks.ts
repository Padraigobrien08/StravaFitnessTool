import type { RecommendationIssue, WeeklyPlanIntegrityInput } from "./types";
import { DAY_ORDER } from "@/lib/ai-planning/weeklyPlanGuardrails";

const MEDICAL_PATTERNS = [
  /\bdiagnos(e|is|ed)\b/i,
  /\bprescri(be|ption)\b/i,
  /\bmedical advice\b/i,
  /\binjury[- ]free guarantee\b/i,
  /\bguarantee(d)?\b.*\b(injury|recovery)\b/i,
  /\bcleared for\b.*\b(race|training)\b/i,
  /\bmedically ready\b/i,
  /\bprevent(s|ing)?\b.*\binjur/i,
];

const PRECISION_PATTERNS = [
  /\bexactly\s+\d+(\.\d+)?\s*km\b/i,
  /\bprecisely\s+\d+\s*min\b/i,
  /\bmust hit\s+\d+:\d{2}\b/i,
  /\b\d+\.\d{2}\s*km\b.*\bevery\b/i,
];

function dayIndex(day: string): number {
  const d = day.slice(0, 3);
  return DAY_ORDER.findIndex((x) => x.toLowerCase() === d.toLowerCase());
}

function isHardRun(w: WeeklyPlanIntegrityInput["plan"]["workouts"][0]): boolean {
  if (w.modality !== "run") return false;
  if (w.type === "race") return w.intensity === "hard";
  return (
    w.intensity === "hard" || /\btempo|interval|threshold|quality\b/i.test(`${w.type} ${w.title}`)
  );
}

function totalRunKm(plan: WeeklyPlanIntegrityInput["plan"]): number {
  if (plan.totalRunDistanceKm != null) return plan.totalRunDistanceKm;
  return plan.workouts
    .filter((w) => w.modality === "run")
    .reduce((s, w) => s + (w.distanceKm ?? 0), 0);
}

function recentWeeklyKm(context: WeeklyPlanIntegrityInput["context"]): number {
  const weeks = context.recentTraining.weeks;
  if (!weeks.length) return 0;
  return weeks[weeks.length - 1]?.runDistanceKm ?? 0;
}

export function runSafetyChecks(input: WeeklyPlanIntegrityInput): RecommendationIssue[] {
  const { plan, context, guardrails } = input;
  const issues: RecommendationIssue[] = [];
  const text = [
    plan.summary,
    ...plan.limitations,
    ...plan.workouts.map((w) => `${w.purpose} ${w.reasoning} ${w.title}`),
  ].join("\n");

  const strippedMedical = text
    .replace(/\bnot medical advice\b/gi, "")
    .replace(/\bnot a substitute\b/gi, "");

  for (const p of MEDICAL_PATTERNS) {
    if (p.test(strippedMedical)) {
      issues.push({
        type: "medical_claim",
        severity: "high",
        message: "Plan text may include medical diagnosis or injury certainty",
        suggestedFix: "Remove medical claims; use training-load language only",
      });
      break;
    }
  }

  const recentKm = recentWeeklyKm(context);
  const planKm = totalRunKm(plan);
  if (recentKm > 0 && planKm > recentKm * (1 + guardrails.maxVolumeIncreasePct / 100 + 0.08)) {
    issues.push({
      type: "unsafe_progression",
      severity: "high",
      message: `Weekly volume jump (~${planKm} km vs recent ~${recentKm} km) exceeds safe progression`,
      suggestedFix: `Keep volume within ${guardrails.maxVolumeIncreasePct}% of recent week unless recovery block`,
    });
  }

  const hardDays = plan.workouts
    .filter(isHardRun)
    .map((w) => dayIndex(w.day))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);

  for (let i = 1; i < hardDays.length; i++) {
    if (hardDays[i] - hardDays[i - 1] <= 1) {
      const advanced =
        context.dataQuality.activityCount >= 40 && context.currentState.fatigueState === "fresh";
      if (!advanced) {
        issues.push({
          type: "unsafe_progression",
          severity: "high",
          message: "Hard runs on consecutive days without recovery spacing",
          suggestedFix: "Insert at least one easy or rest day between hard sessions",
        });
      } else {
        issues.push({
          type: "unsafe_progression",
          severity: "medium",
          message: "Back-to-back hard days — only appropriate with strong freshness evidence",
          suggestedFix: "Add easy day between hard sessions unless explicitly justified",
        });
      }
      break;
    }
  }

  if (guardrails.raceWeek || (guardrails.daysUntilRace != null && guardrails.daysUntilRace <= 3)) {
    const hardStrength = plan.workouts.filter(
      (w) =>
        w.modality === "strength" &&
        (w.intensity === "hard" || /\b(hard|heavy|max|hiit)\b/i.test(`${w.title} ${w.type}`)),
    );
    if (hardStrength.length > 0) {
      issues.push({
        type: "race_week_violation",
        severity: "high",
        message: "Heavy strength scheduled close to race",
        suggestedFix: "Use mobility or rest only; no hard strength within race week",
      });
    }
  }

  const keyRunDay = plan.workouts.find(
    (w) =>
      w.modality === "run" &&
      (w.type === "long" ||
        (w.distanceKm ?? 0) >= guardrails.longRunMaxKm * 0.85 ||
        /\blong run|race\b/i.test(w.title)),
  );
  if (keyRunDay) {
    const keyIdx = dayIndex(keyRunDay.day);
    const nearStrength = plan.workouts.some(
      (w) =>
        w.modality === "strength" &&
        /\b(hard|heavy)\b/i.test(w.title) &&
        Math.abs(dayIndex(w.day) - keyIdx) <= 1,
    );
    if (nearStrength) {
      issues.push({
        type: "modality_interference",
        severity: "medium",
        message: "Hard strength placed adjacent to key run or long run",
        suggestedFix: "Move strength 48h+ from long run or quality session",
      });
    }
  }

  const longOrHard = plan.workouts.filter(
    (w) =>
      w.modality === "run" &&
      (isHardRun(w) || (w.distanceKm ?? 0) >= guardrails.longRunMaxKm * 0.75),
  );
  for (const session of longOrHard) {
    const idx = dayIndex(session.day);
    const next = plan.workouts.find(
      (w) => dayIndex(w.day) === idx + 1 && w.modality === "run" && isHardRun(w),
    );
    if (next) {
      issues.push({
        type: "unsafe_progression",
        severity: "medium",
        message: "Hard or long run not followed by adequate recovery",
        suggestedFix: "Schedule easy run or rest after long/hard day",
      });
      break;
    }
  }

  if (guardrails.avoidIntensityStacking) {
    const hardCross = plan.workouts.filter(
      (w) =>
        (w.modality === "cross_training" || w.modality === "strength") &&
        (w.intensity === "hard" || /\bhiit|crossfit\b/i.test(w.type)),
    );
    if (hardCross.length > 0 && hardDays.length >= 1) {
      issues.push({
        type: "modality_interference",
        severity: "medium",
        message: "Hard cross-training combined with hard runs under interference guardrails",
        suggestedFix: "Keep cross-training easy when run intensity is elevated",
      });
    }
  }

  for (const p of PRECISION_PATTERNS) {
    if (p.test(text)) {
      issues.push({
        type: "excessive_precision",
        severity: "low",
        message: "Plan uses overly exact prescriptions where ranges are safer",
        suggestedFix: "Use approximate distance/duration ranges (e.g. 8–10 km)",
      });
      break;
    }
  }

  return issues;
}
