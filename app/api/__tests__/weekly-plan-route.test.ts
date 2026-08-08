import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";

/**
 * The weekly-plan endpoint.
 *
 * Its most consequential line is not the happy path but
 * `forceFallback: body.forceFallback || !hasOpenAI` — the switch that decides whether
 * an athlete gets an LLM-written week or the deterministic template. That is invisible
 * from the UI: both return a plan, and only the `source` field says which.
 */

const SECRET = "test-session-secret-at-least-16";
const USER = "11111111-1111-1111-1111-111111111111";

const cookieStore = { value: undefined as string | undefined };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "strideiq_session" && cookieStore.value ? { value: cookieStore.value } : undefined,
  }),
}));

vi.mock("@/lib/db/leg-feel", () => ({ getLegFeel: vi.fn().mockResolvedValue(null) }));

const executeGenerateNextWeekTrainingPlan = vi.fn();
vi.mock("@/lib/ai-planning/planTool", () => ({
  executeGenerateNextWeekTrainingPlan: (...a: unknown[]) =>
    executeGenerateNextWeekTrainingPlan(...a),
}));

const planResult = () => ({
  plan: { weekStart: "2026-03-09", workouts: [] },
  guardrails: { constraintNotes: [] },
  source: "llm",
  validation: { issues: [] },
  integrity: { severity: "none" },
  observability: {},
  replySummary: "ok",
});

function request(body?: unknown, method = "POST") {
  return new NextRequest("https://example.com/api/me/weekly-plan", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  cookieStore.value = createSessionToken(USER);
  process.env.OPENAI_API_KEY = "sk-test";
  executeGenerateNextWeekTrainingPlan.mockReset().mockResolvedValue(planResult());
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  delete process.env.OPENAI_API_KEY;
  cookieStore.value = undefined;
});

async function post(body?: unknown) {
  const { POST } = await import("@/app/api/me/weekly-plan/route");
  return POST(request(body));
}

async function get() {
  const { GET } = await import("@/app/api/me/weekly-plan/route");
  return GET(request(undefined, "GET"));
}

/** The options object handed to the planner. */
const planOpts = () =>
  executeGenerateNextWeekTrainingPlan.mock.calls[0][2] as { forceFallback: boolean };

describe("authentication", () => {
  it.each([
    ["POST", () => post({})],
    ["GET", () => get()],
  ])("%s refuses without a session", async (_label, call) => {
    cookieStore.value = undefined;
    expect((await call()).status).toBe(401);
    expect(executeGenerateNextWeekTrainingPlan).not.toHaveBeenCalled();
  });
});

describe("request validation", () => {
  it("accepts an empty body", async () => {
    expect((await post()).status).toBe(200);
  });

  it.each([
    ["a non-boolean forceFallback", { forceFallback: "yes" }],
    ["an over-long planning context", { planningContext: "x".repeat(2001) }],
    ["a malformed weekStart", { weekStart: "next monday" }],
  ])("rejects %s with 400", async (_label, body) => {
    expect((await post(body)).status).toBe(400);
    expect(executeGenerateNextWeekTrainingPlan).not.toHaveBeenCalled();
  });

  it("passes the planning context through to the planner", async () => {
    await post({ planningContext: "Just raced a half" });
    expect(executeGenerateNextWeekTrainingPlan.mock.calls[0][1]).toMatchObject({
      planningContext: "Just raced a half",
    });
  });
});

describe("choosing the LLM or the template", () => {
  it("uses the LLM when a key is configured", async () => {
    await post({});
    expect(planOpts().forceFallback).toBe(false);
  });

  it("honours an explicit request for the deterministic plan", async () => {
    await post({ forceFallback: true });
    expect(planOpts().forceFallback).toBe(true);
  });

  /**
   * The weekly planner is OpenAI-only — `generateWeeklyPlan` reads `OPENAI_API_KEY`
   * and `OPENAI_MODEL` and has no Anthropic path — so this check is correct rather
   * than an oversight.
   *
   * It is worth pinning because the consequence is invisible: an Anthropic-only
   * deployment gets a working Coach and silently deterministic weekly plans, with
   * nothing on screen to say so. `lib/env.ts` now warns about exactly that.
   */
  it("falls back to the template when there is no OpenAI key", async () => {
    delete process.env.OPENAI_API_KEY;
    await post({});
    expect(planOpts().forceFallback).toBe(true);
  });

  it("treats a blank OpenAI key as absent", async () => {
    process.env.OPENAI_API_KEY = "   ";
    await post({});
    expect(planOpts().forceFallback).toBe(true);
  });

  // GET is documented as the deterministic endpoint, so it must never call the LLM.
  it("always uses the template on GET, even with a key", async () => {
    await get();
    expect(planOpts().forceFallback).toBe(true);
  });
});

describe("the response", () => {
  it("returns the plan and everything the UI branches on", async () => {
    const body = await (await post({})).json();
    expect(body).toMatchObject({
      plan: expect.anything(),
      guardrails: expect.anything(),
      source: "llm",
      validation: expect.anything(),
      integrity: expect.anything(),
    });
  });

  it("reports a generation failure as a 500 with its reason", async () => {
    executeGenerateNextWeekTrainingPlan.mockRejectedValue(new Error("planner unavailable"));
    const res = await post({});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("planner unavailable");
  });

  it("does not leak a non-Error throw verbatim", async () => {
    executeGenerateNextWeekTrainingPlan.mockRejectedValue({ secret: "internal" });
    const body = await (await post({})).json();
    expect(JSON.stringify(body)).not.toContain("internal");
  });
});
