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
  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET are required");
  }
  return { clientId, clientSecret };
}

/**
 * The OAuth callback URL. Defaults to the host the request came in on — so
 * StrideIQ works from localhost, a LAN IP (`npm run dev:lan`), or a tunnel
 * without reconfiguration; you just register that host's domain with Strava.
 * Set STRAVA_REDIRECT_URI to pin it explicitly (e.g. a fixed prod domain).
 * Honors X-Forwarded-* so it's correct behind a tunnel/proxy.
 */
export function resolveRedirectUri(request: Request): string {
  const explicit = process.env.STRAVA_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}/api/auth/strava/callback`;
}
