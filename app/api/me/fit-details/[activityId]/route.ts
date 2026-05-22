import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getFitDetailForUser } from "@/lib/db/activity-streams";
import { loadOrFetchFitDetailForRun } from "@/lib/strava/api/fetchRunDetail";

export async function GET(
  _request: Request,
  context: { params: Promise<{ activityId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activityId } = await context.params;
  if (!activityId) {
    return NextResponse.json({ error: "Missing activity id" }, { status: 400 });
  }

  try {
    let detail = await getFitDetailForUser(userId, activityId);
    if (!detail) {
      detail = await loadOrFetchFitDetailForRun(userId, activityId);
    }
    if (!detail) {
      return NextResponse.json(
        { error: "No stream or lap data for this activity" },
        { status: 404 }
      );
    }
    return NextResponse.json(detail);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load streams";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
