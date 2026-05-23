import { describe, expect, it } from "vitest";
import { evaluateSessionExecution } from "../evaluateSessionExecution";
import { mkRun } from "@/lib/coaching-context/__tests__/fixtures";

describe("session intelligence", () => {
  it("evaluates easy run with moderate quality", () => {
    const run = mkRun(2, { distanceM: 10000, avgHr: 145 });
    const session = evaluateSessionExecution(run, null, {
      type: "easy",
      confidence: "medium",
      signals: ["steady pace"],
    });
    expect(session.executionQuality).toBeTruthy();
    expect(session.evidence.length).toBeGreaterThan(0);
    expect(session.confidence).toBe("low");
  });

  it("does not claim excellent without stream data", () => {
    const run = mkRun(1, { distanceM: 20000 });
    const session = evaluateSessionExecution(run, null, {
      type: "long",
      confidence: "low",
      signals: [],
    });
    expect(session.executionQuality).not.toBe("excellent");
  });
});
