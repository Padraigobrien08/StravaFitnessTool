import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classifyPlanningMessage } from "@/lib/ai-planning/planningIntent";
import {
  executeExplainWeeklyPlan,
  executeGenerateNextWeekTrainingPlan,
} from "@/lib/ai-planning/planTool";
import { weeklyTrainingPlanSchema } from "@/lib/ai-planning/weeklyPlanSchema";
import { getRecentPlanRuns } from "@/lib/ai-planning/planObservability";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  previousPlan: z.unknown().optional(),
  toolArgs: z
    .object({
      goalId: z.string().optional(),
      windowDays: z.union([z.literal(14), z.literal(21), z.literal(28)]).optional(),
      planPreference: z.enum(["conservative", "balanced", "aggressive"]).optional(),
      availableDays: z.array(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
    })
    .optional(),
  forceFallback: z.boolean().optional(),
  calendarContext: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const previousPlanParsed = body.previousPlan
    ? weeklyTrainingPlanSchema.safeParse(body.previousPlan)
    : null;
  const previousPlan = previousPlanParsed?.success ? previousPlanParsed.data : undefined;

  const route = classifyPlanningMessage(body.message, Boolean(previousPlan));

  if (!route) {
    return NextResponse.json(
      { error: "Not a planning request — use Coach chat for general questions." },
      { status: 400 },
    );
  }

  try {
    if (route.kind === "explain" && previousPlan) {
      const { explanationOnly, replySummary } = executeExplainWeeklyPlan(previousPlan, route.topic);
      return NextResponse.json({
        kind: "explain",
        replySummary,
        explanationOnly,
        plan: previousPlan,
        toolsUsed: ["generate_next_week_training_plan"],
      });
    }

    if (route.kind === "modify" && previousPlan) {
      const toolInput = {
        ...route.args,
        ...body.toolArgs,
        constraints: [
          ...(body.toolArgs?.constraints ?? []),
          ...(body.calendarContext ? [body.calendarContext] : []),
        ],
      };
      const result = await executeGenerateNextWeekTrainingPlan(ctx, toolInput, {
        previousPlan,
        modification: route.modification,
      });
      return NextResponse.json({
        kind: "modify",
        ...result,
        toolsUsed: ["generate_next_week_training_plan"],
        ...(process.env.NODE_ENV === "development" ? { devRecentRuns: getRecentPlanRuns(3) } : {}),
      });
    }

    if (route.kind === "generate") {
      const toolInput = {
        ...route.args,
        ...body.toolArgs,
        constraints: [
          ...(body.toolArgs?.constraints ?? []),
          ...(body.calendarContext ? [body.calendarContext] : []),
        ],
      };
      const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
      const result = await executeGenerateNextWeekTrainingPlan(ctx, toolInput, {
        forceFallback: body.forceFallback || !hasOpenAI,
      });

      return NextResponse.json({
        kind: "generate",
        ...result,
        toolsUsed: ["generate_next_week_training_plan"],
        ...(process.env.NODE_ENV === "development" ? { devRecentRuns: getRecentPlanRuns(3) } : {}),
      });
    }

    return NextResponse.json({ error: "Could not route planning request." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Plan failed" },
      { status: 500 },
    );
  }
}
