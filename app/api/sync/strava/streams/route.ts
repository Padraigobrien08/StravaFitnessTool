import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/session";
import { syncStravaStreamsForUser } from "@/lib/sync/stravaStreams";
import { countRunsMissingStreams } from "@/lib/db/activity-streams";
import { MAX_STREAM_RUNS_PER_SYNC, DEFAULT_STREAM_RUNS_PER_SYNC } from "@/lib/sync/limits";

/** Same quota reasoning as `app/api/sync/strava/route.ts` — see `lib/sync/limits.ts`. */
const bodySchema = z
  .object({
    maxRuns: z.number().int().min(1).max(MAX_STREAM_RUNS_PER_SYNC).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown = {};
  try {
    raw = (await request.json()) ?? {};
  } catch {
    raw = {};
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const maxRuns = parsed.data.maxRuns ?? DEFAULT_STREAM_RUNS_PER_SYNC;

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
