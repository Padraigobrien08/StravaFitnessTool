import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { createPushSubscription, listPushSubscriptions } from "@/lib/strava/webhooks/subscribe";

export async function GET() {
  // Was unauthenticated, while the POST below has always required a session. That
  // let any caller read the app's push subscriptions — callback URL and
  // subscription ids — and make StrideIQ spend Strava API quota on request.
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subs = await listPushSubscriptions();
  return NextResponse.json({ subscriptions: subs });
}

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const callbackUrl = process.env.STRAVA_WEBHOOK_CALLBACK_URL;
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

  if (!callbackUrl || !verifyToken) {
    return NextResponse.json(
      {
        error:
          "Set STRAVA_WEBHOOK_CALLBACK_URL (public HTTPS …/api/webhooks/strava) and STRAVA_WEBHOOK_VERIFY_TOKEN in .env.local",
      },
      { status: 400 },
    );
  }

  try {
    const existing = await listPushSubscriptions();
    const match = existing.find((s) => s.callback_url === callbackUrl);
    if (match) {
      return NextResponse.json({ ok: true, subscription: match, existing: true });
    }
    const subscription = await createPushSubscription(callbackUrl, verifyToken);
    return NextResponse.json({ ok: true, subscription });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Subscribe failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
