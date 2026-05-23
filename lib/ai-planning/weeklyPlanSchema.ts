import { z } from "zod";

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
  durationMin: z.number().min(0).max(600).optional(),
  distanceKm: z.number().min(0).max(80).optional(),
  intensity: z.enum(["easy", "moderate", "hard", "recovery", "rest"]),
  purpose: z.string().min(1).max(300),
  constraintsApplied: z.array(z.string().max(200)).max(8),
  reasoning: z.string().min(1).max(400),
});

export const weeklyTrainingPlanSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planType: z.enum(["build", "maintain", "taper", "recovery", "race_week"]),
  summary: z.string().min(10).max(600),
  totalRunDistanceKm: z.number().min(0).max(250).optional(),
  totalTrainingMinutes: z.number().min(0).max(2000).optional(),
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
      })
    )
    .max(2)
    .optional(),
});

export type WeeklyTrainingPlanParsed = z.infer<typeof weeklyTrainingPlanSchema>;

export function parseWeeklyTrainingPlan(
  raw: unknown
): { success: true; data: WeeklyTrainingPlanParsed } | { success: false; error: z.ZodError } {
  const result = weeklyTrainingPlanSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/** OpenAI structured output JSON schema (strict). */
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
      "hardSessionCount",
      "workouts",
      "rationale",
      "confidence",
      "limitations",
    ],
    properties: {
      weekStart: { type: "string", description: "ISO date Monday yyyy-mm-dd" },
      planType: {
        type: "string",
        enum: ["build", "maintain", "taper", "recovery", "race_week"],
      },
      summary: { type: "string" },
      totalRunDistanceKm: { type: "number" },
      totalTrainingMinutes: { type: "number" },
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
            durationMin: { type: "number" },
            distanceKm: { type: "number" },
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
        type: "array",
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
