import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callIntelligenceTool,
  fetchIntelligence,
  fetchStravaApi,
  postStravaApi,
  stravaQuery,
} from "../../../packages/strideiq-mcp/src/client";

/**
 * The MCP package's HTTP client. The package had **zero tests** across 664 LOC (§G-3),
 * and this module is where every tool call is assembled — URL, credentials, and error
 * surfacing. Nothing here needs a live server: `fetch` is stubbed and the assertions
 * are about the request that would go out.
 */

const fetchMock = vi.fn();

function ok(body: unknown = { ok: true }) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
function fail(status: number, body: unknown) {
  return { ok: false, status, json: async () => body } as unknown as Response;
}
/** The URL the stub was last called with. */
function calledUrl(): URL {
  return new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
}
function calledHeaders(): Record<string, string> {
  return (fetchMock.mock.calls.at(-1)?.[1]?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(ok());
  vi.stubGlobal("fetch", fetchMock);
  for (const k of ["STRIDEIQ_BASE_URL", "STRIDEIQ_API_KEY", "STRIDEIQ_SESSION_COOKIE"]) {
    delete process.env[k];
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callIntelligenceTool", () => {
  it("addresses a tool by registry name", async () => {
    await callIntelligenceTool("get_athlete_memory");
    const url = calledUrl();
    expect(url.pathname).toBe("/api/me/intelligence");
    expect(url.searchParams.get("tool")).toBe("get_athlete_memory");
    expect(url.searchParams.get("args")).toBeNull();
  });

  it("serialises arguments as JSON", async () => {
    await callIntelligenceTool("compare_modality_blocks", { blockADays: 14, blockBDays: 28 });
    expect(JSON.parse(calledUrl().searchParams.get("args")!)).toEqual({
      blockADays: 14,
      blockBDays: 28,
    });
  });

  it("omits an empty argument object", async () => {
    await callIntelligenceTool("get_readiness", {});
    expect(calledUrl().searchParams.get("args")).toBeNull();
  });

  it("surfaces the server's error message rather than a bare status", async () => {
    fetchMock.mockResolvedValue(fail(400, { error: 'Unknown tool or section: "nope".' }));
    await expect(callIntelligenceTool("nope")).rejects.toThrow(/Unknown tool or section/);
  });

  it("falls back to the status code when there is no error field", async () => {
    fetchMock.mockResolvedValue(fail(503, {}));
    await expect(callIntelligenceTool("get_readiness")).rejects.toThrow("HTTP 503");
  });
});

describe("credentials", () => {
  it("sends no credentials when none are configured", async () => {
    await callIntelligenceTool("get_readiness");
    const h = calledHeaders();
    expect(h["x-strideiq-api-key"]).toBeUndefined();
    expect(h.Cookie).toBeUndefined();
    expect(h.Accept).toBe("application/json");
  });

  it("sends the API key when set", async () => {
    process.env.STRIDEIQ_API_KEY = "key-123";
    await callIntelligenceTool("get_readiness");
    expect(calledHeaders()["x-strideiq-api-key"]).toBe("key-123");
  });

  it("accepts a bare session token or a full cookie string", async () => {
    process.env.STRIDEIQ_SESSION_COOKIE = "abc.def.ghi";
    await callIntelligenceTool("get_readiness");
    expect(calledHeaders().Cookie).toBe("strideiq_session=abc.def.ghi");

    process.env.STRIDEIQ_SESSION_COOKIE = "strideiq_session=already-formed";
    await callIntelligenceTool("get_readiness");
    expect(calledHeaders().Cookie).toBe("strideiq_session=already-formed");
  });

  it("honours STRIDEIQ_BASE_URL", async () => {
    process.env.STRIDEIQ_BASE_URL = "https://strideiq.example.com";
    await callIntelligenceTool("get_readiness");
    expect(calledUrl().origin).toBe("https://strideiq.example.com");
  });

  it("defaults to localhost:3000", async () => {
    await callIntelligenceTool("get_readiness");
    expect(calledUrl().origin).toBe("http://localhost:3000");
  });
});

describe("legacy section path", () => {
  it("still addresses a section alias", async () => {
    await fetchIntelligence("readiness");
    expect(calledUrl().searchParams.get("section")).toBe("readiness");
  });

  it("drops empty query values", async () => {
    await fetchIntelligence("runs", { limit: "10", type: "" });
    const url = calledUrl();
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.has("type")).toBe(false);
  });
});

describe("strava proxy helpers", () => {
  it("passes the action as a query parameter on GET", async () => {
    await fetchStravaApi("get_athlete", { id: "123" });
    const url = calledUrl();
    expect(url.pathname).toBe("/api/me/strava");
    expect(url.searchParams.get("action")).toBe("get_athlete");
    expect(url.searchParams.get("id")).toBe("123");
  });

  it("puts the action in the body on POST", async () => {
    await postStravaApi("update", { name: "x" });
    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ action: "update", name: "x" });
  });

  it("stravaQuery strips null, undefined and empty values", () => {
    expect(stravaQuery({ a: "1", b: undefined, c: "", d: "4" })).toEqual({ a: "1", d: "4" });
  });
});
