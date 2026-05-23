import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serializeMemoryForCoachAnswer } from "@/lib/athlete-memory";
import { classifyMemoryQuestion } from "@/lib/athlete-memory/memoryIntent";
import {
  buildAdaptiveIntelligence,
  classifyAdaptiveCoachQuestion,
  serializeAdaptiveIntelligenceForCoach,
} from "@/lib/adaptive-intelligence";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import { computeAthleteIntelligence, resolveIntelligenceContext } from "@/lib/intelligence/service";

const bodySchema = z.object({
  message: z.string().min(1).max(2000).optional(),
  topic: z
    .enum(["all", "adaptation", "fatigue", "pacing", "taper", "modality", "durability"])
    .optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    body = bodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const [bundle, resolved] = await Promise.all([
      computeAthleteIntelligence(ctx),
      resolveIntelligenceContext(ctx.userId, ctx),
    ]);

    const adaptive = buildAdaptiveIntelligence(
      bundle,
      resolved.raceGoal ?? null,
      bundle.insights,
      ctx.userId,
      { trackPrimaryRecommendation: true }
    );

    const msg = body.message ?? "";
    const adaptiveTopic = classifyAdaptiveCoachQuestion(msg);
    const memoryClassified = classifyMemoryQuestion(msg);

    let answer: string;
    if (adaptiveTopic) {
      answer = serializeAdaptiveIntelligenceForCoach(adaptive, adaptiveTopic);
    } else {
      const topic =
        body.topic ??
        (memoryClassified?.topic === "durability"
          ? "durability"
          : memoryClassified?.topic ?? "all");
      const answerTopic =
        topic === "all" || topic === "durability" || topic === "recovery"
          ? topic === "durability"
            ? "adaptation"
            : topic === "recovery"
              ? "fatigue"
              : "all"
          : topic;
      const memoryAnswer = serializeMemoryForCoachAnswer(
        adaptive.memory,
        answerTopic
      );
      const learned =
        adaptive.recentlyLearned.length > 0
          ? `\n\n## Recently learned\n${adaptive.recentlyLearned.map((l) => `- ${l}`).join("\n")}`
          : "";
      answer = memoryAnswer + learned;
    }

    return NextResponse.json({
      profile: adaptive.memory,
      adaptive,
      answer,
      topic: adaptiveTopic ?? body.topic ?? "all",
      recentlyLearned: adaptive.recentlyLearned,
      observability:
        process.env.NODE_ENV === "development"
          ? adaptive.observability
          : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Memory failed" },
      { status: 500 }
    );
  }
}
