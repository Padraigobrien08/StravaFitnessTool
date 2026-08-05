import { NextRequest, NextResponse } from "next/server";
import { findUserIdByStravaAthleteId } from "@/lib/db/users";
import { deleteActivityForUser, syncSingleActivityForUser } from "@/lib/sync/singleActivity";
import { verifyWebhookSignatureDetailed } from "@/lib/strava/webhooks/verify";

export async function GET(request: NextRequest) {
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && verifyToken && token === verifyToken && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

interface WebhookEvent {
  aspect_type: "create" | "update" | "delete";
  object_type: "activity" | "athlete";
  object_id: number;
  owner_id: number;
  updates?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-strava-signature");

  const verification = verifyWebhookSignatureDetailed(rawBody, signature);
  if (!verification.valid) {
    // Log the reason: a silent 403 on every delivery is indistinguishable from
    // Strava not calling at all, which is how the wrong header name went unnoticed.
    console.error(
      verification.reason === "no_signing_secret"
        ? "[strava webhook] rejected: STRAVA_WEBHOOK_SIGNING_SECRET is not set"
        : `[strava webhook] rejected: ${verification.reason}`,
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.object_type !== "activity") {
    return NextResponse.json({ ok: true, skipped: "not_activity" });
  }

  const userId = await findUserIdByStravaAthleteId(event.owner_id);
  if (!userId) {
    return NextResponse.json({ ok: true, skipped: "unknown_athlete" });
  }

  try {
    if (event.aspect_type === "delete") {
      await deleteActivityForUser(userId, event.object_id);
    } else {
      await syncSingleActivityForUser(userId, event.object_id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    console.error("[strava webhook]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
