import { NextRequest, NextResponse } from "next/server";
import { buildAdaptiveIntelligence } from "@/lib/adaptive-intelligence";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import { computeAthleteIntelligence, resolveIntelligenceContext } from "@/lib/intelligence/service";

/** Dev/debug: learning timeline, beliefs, outcomes, contradictions */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [bundle, resolved] = await Promise.all([
      computeAthleteIntelligence(ctx),
      resolveIntelligenceContext(ctx.userId, ctx),
    ]);

    const snap = buildAdaptiveIntelligence(
      bundle,
      resolved.raceGoal ?? null,
      bundle.insights,
      ctx.userId,
      { trackPrimaryRecommendation: true },
    );

    return NextResponse.json(snap.observability);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
