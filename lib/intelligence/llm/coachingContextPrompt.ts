import {
  buildCoachingContextFromBundle,
  serializeCoachingContextForLLM,
} from "@/lib/coaching-context";
import { computeAthleteIntelligence, resolveIntelligenceContext } from "../service";
import type { IntelligenceContext } from "../types";
import { COACH_SYSTEM } from "./types";

export async function buildCoachSystemWithContext(ctx: IntelligenceContext): Promise<string> {
  const [bundle, resolved] = await Promise.all([
    computeAthleteIntelligence(ctx),
    resolveIntelligenceContext(ctx.userId, ctx),
  ]);
  const maxKm = resolved.settings.maxWeeklyKm > 0 ? resolved.settings.maxWeeklyKm : undefined;
  const coaching = buildCoachingContextFromBundle(bundle, resolved.raceGoal ?? null, maxKm);
  const block = serializeCoachingContextForLLM(coaching);
  return `${COACH_SYSTEM}

---
Structured athlete coaching context (deterministic analytics + per-run execution detail; do not invent metrics contradicting this block). For one run, call get_run_detail with runId or date:
${block}`;
}
