import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { INTELLIGENCE_TOOL_DEFINITIONS } from "@/lib/intelligence/tools";

/**
 * `/api/me/intelligence` tool addressing.
 *
 * The route used to gate every call through a hand-written `section` map of 16 entries,
 * so 28 of the 44 registered tools could not be called over HTTP at all — and therefore
 * not from the MCP package either, despite `FEATURES.md` §11/§12 claiming they could.
 *
 * **What these prove and what they don't.** No database is available here, so a resolved
 * tool fails inside the executor with "DATABASE_URL is not set". That is the signal used:
 * a **400 means the route refused to address the tool**, anything else means it resolved
 * the name and handed off. Reachability is the G-2 property; whether each tool then
 * computes correctly is covered by the unit tests for those engines, not here.
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
vi.mock("@/lib/db/leg-feel", () => ({ getLegFeel: async () => null }));

async function get(query: string) {
  const { GET } = await import("../me/intelligence/route");
  return GET(new NextRequest(`https://example.com/api/me/intelligence${query}`));
}

/** Did the route address the tool, or refuse it? */
async function resolved(query: string): Promise<boolean> {
  const res = await get(query);
  if (res.status !== 400) return true;
  const body = (await res.json()) as { error?: string };
  return !/Unknown tool or section/.test(body.error ?? "");
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  cookieStore.value = createSessionToken(USER);
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  cookieStore.value = undefined;
});

describe("every registered tool is addressable by name", () => {
  it.each(INTELLIGENCE_TOOL_DEFINITIONS.map((t) => t.name))("?tool=%s", async (name) => {
    expect(await resolved(`?tool=${name}`)).toBe(true);
  });

  it("also accepts a tool name in the section parameter", async () => {
    expect(await resolved("?section=get_athlete_memory")).toBe(true);
  });

  it("covers all 44", () => {
    expect(INTELLIGENCE_TOOL_DEFINITIONS).toHaveLength(44);
  });

  // Before the fix these were the unreachable block — every ecosystem tool, plus the
  // adaptive-stack and planning tools added after the section map was written.
  it.each([
    "get_training_ecosystem",
    "get_training_ecosystem_summary",
    "get_modality_distribution",
    "get_cross_training_support",
    "get_interference_risks",
    "get_athlete_archetype",
    "compare_modality_blocks",
    "get_race_week_interference_check",
    "get_strength_mobility_support",
    "get_athlete_memory",
    "get_forecast_accuracy",
    "get_recommendation_outcomes",
    "recommend_today_session",
    "get_physiology",
    "get_run_detail",
  ])("previously unreachable: %s", async (name) => {
    expect(await resolved(`?tool=${name}`)).toBe(true);
  });
});

describe("legacy section aliases keep working", () => {
  it.each([
    "readiness",
    "predictions",
    "plan",
    "weekly_plan",
    "ai_weekly_plan",
    "strategy",
    "fatigue",
    "quality",
    "status",
    "runs",
    "compare_sessions",
    "readiness_delta",
    "best_phase",
    "attribute",
    "fade",
    "pr_context",
  ])("?section=%s still resolves", async (alias) => {
    expect(await resolved(`?section=${alias}`)).toBe(true);
  });

  it("still accepts the legacy per-section query parameters", async () => {
    expect(await resolved("?section=runs&limit=25")).toBe(true);
    expect(await resolved("?section=fade&distanceKm=18")).toBe(true);
    expect(await resolved("?section=pr_context&bucket=hm")).toBe(true);
  });
});

describe("generic arguments", () => {
  it("accepts a JSON args object", async () => {
    expect(
      await resolved(
        `?tool=compare_modality_blocks&args=${encodeURIComponent('{"blockADays":14,"blockBDays":28}')}`,
      ),
    ).toBe(true);
  });

  it("accepts an ecosystem window argument — previously impossible to send at all", async () => {
    expect(
      await resolved(`?tool=get_interference_risks&args=${encodeURIComponent('{"window":28}')}`),
    ).toBe(true);
  });

  it.each([
    ["not json", "{oops"],
    ["a JSON array", "[1,2]"],
    ["a JSON scalar", '"hello"'],
    ["a JSON number", "42"],
  ])("rejects %s with 400 before executing anything", async (_label, raw) => {
    const res = await get(`?tool=get_readiness&args=${encodeURIComponent(raw)}`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("args");
  });
});

describe("discovery", () => {
  // Needs no database, so this asserts the payload directly.
  it("?section=tools lists the whole registry with its aliases", async () => {
    const res = await get("?section=tools");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      tools: { name: string; description: string }[];
      aliases: Record<string, string>;
    };
    expect(body.count).toBe(44);
    expect(body.tools.map((t) => t.name).sort()).toEqual(
      INTELLIGENCE_TOOL_DEFINITIONS.map((t) => t.name).sort(),
    );
    expect(body.tools.every((t) => t.description.length > 0)).toBe(true);
    expect(body.aliases.readiness).toBe("get_readiness");
  });
});

describe("unknown tools", () => {
  it("returns 400 and points at discovery", async () => {
    const res = await get("?tool=get_my_lottery_numbers");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; hint: string; sections: string[] };
    expect(body.error).toContain("get_my_lottery_numbers");
    expect(body.hint).toContain("section=tools");
    expect(body.sections).toContain("brief");
    expect(body.sections).toContain("tools");
  });

  it("rejects a plausible-looking but unregistered name", async () => {
    expect(await resolved("?tool=get_readiness_score")).toBe(false);
  });
});
