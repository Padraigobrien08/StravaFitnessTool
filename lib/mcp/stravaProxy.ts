import { getValidAccessToken, getStravaConnection } from "@/lib/db/strava-connection";
import {
  compactActivityStreams,
  downsampleCompactStreams,
} from "@/lib/strava/api/compactStreams";
import { exportRouteGpx, exportRouteTcx } from "@/lib/strava/api/exportRoute";
import { exploreSegments } from "@/lib/strava/api/exploreSegments";
import { fetchActivity } from "@/lib/strava/api/fetchActivity";
import {
  resolveActivitiesList,
  resolveActivitiesListAll,
} from "@/lib/mcp/resolveActivitiesList";
import {
  fetchAthleteStats,
  fetchAthleteZones,
} from "@/lib/strava/api/fetchAthlete";
import { listAthleteClubs } from "@/lib/strava/api/fetchClubs";
import { fetchAthleteGear } from "@/lib/strava/api/fetchGear";
import { fetchActivityPhotos } from "@/lib/strava/api/fetchPhotos";
import { fetchRoute, listAthleteRoutes } from "@/lib/strava/api/fetchRoutes";
import {
  fetchSegment,
  fetchStarredSegments,
} from "@/lib/strava/api/fetchSegments";
import {
  fetchSegmentEffort,
  fetchSegmentEfforts,
} from "@/lib/strava/api/fetchSegmentEfforts";
import { fetchSegmentLeaderboard } from "@/lib/strava/api/fetchSegmentLeaderboard";
import {
  fetchActivityLaps,
  fetchActivityStreams,
} from "@/lib/strava/api/fetchStreams";
import { formatActivitySummary } from "@/lib/strava/api/formatActivitySummary";
import { activityGpxExport } from "@/lib/strava/api/formatWorkoutFile";
import { starSegment } from "@/lib/strava/api/starSegment";
import {
  chunkCompactStreams,
  selectStreamChunk,
} from "@/lib/strava/api/streamChunks";
import { verboseActivityStreams } from "@/lib/strava/api/verboseStreams";

export const STRAVA_MCP_ACTIONS = [
  "activities",
  "activities_all",
  "activity",
  "streams",
  "laps",
  "photos",
  "athlete",
  "stats",
  "zones",
  "shoes",
  "segments_explore",
  "segments_starred",
  "segment",
  "segment_leaderboard",
  "segment_effort",
  "segment_efforts",
  "segment_star",
  "routes",
  "route",
  "route_export_gpx",
  "route_export_tcx",
  "clubs",
  "workout_gpx",
  "connection_status",
] as const;

export type StravaMcpAction = (typeof STRAVA_MCP_ACTIONS)[number];

export interface StravaMcpParams {
  id?: string;
  page?: string;
  per_page?: string;
  limit?: string;
  after?: string;
  before?: string;
  max_pages?: string;
  compact?: string;
  verbose?: string;
  include_laps?: string;
  format?: string;
  chunk?: string;
  downsample?: string;
  south?: string;
  west?: string;
  north?: string;
  east?: string;
  activity_type?: string;
  gender?: string;
  age_group?: string;
  following?: string;
  club_id?: string;
  start_date_local?: string;
  end_date_local?: string;
  starred?: string;
  route_id?: string;
}

async function requireConnection(userId: string) {
  const conn = await getStravaConnection(userId);
  if (!conn) {
    throw new Error(
      "No Strava connection. Sign in via Strava in the StrideIQ app first."
    );
  }
  const { accessToken, athlete } = await getValidAccessToken(userId);
  const athleteId = Number(conn.strava_athlete_id);
  return { conn, accessToken, athlete, athleteId };
}

function parseId(params: StravaMcpParams, label = "id"): number {
  const id = parseInt(params.id ?? "", 10);
  if (!Number.isFinite(id)) throw new Error(`${label} required`);
  return id;
}

function parseBounds(params: StravaMcpParams): [number, number, number, number] {
  const south = parseFloat(params.south ?? "");
  const west = parseFloat(params.west ?? "");
  const north = parseFloat(params.north ?? "");
  const east = parseFloat(params.east ?? "");
  if (![south, west, north, east].every(Number.isFinite)) {
    throw new Error("segments_explore requires south, west, north, east bounds");
  }
  return [south, west, north, east];
}

