import type { CoachingContext } from "@/lib/coaching-context/types";
import type { RaceGoal } from "@/lib/analytics/readiness";
import { allBeliefs } from "./beliefUtils";
import type { AthleteBelief, AthleteMemoryProfile, RelevantMemorySelection } from "./types";

function scoreBelief(
  belief: AthleteBelief,
  ctx: {
    daysUntilRace?: number;
    fatigueHeavy: boolean;
    raceWeek: boolean;
    hybrid: boolean;
  },
): number {
  let score = 0;
  if (belief.confidence === "high") score += 3;
  else if (belief.confidence === "medium") score += 2;
  else score += 1;
  if (belief.stability === "stable") score += 2;
  else if (belief.stability === "emerging") score += 1;
  if (belief.stability === "weakening") score -= 1;

  if (ctx.raceWeek && belief.category === "taper") score += 4;
  if (ctx.daysUntilRace != null && ctx.daysUntilRace <= 28) {
    if (belief.category === "taper" || belief.category === "pacing") score += 2;
  }
  if (ctx.fatigueHeavy && belief.category === "fatigue") score += 4;
  if (ctx.hybrid && belief.category === "modality") score += 3;
  if (belief.category === "durability") score += 1;

  return score;
}

export function selectRelevantBeliefs(
  profile: AthleteMemoryProfile,
  opts?: {
    goal?: RaceGoal | null;
    coachingContext?: CoachingContext | null;
    maxBeliefs?: number;
    forPlanning?: boolean;
  },
): RelevantMemorySelection {
  let days: number | undefined = opts?.coachingContext?.goal?.daysUntilRace;
  if (days == null && opts?.goal?.date) {
    const d = Math.ceil((new Date(opts.goal.date).getTime() - Date.now()) / 86400000);
    if (d >= 0) days = d;
  }

  const fatigueHeavy =
    opts?.coachingContext?.currentState.fatigueState === "fatigued" ||
    (opts?.coachingContext?.currentState.freshness != null &&
      opts.coachingContext.currentState.freshness < 45);

  const raceWeek = opts?.coachingContext?.constraints.raceWeek || (days != null && days <= 7);

  const hybrid =
    opts?.coachingContext?.modalityContext.athleteArchetype === "hybrid_runner" ||
    opts?.coachingContext?.modalityContext.athleteArchetype === "multisport";

  const scored = allBeliefs(profile)
    .filter((b) => b.stability !== "weakening" || b.confidence === "medium")
    .map((b) => ({
      belief: b,
      score: scoreBelief(b, { daysUntilRace: days, fatigueHeavy, raceWeek, hybrid }),
    }))
    .sort((a, b) => b.score - a.score);

  const max = opts?.maxBeliefs ?? (opts?.forPlanning ? 5 : 6);
  const beliefs = scored.slice(0, max).map((s) => s.belief);

  const planningNotes: string[] = [];
  if (opts?.forPlanning) {
    for (const b of beliefs) {
      if (b.category === "fatigue" && /hard|density|stack/i.test(b.statement)) {
        planningNotes.push("Memory: avoid stacking hard sessions. " + b.recommendedUse);
      }
      if (b.category === "modality" && /interference/i.test(b.statement)) {
        planningNotes.push("Memory: separate hard cross-training from key runs");
      }
      if (b.category === "taper" && raceWeek) {
        planningNotes.push("Memory: prioritise taper/freshness. " + b.recommendedUse);
      }
    }
  }

  return { beliefs, planningNotes };
}

export function highestValueBeliefs(profile: AthleteMemoryProfile, max = 6): AthleteBelief[] {
  return selectRelevantBeliefs(profile, { maxBeliefs: max }).beliefs;
}
