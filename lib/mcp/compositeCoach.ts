import { buildCoachBriefForUser } from "@/lib/intelligence/service";
import { executeIntelligenceTool } from "@/lib/intelligence/tools";
import type { IntelligenceContext } from "@/lib/intelligence/types";
import { handleStravaMcpAction } from "@/lib/mcp/stravaProxy";
import { resolveActivitiesList } from "@/lib/mcp/resolveActivitiesList";
import { getValidAccessToken } from "@/lib/db/strava-connection";

export const COMPOSITE_ACTIONS = [
  "last_run_analysis",
  "race_week_snapshot",
  "pr_and_segments",
  "long_run_route_suggestions",
] as const;

export type CompositeCoachAction = (typeof COMPOSITE_ACTIONS)[number];

async function tokenFor(userId: string) {
  const { accessToken } = await getValidAccessToken(userId);
  return accessToken;
}

export async function handleCompositeCoachAction(
  ctx: IntelligenceContext,
  action: CompositeCoachAction,
  params: Record<string, string>
): Promise<unknown> {
  const accessToken = await tokenFor(ctx.userId);

  switch (action) {
    case "last_run_analysis": {
      const downsample = params.downsample ?? "200";
      const [readiness, brief, list] = await Promise.all([
        executeIntelligenceTool(ctx, {
          name: "get_readiness",
          arguments: {},
        }),
        buildCoachBriefForUser(ctx),
        resolveActivitiesList(ctx.userId, accessToken, {
          page: 1,
          per_page: 1,
        }),
      ]);

      const activities = (list as { activities?: { id: number }[] }).activities;
      const lastId = activities?.[0]?.id;
      let streams = null;
      let activity = null;
      if (lastId != null) {
        [activity, streams] = await Promise.all([
          handleStravaMcpAction(ctx.userId, "activity", {
            id: String(lastId),
            format: "summary",
          }),
          handleStravaMcpAction(ctx.userId, "streams", {
            id: String(lastId),
            downsample,
            include_laps: "true",
          }),
        ]);
      }

      return {
        readiness,
        coachBrief: brief,
        lastActivity: activity,
        streams,
        activityListMeta: list,
      };
    }

    case "race_week_snapshot": {
      const [brief, plan, fatigue, connection] = await Promise.all([
        buildCoachBriefForUser(ctx),
        executeIntelligenceTool(ctx, {
          name: "generate_next_week_training_plan",
          arguments: {},
        }),
        executeIntelligenceTool(ctx, { name: "get_fatigue_load", arguments: {} }),
        handleStravaMcpAction(ctx.userId, "connection_status", {}),
      ]);
      return { coachBrief: brief, weeklyPlan: plan, fatigue, strava: connection };
    }

    case "pr_and_segments": {
      const bucket = params.bucket as "5k" | "10k" | "hm" | "long" | undefined;
      const [pr, starred] = await Promise.all([
        executeIntelligenceTool(ctx, {
          name: "pr_context",
          arguments: bucket ? { bucket } : {},
        }),
        handleStravaMcpAction(ctx.userId, "segments_starred", {}),
      ]);
      return { prContext: pr, starredSegments: starred };
    }

    case "long_run_route_suggestions": {
      const planResult = await executeIntelligenceTool(ctx, {
        name: "get_week_plan",
        arguments: {},
      });
      const routes = await handleStravaMcpAction(ctx.userId, "routes", {
        page: "1",
        per_page: "30",
      });

      const plan = planResult as {
        payload?: {
          sessions?: {
            type?: string;
            description?: string;
            distanceKmRange?: [number, number];
          }[];
        };
      };
      const sessions = plan.payload?.sessions ?? [];
      const longRun = sessions.find(
        (s) =>
          s.type === "long" ||
          /\blong\b/i.test(`${s.description ?? ""} ${s.type ?? ""}`)
      );
      const targetKm = longRun?.distanceKmRange
        ? (longRun.distanceKmRange[0] + longRun.distanceKmRange[1]) / 2
        : 15;

      const routeList =
        (routes as { routes?: { id?: number; name?: string; distance?: number }[] })
          .routes ?? [];

      const suggestions = routeList
        .map((r) => {
          const distKm = (r.distance ?? 0) / 1000;
          return {
            id: r.id,
            name: r.name,
            distanceKm: Math.round(distKm * 10) / 10,
            deltaKm: Math.round(Math.abs(distKm - targetKm) * 10) / 10,
          };
        })
        .filter((r) => r.id != null)
        .sort((a, b) => a.deltaKm - b.deltaKm)
        .slice(0, 5);

      return {
        targetLongRunKm: targetKm,
        longRunSession: longRun ?? null,
        suggestedRoutes: suggestions,
        allRoutesCount: routeList.length,
      };
    }

    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown composite action: ${_exhaustive}`);
    }
  }
}
