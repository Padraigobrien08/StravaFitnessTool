import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/strava/api/oauth";
import { resolveRedirectUri } from "@/lib/strava/api/config";
import { upsertStravaConnection } from "@/lib/db/strava-connection";
import { createUser, findUserByStravaAthleteId } from "@/lib/db/users";
import { setSessionCookie } from "@/lib/auth/session";

const STATE_COOKIE = "strideiq_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  // Redirect back to Import with a specific, diagnosable reason. Every failure
  // path logs server-side and carries a `reason` so the UI can guide the user.
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/import?strava=error&reason=${reason}`, request.url));

  // User declined on Strava's consent screen (error=access_denied).
  if (oauthError) {
    console.warn(`[strava/callback] authorization declined: ${oauthError}`);
    return NextResponse.redirect(new URL(`/import?strava=denied`, request.url));
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code) {
    console.error("[strava/callback] no authorization code in callback");
    return fail("nocode");
  }
  // A missing/mismatched state cookie usually means the link expired (>10 min)
  // or the browser dropped the cookie (blocked cookies / cross-site).
  if (!state || !expectedState || state !== expectedState) {
    console.error("[strava/callback] state mismatch", {
      hasState: Boolean(state),
      hasExpectedCookie: Boolean(expectedState),
    });
    return fail("state");
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, resolveRedirectUri(request));
  } catch (err) {
    // Almost always a Strava-side rejection: wrong client secret, or the app's
    // Authorization Callback Domain not matching this host (e.g. localhost).
    console.error("[strava/callback] token exchange failed:", err);
    return fail("token");
  }

  if (!tokens.athlete?.id) {
    console.error("[strava/callback] token response had no athlete id");
    return fail("noathlete");
  }

  try {
    let userId = await findUserByStravaAthleteId(tokens.athlete.id);
    if (!userId) userId = await createUser();
    await upsertStravaConnection(userId, tokens);
    await setSessionCookie(userId);
  } catch (err) {
    // Connection succeeded with Strava but we couldn't persist it / the session.
    console.error("[strava/callback] failed to persist connection:", err);
    return fail("db");
  }

  // Redirect immediately — the initial activity sync is intentionally NOT done
  // here. Syncing hundreds of activities (paginated + rate-limited) would block
  // this callback for many seconds and make Connect appear to hang. The Import
  // page kicks off the sync client-side with visible progress on ?strava=connected.
  return NextResponse.redirect(new URL(`/import?strava=connected`, request.url));
}
