import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import type { StravaActivityStats } from "@/lib/strava/api/fetchAthlete";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT athlete_stats_json, athlete_zones_json
    FROM strava_connections
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `;
  const row = rows[0] as {
    athlete_stats_json: StravaActivityStats | null;
    athlete_zones_json: unknown;
  } | undefined;

  if (!row?.athlete_stats_json) {
    return NextResponse.json({ stats: null });
  }

  return NextResponse.json({
    stats: row.athlete_stats_json,
    zones: row.athlete_zones_json ?? null,
  });
}