export async function handleStravaMcpAction(
  userId: string,
  action: StravaMcpAction,
  params: StravaMcpParams
): Promise<unknown> {
  const { conn, accessToken, athlete, athleteId } = await requireConnection(userId);

  switch (action) {
    case "activities": {
      const limit = params.limit ? parseInt(params.limit, 10) : NaN;
      const per_page = params.per_page
        ? parseInt(params.per_page, 10)
        : Number.isFinite(limit)
          ? limit
          : 30;
      const page = parseInt(params.page ?? "1", 10);
      const afterRaw = params.after ? parseInt(params.after, 10) : NaN;
      const beforeRaw = params.before ? parseInt(params.before, 10) : NaN;
      return resolveActivitiesList(userId, accessToken, {
        page: Number.isFinite(page) ? page : 1,
        per_page: Number.isFinite(per_page) ? per_page : 30,
        after: Number.isFinite(afterRaw) ? afterRaw : undefined,
        before: Number.isFinite(beforeRaw) ? beforeRaw : undefined,
      });
    }

    case "activities_all": {
      const afterRaw = params.after ? parseInt(params.after, 10) : NaN;
      const beforeRaw = params.before ? parseInt(params.before, 10) : NaN;
      const max_pages = params.max_pages ? parseInt(params.max_pages, 10) : 10;
      return resolveActivitiesListAll(userId, accessToken, {
        after: Number.isFinite(afterRaw) ? afterRaw : undefined,
        before: Number.isFinite(beforeRaw) ? beforeRaw : undefined,
        max_pages: Number.isFinite(max_pages) ? max_pages : 10,
      });
    }

    case "activity": {
      const id = parseId(params);
      const activity = await fetchActivity(accessToken, id);
      if (params.format === "summary") {
        return { summary: formatActivitySummary(activity), activity };
      }
      return activity;
    }

    case "laps": {
      const id = parseId(params);
      const laps = await fetchActivityLaps(accessToken, id);
      return { activityId: id, laps };
    }

    case "photos": {
      const id = parseId(params);
      const photos = await fetchActivityPhotos(accessToken, id);
      return { activityId: id, photos };
    }

    case "streams": {
      const id = parseId(params);
      const includeLaps = params.include_laps !== "false";
      const verbose = params.verbose === "true";

      const [streams, laps] = await Promise.all([
        fetchActivityStreams(accessToken, id),
        includeLaps ? fetchActivityLaps(accessToken, id) : Promise.resolve([]),
      ]);

      if (verbose || params.compact === "false") {
        return verboseActivityStreams(streams, laps);
      }

      let payload = compactActivityStreams(id, streams, laps);
      if (!payload) {
        return {
          activityId: id,
          pointCount: 0,
          streams: {},
          meta: {},
          message: "No stream data for this activity",
        };
      }

      const downsampleN = params.downsample
        ? parseInt(params.downsample, 10)
        : NaN;
      if (Number.isFinite(downsampleN) && downsampleN > 0) {
        payload = downsampleCompactStreams(payload, downsampleN);
      }

      const chunks = chunkCompactStreams(payload);
      if (params.chunk) {
        return selectStreamChunk(chunks, params.chunk);
      }
      if (chunks.length === 1) return chunks[0]!.data;
      return { chunked: true, chunkCount: chunks.length, chunks };
    }

    case "athlete":
      return {
        athlete: athlete ?? conn.athlete_json,
        strava_athlete_id: conn.strava_athlete_id,
        scopes: conn.scopes,
      };

    case "connection_status":
      return {
        connected: true,
        strava_athlete_id: conn.strava_athlete_id,
        scopes: conn.scopes,
        expires_at: conn.expires_at,
      };

    case "stats": {
      if (!Number.isFinite(athleteId)) throw new Error("Invalid athlete id");
      const stats =
        conn.athlete_stats_json ??
        (await fetchAthleteStats(accessToken, athleteId));
      return stats;
    }

    case "zones": {
      const zones =
        conn.athlete_zones_json ?? (await fetchAthleteZones(accessToken));
      return { zones };
    }

    case "shoes":
      return fetchAthleteGear(accessToken);

    case "segments_explore":
      return exploreSegments(
        accessToken,
        parseBounds(params),
        params.activity_type
      );

    case "segments_starred":
      return { segments: await fetchStarredSegments(accessToken) };

    case "segment":
      return fetchSegment(accessToken, parseId(params, "segment id"));

    case "segment_leaderboard":
      return fetchSegmentLeaderboard(accessToken, parseId(params, "segment id"), {
        gender: params.gender as "M" | "F" | undefined,
        age_group: params.age_group,
        following: params.following === "true",
        club_id: params.club_id ? parseInt(params.club_id, 10) : undefined,
      });

    case "segment_effort":
      return fetchSegmentEffort(accessToken, parseId(params, "effort id"));

    case "segment_efforts":
      return {
        efforts: await fetchSegmentEfforts(
          accessToken,
          parseId(params, "segment id"),
          {
            start_date_local: params.start_date_local,
            end_date_local: params.end_date_local,
            per_page: params.per_page ? parseInt(params.per_page, 10) : 30,
          }
        ),
      };

    case "segment_star": {
      const segmentId = parseId(params, "segment id");
      const starred = params.starred !== "false";
      try {
        return await starSegment(accessToken, segmentId, starred);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("403")) {
          throw new Error(
            "Cannot star segment — check Strava app scopes include segment access."
          );
        }
        throw e;
      }
    }

    case "routes": {
      if (!Number.isFinite(athleteId)) throw new Error("Invalid athlete id");
      const page = parseInt(params.page ?? "1", 10);
      const per_page = parseInt(params.per_page ?? "30", 10);
      return {
        routes: await listAthleteRoutes(
          accessToken,
          athleteId,
          Number.isFinite(page) ? page : 1,
          Number.isFinite(per_page) ? per_page : 30
        ),
      };
    }

    case "route": {
      const routeId = params.route_id
        ? parseInt(params.route_id, 10)
        : parseId(params, "route id");
      return fetchRoute(accessToken, routeId);
    }

    case "route_export_gpx": {
      const routeId = params.route_id
        ? parseInt(params.route_id, 10)
        : parseId(params, "route id");
      return exportRouteGpx(accessToken, routeId);
    }

    case "route_export_tcx": {
      const routeId = params.route_id
        ? parseInt(params.route_id, 10)
        : parseId(params, "route id");
      return exportRouteTcx(accessToken, routeId);
    }

    case "clubs":
      return { clubs: await listAthleteClubs(accessToken) };

    case "workout_gpx": {
      const id = parseId(params, "activity id");
      const activity = await fetchActivity(accessToken, id);
      const streams = await fetchActivityStreams(accessToken, id);
      return activityGpxExport(
        id,
        String(activity.name ?? `Activity ${id}`),
        streams
      );
    }

    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown action: ${_exhaustive}`);
    }
  }
}
