import { describe, expect, it } from "vitest";
import { chatDisabledReason, coachHostFromHostname, type CoachHost } from "../chatDisabledReason";

describe("coachHostFromHostname", () => {
  it("treats loopback names as local", () => {
    for (const h of ["localhost", "127.0.0.1", "::1", "[::1]", "LOCALHOST"]) {
      expect(coachHostFromHostname(h), h).toBe("local");
    }
  });

  it("treats a deployment as hosted", () => {
    for (const h of ["strideiq-lemon.vercel.app", "strideiq.app", "192.168.1.14"]) {
      expect(coachHostFromHostname(h), h).toBe("hosted");
    }
  });

  // A LAN address is reachable by other people and has no .env.local the reader can
  // edit, so `npm run dev:lan` must get the hosted wording, not the local one.
  it("does not mistake a LAN address for local", () => {
    expect(coachHostFromHostname("192.168.1.14")).toBe("hosted");
  });
});

describe("chatDisabledReason", () => {
  const demo = (host: CoachHost) => chatDisabledReason({ isDemo: true, apiConnected: false, host });

  it("never tells a hosted reader to edit a file they do not have", () => {
    expect(demo("hosted")).not.toMatch(/\.env\.local/);
  });

  it("does tell a local reader exactly which keys to set", () => {
    const msg = demo("local");
    expect(msg).toContain(".env.local");
    expect(msg).toContain("OPENAI_API_KEY");
    expect(msg).toContain("ANTHROPIC_API_KEY");
  });

  // The failure this guards against is a reader concluding the whole surface is dead
  // and not scrolling. Both variants must lead with what still works.
  it("leads with what is live, in both variants", () => {
    for (const host of ["local", "hosted"] as const) {
      expect(demo(host), host).toMatch(/deterministic engines/);
      expect(demo(host), host).toMatch(/[Oo]nly the chat box is off/);
    }
  });

  it("falls back to the connect prompt when there is no demo and no session", () => {
    const msg = chatDisabledReason({ isDemo: false, apiConnected: false, host: "hosted" });
    expect(msg).toContain("Connect Strava");
  });

  it("asks for a sync when connected but empty", () => {
    const msg = chatDisabledReason({ isDemo: false, apiConnected: true, host: "hosted" });
    expect(msg).toContain("Sync activities");
  });

  it("prefers the demo wording over the connection wording", () => {
    // Demo data and a connected-but-empty server can coexist; the demo is what the
    // reader is actually looking at, so it wins.
    const msg = chatDisabledReason({ isDemo: true, apiConnected: true, host: "hosted" });
    expect(msg).toContain("Demo mode");
  });
});
