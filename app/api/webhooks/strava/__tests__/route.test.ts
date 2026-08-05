import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signWebhookPayload } from "@/lib/strava/webhooks/verify";

/**
 * Route-level test. The original defect was a *wiring* mismatch — the route read
 * `x-hub-signature-256` while Strava sends `x-strava-signature` — which a unit
 * test of the verifier alone could never catch, because both sides were
 * internally consistent. This asserts the route reads the header Strava actually
 * sends, and that a genuine signed delivery reaches the sync layer.
 */

const findUserIdByStravaAthleteId = vi.fn();
const syncSingleActivityForUser = vi.fn();
const deleteActivityForUser = vi.fn();

vi.mock("@/lib/db/users", () => ({
  findUserIdByStravaAthleteId: (...a: unknown[]) => findUserIdByStravaAthleteId(...a),
}));
vi.mock("@/lib/sync/singleActivity", () => ({
  syncSingleActivityForUser: (...a: unknown[]) => syncSingleActivityForUser(...a),
  deleteActivityForUser: (...a: unknown[]) => deleteActivityForUser(...a),
}));

const SECRET = "route-test-secret";
const USER = "11111111-1111-1111-1111-111111111111";

function event(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    aspect_type: "create",
    object_type: "activity",
    object_id: 42,
    owner_id: 105352925,
    subscription_id: 1,
    event_time: Math.floor(Date.now() / 1000),
    ...overrides,
  });
}

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://example.com/api/webhooks/strava", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

function signed(body: string) {
  return { "x-strava-signature": signWebhookPayload(body, SECRET, Math.floor(Date.now() / 1000)) };
}

beforeEach(() => {
  process.env.STRAVA_WEBHOOK_SIGNING_SECRET = SECRET;
  findUserIdByStravaAthleteId.mockReset().mockResolvedValue(USER);
  syncSingleActivityForUser.mockReset().mockResolvedValue(undefined);
  deleteActivityForUser.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.STRAVA_WEBHOOK_SIGNING_SECRET;
  vi.restoreAllMocks();
});

describe("POST /api/webhooks/strava", () => {
  it("accepts a genuine signed delivery and syncs the activity", async () => {
    const { POST } = await import("../route");
    const body = event();
    const res = await POST(post(body, signed(body)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(syncSingleActivityForUser).toHaveBeenCalledWith(USER, 42);
  });

  it("reads x-strava-signature, not the GitHub-style header", async () => {
    const { POST } = await import("../route");
    const body = event();
    const sig = signWebhookPayload(body, SECRET, Math.floor(Date.now() / 1000));
    // Correct signature under the wrong header name must be rejected...
    const wrong = await POST(post(body, { "x-hub-signature-256": sig }));
    expect(wrong.status).toBe(403);
    // ...and accepted under the header Strava actually sends.
    const right = await POST(post(body, { "x-strava-signature": sig }));
    expect(right.status).toBe(200);
  });

  it("rejects an unsigned delivery without touching the sync layer", async () => {
    const { POST } = await import("../route");
    const res = await POST(post(event()));
    expect(res.status).toBe(403);
    expect(syncSingleActivityForUser).not.toHaveBeenCalled();
    expect(deleteActivityForUser).not.toHaveBeenCalled();
  });

  // The destructive path: a spoofed delete must never reach the database.
  it("rejects an unsigned delete without deleting anything", async () => {
    const { POST } = await import("../route");
    const res = await POST(post(event({ aspect_type: "delete" })));
    expect(res.status).toBe(403);
    expect(deleteActivityForUser).not.toHaveBeenCalled();
  });

  it("deletes only on a signed delete event", async () => {
    const { POST } = await import("../route");
    const body = event({ aspect_type: "delete" });
    const res = await POST(post(body, signed(body)));
    expect(res.status).toBe(200);
    expect(deleteActivityForUser).toHaveBeenCalledWith(USER, 42);
    expect(syncSingleActivityForUser).not.toHaveBeenCalled();
  });

  it("fails closed when no signing secret is configured", async () => {
    delete process.env.STRAVA_WEBHOOK_SIGNING_SECRET;
    const { POST } = await import("../route");
    const body = event();
    const res = await POST(
      post(body, {
        "x-strava-signature": signWebhookPayload(body, SECRET, Math.floor(Date.now() / 1000)),
      }),
    );
    expect(res.status).toBe(403);
    expect(syncSingleActivityForUser).not.toHaveBeenCalled();
  });

  it("returns 400 on a signed but unparseable body", async () => {
    const { POST } = await import("../route");
    const body = "not json";
    const res = await POST(post(body, signed(body)));
    expect(res.status).toBe(400);
  });

  it("skips non-activity events", async () => {
    const { POST } = await import("../route");
    const body = event({ object_type: "athlete" });
    const res = await POST(post(body, signed(body)));
    await expect(res.json()).resolves.toEqual({ ok: true, skipped: "not_activity" });
    expect(syncSingleActivityForUser).not.toHaveBeenCalled();
  });

  it("skips events for athletes it does not know", async () => {
    findUserIdByStravaAthleteId.mockResolvedValue(null);
    const { POST } = await import("../route");
    const body = event();
    const res = await POST(post(body, signed(body)));
    await expect(res.json()).resolves.toEqual({ ok: true, skipped: "unknown_athlete" });
    expect(syncSingleActivityForUser).not.toHaveBeenCalled();
  });
});

describe("GET /api/webhooks/strava (subscription challenge)", () => {
  it("echoes the challenge when the verify token matches", async () => {
    process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = "tok";
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest(
        "https://example.com/api/webhooks/strava?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=abc",
      ),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ "hub.challenge": "abc" });
    delete process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  });

  it("rejects a wrong verify token", async () => {
    process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = "tok";
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest(
        "https://example.com/api/webhooks/strava?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=abc",
      ),
    );
    expect(res.status).toBe(403);
    delete process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  });
});
