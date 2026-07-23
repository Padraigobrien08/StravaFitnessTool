import { NextRequest, NextResponse } from "next/server";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import { computeAthleteIntelligence, resolveIntelligenceContext } from "@/lib/intelligence/service";
import { buildLimiterProtocol } from "@/lib/goals/limiterProtocols";
import { logLimiterProtocolRecommendation } from "@/lib/recommendation-outcomes/service";

export async function GET(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const bundle = await computeAthleteIntelligence(ctx);
    const resolved = await resolveIntelligenceContext(ctx.userId, ctx);
    const result = buildLimiterProtocol({
      analytics: bundle.analytics,
      goal: resolved.raceGoal ?? null,
      runs: bundle.runs,
      fitDetails: bundle.fitDetails,
    });
    if (result.available) {
      void logLimiterProtocolRecommendation(ctx.userId, result);
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build limiter protocol" },
      { status: 500 },
    );
  }
}
