/**
 * Read per call rather than captured at module load. Capturing meant
 * `STRIDEIQ_BASE_URL` was only honoured if it was already set before this module was
 * first imported — fine under a launcher that sets the environment up front, silently
 * ignored anywhere else.
 */
function baseUrl(): string {
  return process.env.STRIDEIQ_BASE_URL ?? "http://localhost:3000";
}

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

/**
 * Call any tool in the server's registry by name.
 *
 * The `section` aliases below only ever addressed 16 of the 44 registered tools.
 * `?tool=` plus JSON `args` reaches all of them, so this is the path every
 * table-driven registration uses.
 */
export async function callIntelligenceTool(
  tool: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const url = new URL("/api/me/intelligence", baseUrl());
  url.searchParams.set("tool", tool);
  if (args && Object.keys(args).length > 0) {
    url.searchParams.set("args", JSON.stringify(args));
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

/** List the tools the server actually exposes — useful for diagnosing drift. */
export async function fetchToolCatalog(): Promise<unknown> {
  return fetchIntelligence("tools");
}

export async function fetchIntelligence(
  section: string,
  query?: Record<string, string>,
): Promise<unknown> {
  const url = new URL("/api/me/intelligence", baseUrl());
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
  const url = new URL("/api/me/strava", baseUrl());
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
  const url = new URL("/api/me/strava", baseUrl());
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
  const url = new URL("/api/me/coach-composite", baseUrl());
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
