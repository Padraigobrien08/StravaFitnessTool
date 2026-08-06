import { NextRequest, NextResponse } from "next/server";
import {
  hydrateOutcomesForUser,
  persistOutcomesForUser,
} from "@/lib/recommendation-learning/persistence";
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

    // Load anything tracked in an earlier request so it can be judged now.
    await hydrateOutcomesForUser(ctx.userId);

    const snap = buildAdaptiveIntelligence(
      bundle,
      resolved.raceGoal ?? null,
      bundle.insights,
      ctx.userId,
      { trackPrimaryRecommendation: true },
    );

    // Write the working set back so a later request can close the loop.
    await persistOutcomesForUser(ctx.userId);

    return NextResponse.json(snap.observability);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
