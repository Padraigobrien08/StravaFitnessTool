import { STRAVA_API_BASE } from "./config";

export class StravaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = "StravaApiError";
  }
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

async function parseError(res: Response, context: string): Promise<never> {
  const text = await res.text().catch(() => "");
  throw new StravaApiError(
    `${context}: ${res.status}${text ? ` ${text.slice(0, 200)}` : ""}`,
    res.status,
    text
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function stravaGet<T>(
  accessToken: string,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
  options?: { allow404?: boolean; context?: string }
): Promise<T | null> {
  const url = new URL(
    path.startsWith("http") ? path : `${STRAVA_API_BASE}${path.startsWith("/") ? path : `/${path}`}`
  );
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const context = options?.context ?? path;
  let attempt = 0;

  while (attempt < 2) {
    const res = await fetch(url.toString(), {
      headers: authHeaders(accessToken),
    });

    if (res.status === 404 && options?.allow404) return null;

    if (res.status === 429 && attempt === 0) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "2", 10);
      await sleep(Math.min(Math.max(retryAfter, 1), 60) * 1000);
      attempt++;
      continue;
    }

    if (!res.ok) await parseError(res, context);
    return res.json() as Promise<T>;
  }

  throw new StravaApiError(
    `Strava rate limit exceeded for ${context}. Try again shortly.`,
    429
  );
}

export async function stravaGetText(
  accessToken: string,
  path: string,
  context?: string
): Promise<string> {
  const url = `${STRAVA_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) await parseError(res, context ?? path);
  return res.text();
}

export async function stravaPut<T>(
  accessToken: string,
  path: string,
  body: unknown,
  context?: string
): Promise<T> {
  const url = `${STRAVA_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
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
