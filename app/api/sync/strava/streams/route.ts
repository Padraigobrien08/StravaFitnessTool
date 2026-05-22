import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { syncStravaStreamsForUser } from "@/lib/sync/stravaStreams";
import { countRunsMissingStreams } from "@/lib/db/activity-streams";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let maxRuns = 40;
  try {
    const body = await request.json();
    if (typeof body?.maxRuns === "number") maxRuns = body.maxRuns;
  } catch {
    // no body
  }

  try {
    const before = await countRunsMissingStreams(userId);
    const { streamsSynced, skipped } = await syncStravaStreamsForUser(userId, {
      maxRuns,
    });
    const remaining = await countRunsMissingStreams(userId);
    return NextResponse.json({
      ok: true,
      streamsSynced,
      skipped,
      remaining,
      requested: Math.min(maxRuns, before),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stream sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
