import { describe, expect, it } from "vitest";
import {
  classifyPlanningMessage,
  isPlanningIntent,
  parseToolInputFromMessage,
} from "../planningIntent";

describe("planning intent routing", () => {
  it("detects build next week", () => {
    const r = classifyPlanningMessage("Build my next week of training.", false);
    expect(r?.kind).toBe("generate");
  });

  it("detects race week plan", () => {
    const r = classifyPlanningMessage("Plan my race week", false);
    expect(r?.kind).toBe("generate");
    expect(r?.kind === "generate" && r.args.constraints?.some((c) => /taper|race/i.test(c))).toBe(
      true,
    );
  });

  it("detects HM goal phrasing", () => {
    const r = classifyPlanningMessage("What should I train next week given my HM goal?", false);
    expect(r?.kind).toBe("generate");
  });

  it("parses conservative preference", () => {
    const args = parseToolInputFromMessage("Give me a conservative plan");
    expect(args.planPreference).toBe("conservative");
  });

  it("parses aggressive preference", () => {
    const args = parseToolInputFromMessage("Give me an aggressive but safe plan");
    expect(args.planPreference).toBe("aggressive");
  });

  it("parses limited days", () => {
    const args = parseToolInputFromMessage("I only have 4 days available next week");
    expect(args.constraints?.some((c) => /4 training days/i.test(c))).toBe(true);
  });

  it("parses available day list", () => {
    const args = parseToolInputFromMessage("I can only train Mon/Wed/Fri/Sun");
    expect(args.availableDays?.length).toBeGreaterThanOrEqual(3);
  });

  it("routes follow-up modify when plan exists", () => {
    const r = classifyPlanningMessage("Make it more conservative", true);
    expect(r?.kind).toBe("modify");
    expect(r?.kind === "modify" && r.modification).toBe("more_conservative");
  });

  it("routes remove strength follow-up", () => {
    const r = classifyPlanningMessage("Remove strength", true);
    expect(r?.kind === "modify" && r?.modification === "remove_strength").toBe(true);
  });

  it("routes explain taper", () => {
    const r = classifyPlanningMessage("Explain why this is a taper", true);
    expect(r?.kind).toBe("explain");
    expect(r?.kind === "explain" && r.topic).toBe("taper");
  });

  it("does not match unrelated chat", () => {
    expect(isPlanningIntent("Why is my pace slower in heat?")).toBe(false);
  });
});
