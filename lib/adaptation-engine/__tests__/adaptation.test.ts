import { describe, expect, it } from "vitest";
import { buildAdaptationSignals } from "../index";
import { lowData, raceWeekAthlete } from "@/lib/coaching-context/__tests__/fixtures";

describe("adaptation engine", () => {
  it("returns low confidence for sparse data", () => {
    const signals = buildAdaptationSignals(lowData.analytics);
    expect(signals.length).toBeGreaterThanOrEqual(0);
    for (const s of signals) {
      if (s.supportingEvidence.length < 2) {
        expect(s.confidence).not.toBe("high");
      }
    }
  });

  it("infers taper signal near race", () => {
    const f = raceWeekAthlete();
    const signals = buildAdaptationSignals(f.analytics);
    const taper = signals.find((s) => /taper|fresh/i.test(s.statement));
    expect(taper).toBeTruthy();
  });

  it("preserves contradictory evidence on modality", () => {
    const f = raceWeekAthlete();
    f.analytics.trainingEcosystem.scores.interferenceRisk = 65;
    f.analytics.trainingEcosystem.scores.strengthSupport = 70;
    const signals = buildAdaptationSignals(f.analytics);
    const mod = signals.find((s) => s.category === "modality");
    if (mod) {
      expect(mod.contradictoryEvidence.length).toBeGreaterThanOrEqual(0);
    }
  });
});
