import {
  STRAVA_AUTH_URL,
  STRAVA_SCOPES,
  STRAVA_TOKEN_URL,
  stravaConfig,
} from "./config";
import type { StravaTokenResponse } from "./types";

export function buildStravaAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = stravaConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPES,
    state,
  });
  return `${STRAVA_AUTH_URL}?${params}`;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<StravaTokenResponse> {
  const { clientId, clientSecret, redirectUri } = stravaConfig();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token exchange failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<StravaTokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = stravaConfig();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<StravaTokenResponse>;
}
