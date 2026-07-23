import { NextRequest, NextResponse } from "next/server";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import { computeAthleteIntelligence } from "@/lib/intelligence/service";
import { evaluateForecastCalibration } from "@/lib/forecasting-v2/calibrationService";

export async function GET(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { analytics } = await computeAthleteIntelligence(ctx);
    const result = await evaluateForecastCalibration(
      ctx.userId,
      analytics.racePredictionAnalysis.efforts,
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to evaluate calibration" },
      { status: 500 },
    );
  }
}
