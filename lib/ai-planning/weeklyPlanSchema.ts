import { z } from "zod";

/**
 * A field the model may legitimately omit.
 *
 * OpenAI strict structured outputs has no notion of an optional property: every key
 * must appear in `required`, and "absent" is expressed by allowing null. So the model
 * sends `null`, which plain `.optional()` rejects — the plan would parse-fail and fall
 * back for the sake of a missing distance. Accept null and erase it, keeping the
 * downstream type `T | undefined` exactly as before.
 */
const optionalNumber = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .nullish()
    .transform((v) => v ?? undefined);

const plannedWorkoutSchema = z.object({
  day: z.string().min(2).max(12),
  modality: z.enum([
    "run",
    "bike",
    "swim",
    "strength",
    "mobility",
    "recovery",
    "rest",
    "cross_training",
  ]),
  type: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  durationMin: optionalNumber(0, 600),
  distanceKm: optionalNumber(0, 80),
  intensity: z.enum(["easy", "moderate", "hard", "recovery", "rest"]),
  purpose: z.string().min(1).max(300),
  constraintsApplied: z.array(z.string().max(200)).max(8),
  reasoning: z.string().min(1).max(400),
});

export const weeklyTrainingPlanSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planType: z.enum(["build", "maintain", "taper", "recovery", "race_week"]),
  summary: z.string().min(10).max(600),
  totalRunDistanceKm: optionalNumber(0, 250),
  totalTrainingMinutes: optionalNumber(0, 2000),
  hardSessionCount: z.number().int().min(0).max(7),
  workouts: z.array(plannedWorkoutSchema).min(3).max(14),
  rationale: z.object({
    primaryGoal: z.string().min(5).max(300),
    evidenceUsed: z.array(z.string().max(300)).min(1).max(12),
    tradeoffs: z.array(z.string().max(300)).max(8),
    risksManaged: z.array(z.string().max(300)).max(8),
  }),
  confidence: z.enum(["low", "medium", "medium_high", "high"]),
  limitations: z.array(z.string().max(300)).min(1).max(10),
  alternatives: z
    .array(
      z.object({
        name: z.string().max(80),
        summary: z.string().max(300),
        changes: z.array(z.string().max(200)).max(6),
      }),
    )
    .max(2)
    .nullish()
    .transform((v) => v ?? undefined),
});

export type WeeklyTrainingPlanParsed = z.infer<typeof weeklyTrainingPlanSchema>;

export function parseWeeklyTrainingPlan(
  raw: unknown,
): { success: true; data: WeeklyTrainingPlanParsed } | { success: false; error: z.ZodError } {
  const result = weeklyTrainingPlanSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/**
 * OpenAI structured output JSON schema (strict).
 *
 * In strict mode `required` must list **every** key in `properties`, at every level.
 * A property that is genuinely optional is expressed by allowing null, not by being
 * left out. Omitting three top-level keys and two inside `workouts.items` made the API
 * reject this schema outright:
 *
 *   400 Invalid schema for response_format 'weekly_training_plan': in
 *   context=('properties','workouts','items'), 'required' is required to be supplied
 *   and to be an array including every key in properties. Missing 'durationMin'.
 *
 * `generateWeeklyPlanFromContext` caught that in a bare `catch` and returned the
 * deterministic fallback, so every AI plan request since this schema was written
 * produced a rule-based plan while reporting only "This is a fallback plan". The
 * ladder was not protecting anyone from a bad model — the model was never reached.
 *
 * `__tests__/weeklyPlanSchema.test.ts` asserts the required/properties invariant
 * recursively, which catches a repeat without spending an API call in CI.
 */
export const WEEKLY_TRAINING_PLAN_JSON_SCHEMA = {
  name: "weekly_training_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "weekStart",
      "planType",
      "summary",
      "totalRunDistanceKm",
      "totalTrainingMinutes",
      "hardSessionCount",
      "workouts",
      "rationale",
      "confidence",
      "limitations",
      "alternatives",
    ],
    properties: {
      weekStart: { type: "string", description: "ISO date Monday yyyy-mm-dd" },
      planType: {
        type: "string",
        enum: ["build", "maintain", "taper", "recovery", "race_week"],
      },
      summary: { type: "string" },
      totalRunDistanceKm: { type: ["number", "null"] },
      totalTrainingMinutes: { type: ["number", "null"] },
      hardSessionCount: { type: "integer", minimum: 0, maximum: 7 },
      workouts: {
        type: "array",
        minItems: 3,
        maxItems: 14,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "day",
            "modality",
            "type",
            "title",
            "durationMin",
            "distanceKm",
            "intensity",
            "purpose",
            "constraintsApplied",
            "reasoning",
          ],
          properties: {
            day: { type: "string" },
            modality: {
              type: "string",
              enum: [
                "run",
                "bike",
                "swim",
                "strength",
                "mobility",
                "recovery",
                "rest",
                "cross_training",
              ],
            },
            type: { type: "string" },
            title: { type: "string" },
            durationMin: { type: ["number", "null"] },
            distanceKm: { type: ["number", "null"] },
            intensity: {
              type: "string",
              enum: ["easy", "moderate", "hard", "recovery", "rest"],
            },
            purpose: { type: "string" },
            constraintsApplied: {
              type: "array",
              items: { type: "string" },
            },
            reasoning: { type: "string" },
          },
        },
      },
      rationale: {
        type: "object",
        additionalProperties: false,
        required: ["primaryGoal", "evidenceUsed", "tradeoffs", "risksManaged"],
        properties: {
          primaryGoal: { type: "string" },
          evidenceUsed: { type: "array", items: { type: "string" } },
          tradeoffs: { type: "array", items: { type: "string" } },
          risksManaged: { type: "array", items: { type: "string" } },
        },
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "medium_high", "high"],
      },
      limitations: { type: "array", items: { type: "string" } },
      alternatives: {
        type: ["array", "null"],
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "summary", "changes"],
          properties: {
            name: { type: "string" },
            summary: { type: "string" },
            changes: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
} as const;
