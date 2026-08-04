import type { WeeklyPlanType } from "@/lib/ai-planning/types";

export interface PlanContextHints {
  planTypeHint?: WeeklyPlanType;
  notes: string[];
}

/** Lightweight keyword hints for fallback/guardrails when athlete adds freeform context. */
export function inferPlanHintsFromContext(text: string): PlanContextHints {
  const t = text.trim();
  if (!t) return { notes: [] };

  const notes: string[] = [];
  let planTypeHint: WeeklyPlanType | undefined;

  const postRace =
    /\b(just|finished|completed|ran|done|raced)\b/i.test(t) &&
    /\b(half marathon|hm|marathon|10k|race)\b/i.test(t);
  const recoveryAsk = /\b(recover|recovery|rest week|easy week|de-load|deload)\b/i.test(t);
  const conservative =
    /\b(conservative|cautious|gentle|minimal|very easy|illness|injury|sick)\b/i.test(t);
  const travel = /\b(travel|away|trip|unavailable|can't run|cannot run)\b/i.test(t);

  if (postRace || recoveryAsk) {
    planTypeHint = "recovery";
    notes.push("Athlete context suggests post-race or explicit recovery focus");
  }
  if (conservative) {
    planTypeHint = planTypeHint ?? "recovery";
    notes.push("Athlete requested conservative loading");
  }
  if (travel) {
    notes.push("Schedule constraints mentioned: respect unavailable days");
  }

  return { planTypeHint, notes };
}
