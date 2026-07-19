import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildStravaAuthorizeUrl } from "@/lib/strava/api/oauth";
import { resolveRedirectUri } from "@/lib/strava/api/config";
import { randomBytes } from "crypto";

const STATE_COOKIE = "strideiq_oauth_state";

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(
    buildStravaAuthorizeUrl(state, resolveRedirectUri(request))
  );
}
