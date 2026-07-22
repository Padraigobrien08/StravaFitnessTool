import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeGenerateNextWeekTrainingPlan } from "@/lib/ai-planning/planTool";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";

const bodySchema = z.object({
  forceFallback: z.boolean().optional(),
  planningContext: z.string().max(2000).optional(),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    const raw = await req.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
    const result = await executeGenerateNextWeekTrainingPlan(
      ctx,
      { planningContext: body.planningContext },
      { forceFallback: body.forceFallback || !hasOpenAI },
    );

    return NextResponse.json({
      plan: result.plan,
      guardrails: result.guardrails,
      source: result.source,
      validation: result.validation,
      integrity: result.integrity,
      observability: result.observability,
      replySummary: result.replySummary,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Plan generation failed" },
      { status: 500 },
    );
  }
}

/** Deterministic fallback without OpenAI */
export async function GET(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeGenerateNextWeekTrainingPlan(
      ctx,
      {},
      {
        forceFallback: true,
      },
    );

    return NextResponse.json({
      plan: result.plan,
      guardrails: result.guardrails,
      source: result.source,
      validation: result.validation,
      integrity: result.integrity,
      observability: result.observability,
      replySummary: result.replySummary,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Plan generation failed" },
      { status: 500 },
    );
  }
}
