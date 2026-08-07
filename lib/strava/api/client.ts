import { STRAVA_API_BASE } from "./config";

// Literal host allowlist. Kept as a string literal (not derived from a URL) so
// static analysis recognizes the SSRF guards below as a constant-host check.
const STRAVA_HOST = "www.strava.com";

export class StravaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "StravaApiError";
  }
}

/**
 * Build a Strava API request URL from a path and assert it stays on Strava's
 * origin. Request paths interpolate activity/segment/route ids that ultimately
 * originate from user input; every request here carries the user's bearer
 * token, so a tainted URL pointing elsewhere would leak that token (SSRF).
 * Validating the origin against a constant allowlist prevents that.
 */
export function stravaUrl(path: string): string {
  // Always build against the constant Strava base; `path` only contributes the
  // path/query, never the host. The hostname assertion is a defensive allowlist.
  const url = new URL(`${STRAVA_API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  if (url.hostname !== STRAVA_HOST) {
    throw new StravaApiError(
      `Refusing to send Strava credentials to non-Strava host: ${url.hostname}`,
      0,
    );
  }
  return url.toString();
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

async function parseError(res: Response, context: string): Promise<never> {
  const text = await res.text().catch(() => "");
  throw new StravaApiError(
    `${context}: ${res.status}${text ? ` ${text.slice(0, 200)}` : ""}`,
    res.status,
    text,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bounds on how long a `Retry-After` may hold a request, in seconds. */
const MIN_RETRY_SECONDS = 1;
const MAX_RETRY_SECONDS = 60;
const DEFAULT_RETRY_SECONDS = 2;

/**
 * Seconds to wait before retrying, from a `Retry-After` header.
 *
 * The header may be a number of seconds *or* an HTTP-date (RFC 9110 §10.2.3). This
 * used to be `parseInt(header ?? "2")`, which yields NaN for the date form; `NaN` then
 * survived the min/max clamp and `setTimeout(fn, NaN)` fires immediately. The result
 * was a rate-limited request being retried with no delay at all — the behaviour most
 * likely to turn a short throttle into a longer one.
 */
export function retryAfterSeconds(header: string | null): number {
  // Trim first: `Number("   ")` is 0, not NaN, so an all-whitespace header would
  // otherwise be read as "zero seconds" while an empty one fell through to the
  // default. Both mean the same thing — the server said nothing usable.
  const raw = header?.trim();
  if (!raw) return DEFAULT_RETRY_SECONDS;

  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds)) {
    return clampRetry(asSeconds);
  }

  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) {
    return clampRetry(Math.ceil((asDate - Date.now()) / 1000));
  }

  return DEFAULT_RETRY_SECONDS;
}

function clampRetry(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_RETRY_SECONDS;
  return Math.min(Math.max(seconds, MIN_RETRY_SECONDS), MAX_RETRY_SECONDS);
}

export async function stravaGet<T>(
  accessToken: string,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
  options?: { allow404?: boolean; context?: string },
): Promise<T | null> {
  const url = new URL(stravaUrl(path));
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  // Re-assert the host on the exact URL that reaches fetch(), so the SSRF guard
  // is local to the request sink.
  if (url.hostname !== STRAVA_HOST) {
    throw new StravaApiError(`Refusing to call non-Strava host: ${url.hostname}`, 0);
  }

  const context = options?.context ?? path;
  let attempt = 0;

  while (attempt < 2) {
    const res = await fetch(url.toString(), {
      headers: authHeaders(accessToken),
    });

    if (res.status === 404 && options?.allow404) return null;

    if (res.status === 429 && attempt === 0) {
      await sleep(retryAfterSeconds(res.headers.get("Retry-After")) * 1000);
      attempt++;
      continue;
    }

    if (!res.ok) await parseError(res, context);
    return res.json() as Promise<T>;
  }

  throw new StravaApiError(`Strava rate limit exceeded for ${context}. Try again shortly.`, 429);
}

export async function stravaGetText(
  accessToken: string,
  path: string,
  context?: string,
): Promise<string> {
  const url = stravaUrl(path);
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) await parseError(res, context ?? path);
  return res.text();
}

export async function stravaPut<T>(
  accessToken: string,
  path: string,
  body: unknown,
  context?: string,
): Promise<T> {
  const url = stravaUrl(path);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, context ?? path);
  return res.json() as Promise<T>;
}
