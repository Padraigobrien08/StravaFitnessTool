import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/session";
import { syncStravaActivitiesForUser } from "@/lib/sync/stravaSync";
import { MAX_STREAM_RUNS_PER_SYNC, DEFAULT_STREAM_RUNS_PER_SYNC } from "@/lib/sync/limits";

/**
 * `streamMaxRuns` previously accepted any number at all — `typeof x === "number"` is
 * true for `-1`, `NaN`, `Infinity` and `1e9`. Each stream costs a Strava API call
 * against a shared daily quota, so an unbounded value here burns the whole app's rate
 * limit on one request. The ceiling is the real fix; the schema is how it is enforced.
 *
 * The body stays optional: the UI posts this route with no body at all.
 */
const bodySchema = z
  .object({
    skipStreams: z.boolean().optional(),
    streamMaxRuns: z.number().int().min(1).max(MAX_STREAM_RUNS_PER_SYNC).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // An absent or empty body is the normal case, not an error.
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

  const skipStreams = parsed.data.skipStreams ?? false;
  const streamMaxRuns = parsed.data.streamMaxRuns ?? DEFAULT_STREAM_RUNS_PER_SYNC;

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
