const BASE = process.env.STRIDEIQ_BASE_URL ?? "http://localhost:3000";

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/json",
  };
  const apiKey = process.env.STRIDEIQ_API_KEY;
  if (apiKey) {
    h["x-strideiq-api-key"] = apiKey;
  }
  const cookie = process.env.STRIDEIQ_SESSION_COOKIE;
  if (cookie) {
    h.Cookie = cookie.includes("=") ? cookie : `strideiq_session=${cookie}`;
  }
  return h;
}

export async function fetchIntelligence(
  section: string,
  query?: Record<string, string>,
): Promise<unknown> {
  const url = new URL("/api/me/intelligence", BASE);
  url.searchParams.set("section", section);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), { headers: headers() });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : `HTTP ${res.status}`,
    );
  }
  return data;
}

export async function fetchStravaApi(
  action: string,
  query?: Record<string, string>,
): Promise<unknown> {
  const url = new URL("/api/me/strava", BASE);
  url.searchParams.set("action", action);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), { headers: headers() });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : `HTTP ${res.status}`,
    );
  }
  return data;
}

export async function postStravaApi(
  action: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = new URL("/api/me/strava", BASE);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...headers(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : `HTTP ${res.status}`,
    );
  }
  return data;
}

export async function fetchCompositeCoach(
  action: string,
  query?: Record<string, string>,
): Promise<unknown> {
  const url = new URL("/api/me/coach-composite", BASE);
  url.searchParams.set("action", action);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), { headers: headers() });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : `HTTP ${res.status}`,
    );
  }
  return data;
}

export function stravaQuery(entries: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out;
}
