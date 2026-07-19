import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/strava/api/oauth";
import { resolveRedirectUri } from "@/lib/strava/api/config";
import { upsertStravaConnection } from "@/lib/db/strava-connection";
import { createUser, findUserByStravaAthleteId } from "@/lib/db/users";
import { setSessionCookie } from "@/lib/auth/session";
import { syncStravaActivitiesForUser } from "@/lib/sync/stravaSync";

const STATE_COOKIE = "strideiq_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/import?strava=denied`, request.url)
    );
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(
      new URL(`/import?strava=error`, request.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, resolveRedirectUri(request));
    if (!tokens.athlete?.id) {
      return NextResponse.redirect(
        new URL(`/import?strava=error`, request.url)
      );
    }
    let userId = await findUserByStravaAthleteId(tokens.athlete.id);
    if (!userId) userId = await createUser();
    await upsertStravaConnection(userId, tokens);
    await setSessionCookie(userId);

    try {
      await syncStravaActivitiesForUser(userId, { streamMaxRuns: 20 });
    } catch {
      // Initial sync can fail on rate limits; user can retry from Import
    }

    return NextResponse.redirect(
      new URL(`/import?strava=connected`, request.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/import?strava=error`, request.url)
    );
  }
}
