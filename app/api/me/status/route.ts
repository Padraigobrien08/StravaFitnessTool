import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getStravaConnection } from "@/lib/db/strava-connection";
import { countRunsMissingStreams, countStreamsForUser } from "@/lib/db/activity-streams";
import { getSql } from "@/lib/db/client";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ connected: false });
  }
  const conn = await getStravaConnection(userId);
  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  const sql = getSql();
  const countRows = await sql`
    SELECT COUNT(*)::int AS n FROM activities WHERE user_id = ${userId}::uuid
  `;
  const runRows = await sql`
    SELECT COUNT(*)::int AS n FROM activities
    WHERE user_id = ${userId}::uuid AND sport_type = 'Run'
  `;

  const total = (countRows[0] as { n: number }).n;
  const runs = (runRows[0] as { n: number }).n;
  const streams = await countStreamsForUser(userId);
  const runsMissingStreams = await countRunsMissingStreams(userId);

  return NextResponse.json({
    connected: true,
    stravaAthleteId: conn.strava_athlete_id,
    activities: total,
    runs,
    streams,
    runsMissingStreams,
  });
}
