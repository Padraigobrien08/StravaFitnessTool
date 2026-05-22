import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { buildStravaImportFromDb } from "@/lib/db/activities";
import { getStravaConnection } from "@/lib/db/strava-connection";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const conn = await getStravaConnection(userId);
  if (!conn) {
    return NextResponse.json({ error: "No Strava connection" }, { status: 404 });
  }
  const data = await buildStravaImportFromDb(userId, conn.athlete_json);
  return NextResponse.json(data);
}
