import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { syncStravaActivitiesForUser } from "@/lib/sync/stravaSync";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let skipStreams = false;
  let streamMaxRuns = 40;
  try {
    const body = await request.json();
    if (body?.skipStreams === true) skipStreams = true;
    if (typeof body?.streamMaxRuns === "number") streamMaxRuns = body.streamMaxRuns;
  } catch {
    // no body
  }

  try {
    const { synced, streamsSynced } = await syncStravaActivitiesForUser(userId, {
      skipStreams,
      streamMaxRuns,
    });
    return NextResponse.json({ ok: true, synced, streamsSynced });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
