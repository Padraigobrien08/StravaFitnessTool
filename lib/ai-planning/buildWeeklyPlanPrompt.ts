import { serializeCoachingContextForLLM } from "@/lib/coaching-context";
import type { CoachingContext } from "@/lib/coaching-context";
import type { OpenAIMessage, WeeklyPlanGuardrails } from "./types";

const SYSTEM_INSTRUCTION = `You are an endurance planning assistant operating inside StrideIQ.

Rules:
- Use ONLY the provided coaching context and guardrails. Do not invent metrics (TSB, CTL, readiness scores, VO2max, etc.).
- Do not provide medical advice, diagnoses, or guarantees about injury or recovery.
- Generate a realistic NEXT calendar week training plan (weekStart date provided).
- Preserve freshness near race day. Avoid intensity stacking (space hard run days).
- Respect modality context — do not schedule hard cross-training adjacent to key runs.
- Every workout must include purpose, constraintsApplied, and reasoning tied to evidence in context.
- Populate rationale.evidenceUsed with specific items from context (not generic platitudes).
- Include limitations acknowledging data gaps when confidence is low.
- Output must match the JSON schema exactly — no markdown.`;

export function buildWeeklyPlanPrompt(
  context: CoachingContext,
  guardrails: WeeklyPlanGuardrails,
  opts?: {
    planPreference?: string;
    availableDays?: string[];
    extraConstraints?: string[];
    planningContext?: string;
  },
): OpenAIMessage[] {
  const contextBlock = serializeCoachingContextForLLM(context, {
    maxChars: 20000,
  });

  const guardrailBlock = [
    "## Hard guardrails (must obey)",
    `weekStart: ${guardrails.weekStart}`,
    `planType hint: ${guardrails.planTypeHint}`,
    `maxHardSessions: ${guardrails.maxHardSessions}`,
    `weekly run volume: ${guardrails.minWeeklyRunKm}–${guardrails.maxWeeklyRunKm} km`,
    `max volume change vs recent: ${guardrails.maxVolumeIncreasePct}%`,
    `long run cap: ${guardrails.longRunMaxKm} km`,
    `min rest days: ${guardrails.minRestDays}`,
    `min easy day(s) between hard runs: ${guardrails.minEasyDaysBetweenHard}`,
    `no hard strength within ${guardrails.noHardStrengthHoursBeforeRace}h of race`,
    `raceWeek: ${guardrails.raceWeek}`,
    guardrails.daysUntilRace != null ? `daysUntilRace: ${guardrails.daysUntilRace}` : "",
    `avoidIntensityStacking: ${guardrails.avoidIntensityStacking}`,
    "",
    "Constraint notes:",
    ...guardrails.constraintNotes.map((n) => `- ${n}`),
    "",
    "Evidence to reference:",
    ...guardrails.evidenceUsed.map((e) => `- ${e}`),
  ]
    .filter(Boolean)
    .join("\n");

  const prefNote = opts?.planPreference ? `Athlete preference: ${opts.planPreference}.` : "";
  const daysNote = opts?.availableDays?.length
    ? `Only schedule workouts on: ${opts.availableDays.join(", ")}.`
    : "";
  const extraNote = opts?.extraConstraints?.length
    ? `Additional constraints:\n${opts.extraConstraints.map((c) => `- ${c}`).join("\n")}`
    : "";
  const contextNote = opts?.planningContext?.trim()
    ? `## Athlete planning context (priority — honor this)\n${opts.planningContext.trim()}`
    : "";

  const userTask = `Build the next week training plan (Monday weekStart ${guardrails.weekStart}).
${prefNote}
${daysNote}
${extraNote}
${contextNote ? `\n${contextNote}\n` : ""}
Requirements:
- planType should align with guardrails (hint: ${guardrails.planTypeHint})
- hardSessionCount must equal count of hard run sessions in workouts
- Include 3–7 workouts covering the week; use rest days where appropriate
- If race week, place race on appropriate day and taper volume
- Optional: up to 2 alternatives with small adjustments
- confidence must reflect data quality in context

Return JSON only per schema.`;

  return [
    { role: "system", content: SYSTEM_INSTRUCTION },
    {
      role: "user",
      content: `${guardrailBlock}\n\n---\n\n## Coaching context\n\n${contextBlock}\n\n---\n\n${userTask}`,
    },
  ];
}
