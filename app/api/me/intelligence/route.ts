import { NextRequest, NextResponse } from "next/server";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import { buildCoachBriefForUser, computeAthleteIntelligence } from "@/lib/intelligence/service";
import { buildIntelligenceBrief } from "@/lib/intelligence/brief";
import { wrapIntelligence } from "@/lib/intelligence/envelope";
import {
  executeIntelligenceTool,
  INTELLIGENCE_TOOL_DEFINITIONS,
  parseToolName,
} from "@/lib/intelligence/tools";
import { resolveIntelligenceContext } from "@/lib/intelligence/service";

export async function GET(req: NextRequest) {
  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // An explicit ?tool= addresses the registry directly. Checked before the default
  // section, because `section` falls back to "brief" and would otherwise swallow it.
  const explicitTool = req.nextUrl.searchParams.get("tool");
  const section = req.nextUrl.searchParams.get("section") ?? (explicitTool ? "" : "brief");

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

    /**
     * Short aliases kept for backward compatibility with existing MCP builds and
     * bookmarked URLs. These used to be the *only* way in, which left 28 of the 44
     * registered tools unreachable over HTTP — and therefore unreachable from the
     * MCP package, despite `FEATURES.md` §11 claiming otherwise. Any tool can now
     * be addressed by its registry name via `?tool=` (or `?section=`), so the map
     * is an alias table rather than the gate.
     */
    const aliases: Record<string, string> = {
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

    // Discovery: lets a client enumerate what it can call instead of guessing.
    if (section === "tools") {
      return NextResponse.json({
        tools: INTELLIGENCE_TOOL_DEFINITIONS,
        aliases,
        count: INTELLIGENCE_TOOL_DEFINITIONS.length,
      });
    }

    const registryNames = new Set<string>(INTELLIGENCE_TOOL_DEFINITIONS.map((t) => t.name));
    const requested = explicitTool ?? section;
    const resolved = registryNames.has(requested) ? requested : aliases[requested];

    if (!resolved) {
      return NextResponse.json(
        {
          error: `Unknown tool or section: "${requested}".`,
          hint: "Call ?section=tools to list every available tool.",
          sections: ["brief", "full", "tools", ...Object.keys(aliases)],
        },
        { status: 400 },
      );
    }
    const toolName = resolved;

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

    /**
     * Generic arguments for tools reached by registry name. Hand-mapping a query
     * parameter per tool is what let the section map fall 28 tools behind the
     * registry, so anything not covered by a legacy alias above passes its
     * arguments as JSON and is validated by the executor's own typed reader.
     */
    const rawArgs = req.nextUrl.searchParams.get("args");
    if (rawArgs) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawArgs);
      } catch {
        return NextResponse.json(
          { error: '`args` must be a JSON object, e.g. args={"window":28}' },
          { status: 400 },
        );
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return NextResponse.json({ error: "`args` must be a JSON object" }, { status: 400 });
      }
      // Explicit args win over anything inferred from the legacy query parameters.
      arguments_ = { ...arguments_, ...(parsed as Record<string, unknown>) };
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
