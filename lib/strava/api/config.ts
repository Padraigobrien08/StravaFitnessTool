export const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
export const STRAVA_API_BASE = "https://www.strava.com/api/v3";

/**
 * Strava OAuth scopes (see developers.strava.com/docs/authentication).
 * Note: `profile:read` is invalid — use `profile:read_all` for full profile.
 */
export const STRAVA_SCOPES = "read,activity:read_all,profile:read_all";

export function stravaConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REDIRECT_URI are required");
  }
  return { clientId, clientSecret, redirectUri };
}
