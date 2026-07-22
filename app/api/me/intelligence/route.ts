import { NextRequest, NextResponse } from "next/server";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import { buildCoachBriefForUser, computeAthleteIntelligence } from "@/lib/intelligence/service";
import { buildIntelligenceBrief } from "@/lib/intelligence/brief";
import { wrapIntelligence } from "@/lib/intelligence/envelope";
import { executeIntelligenceTool, parseToolName } from "@/lib/intelligence/tools";
import { resolveIntelligenceContext } from "@/lib/intelligence/service";

export async function GET(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const section = req.nextUrl.searchParams.get("section") ?? "brief";

  try {
    if (section === "brief") {
      const brief = await buildCoachBriefForUser(ctx);
      const bundle = await computeAthleteIntelligence(ctx);
      return NextResponse.json(wrapIntelligence(brief, bundle.quality));
    }

    if (section === "full") {
      const bundle = await computeAthleteIntelligence(ctx);
      const resolved = await resolveIntelligenceContext(ctx.userId, ctx);
      const brief = buildIntelligenceBrief(
        bundle.analytics,
        bundle.insights,
        bundle.quality,
        resolved.raceGoal ?? null,
      );
      return NextResponse.json(
        wrapIntelligence(
          {
            brief,
            insightCount: bundle.insights.length,
            runCount: bundle.quality.runCount,
          },
          bundle.quality,
        ),
      );
    }

    const toolMap: Record<string, string> = {
      readiness: "get_readiness",
      predictions: "get_predictions",
      plan: "get_week_plan",
      weekly_plan: "generate_next_week_training_plan",
      ai_weekly_plan: "generate_next_week_training_plan",
      strategy: "get_race_strategy",
      fatigue: "get_fatigue_load",
      quality: "get_data_quality",
      status: "get_connection_status",
      runs: "list_recent_runs",
      compare_sessions: "compare_sessions",
      readiness_delta: "explain_readiness_delta",
      best_phase: "find_best_phase",
      attribute: "attribute_improvement",
      fade: "analyze_fade_pattern",
      pr_context: "pr_context",
    };

    const toolName = toolMap[section];
    if (!toolName) {
      return NextResponse.json(
        { error: `Unknown section. Use: brief, full, ${Object.keys(toolMap).join(", ")}` },
        { status: 400 },
      );
    }

    const strategyMode = req.nextUrl.searchParams.get("strategyMode");
    const limit = req.nextUrl.searchParams.get("limit");
    const type = req.nextUrl.searchParams.get("type");
    const n = req.nextUrl.searchParams.get("n");
    const weeks = req.nextUrl.searchParams.get("weeks");
    const metric = req.nextUrl.searchParams.get("metric");
    const distanceKm = req.nextUrl.searchParams.get("distanceKm");
    const bucket = req.nextUrl.searchParams.get("bucket");
    const runId = req.nextUrl.searchParams.get("runId");

    let arguments_: Record<string, unknown> = {};
    if (section === "runs") {
      arguments_ = { limit: limit ? Number(limit) : 10 };
    } else if (section === "strategy" && strategyMode) {
      arguments_ = { mode: strategyMode };
    } else if (section === "compare_sessions") {
      arguments_ = {
        ...(type ? { type } : {}),
        ...(n ? { n: Number(n) } : {}),
      };
    } else if (section === "readiness_delta") {
      arguments_ = weeks ? { weeks: Number(weeks) } : {};
    } else if (section === "best_phase" || section === "attribute") {
      arguments_ = metric ? { metric } : {};
    } else if (section === "fade") {
      arguments_ = distanceKm ? { distanceKm: Number(distanceKm) } : {};
    } else if (section === "pr_context") {
      arguments_ = {
        ...(bucket ? { bucket } : {}),
        ...(runId ? { runId } : {}),
      };
    }

    const result = await executeIntelligenceTool(ctx, {
      name: parseToolName(toolName),
      arguments: arguments_,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intelligence failed";
    const status = message.includes("No Strava connection") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
