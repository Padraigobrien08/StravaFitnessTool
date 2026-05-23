import { describe, expect, it } from "vitest";
import {
  buildCapabilityModelEstimates,
  computeWeightedCapability,
  distanceRelevanceWeight,
} from "../capabilityModels";
import { prepareCapabilityEfforts } from "../effortSelection";
import { assessDurability } from "../durabilityModel";
import { assessFreshness } from "../freshnessModel";
import { assessSpecificity } from "../specificityModel";
import { buildUncertaintyAssessment, buildPredictionInterval } from "../uncertaintyModel";
import { buildContributors } from "../contributionModel";
import { buildScenarios } from "../scenarioModel";
import { buildRaceForecastV2 } from "../forecastEngine";
import {
  fatigueHeavyRunner,
  hmReadyRunner,
  inconsistentModels,
  lowDataRunner,
  marathonWeakDurability,
  strong5kNoLongRuns,
} from "./forecastFixtures";

describe("distanceRelevanceWeight", () => {
  it("down-weights 5K anchor for marathon", () => {
    expect(distanceRelevanceWeight(5, 42)).toBeLessThan(0.35);
  });

  it("weights HM anchor highly for HM", () => {
    expect(distanceRelevanceWeight(21, 21.1)).toBeGreaterThan(0.8);
  });
});

describe("capability models", () => {
  it("produces multiple model estimates for hm-ready runner", () => {
    const estimates = buildCapabilityModelEstimates(hmReadyRunner);
    expect(estimates.length).toBeGreaterThanOrEqual(3);
    expect(estimates.some((e) => e.modelName.includes("Riegel"))).toBe(true);
  });

  it("weights models without blind average", () => {
    const estimates = buildCapabilityModelEstimates(hmReadyRunner);
    const { baseTimeSec, weightedEstimates } = computeWeightedCapability(
      hmReadyRunner,
      estimates
    );
    expect(baseTimeSec).toBeGreaterThan(5000);
    expect(weightedEstimates.length).toBeGreaterThan(0);
    expect(weightedEstimates.some((e) => e.weight > 0)).toBe(true);
  });

  it("returns sparse models for low-data runner", () => {
    const estimates = buildCapabilityModelEstimates(lowDataRunner);
    expect(estimates.length).toBeGreaterThanOrEqual(1);
  });
});

describe("durability", () => {
  it("scores marathon weak when longest run is 20.5 km", () => {
    const d = assessDurability(marathonWeakDurability);
    expect(d.label).not.toBe("strong");
    expect(d.timeMultiplier).toBeGreaterThan(1);
  });

  it("scores HM strong when longest run near target", () => {
    const d = assessDurability(hmReadyRunner);
    expect(d.score).toBeGreaterThan(65);
    expect(d.label).toBe("strong");
  });
});

describe("specificity", () => {
  it("flags low specificity for 5K-only marathon projection", () => {
    const s = assessSpecificity(strong5kNoLongRuns);
    expect(s.label).toBe("low");
    expect(s.gaps.length).toBeGreaterThan(0);
  });

  it("scores high specificity for hm-ready runner", () => {
    const s = assessSpecificity(hmReadyRunner);
    expect(s.score).toBeGreaterThan(65);
  });
});

describe("freshness", () => {
  it("adds positive time adjustment when fatigued", () => {
    const f = assessFreshness(fatigueHeavyRunner);
    expect(f.label).toBe("fatigued");
    expect(f.timeAdjustmentSec).toBeGreaterThan(0);
  });
});

describe("uncertainty", () => {
  it("widens interval for low data", () => {
    const forecast = buildRaceForecastV2(lowDataRunner);
    expect(forecast.confidence).toMatch(/low|medium/);
    expect(
      forecast.predictionIntervalSec.p90 - forecast.predictionIntervalSec.p10
    ).toBeGreaterThan(120);
  });

  it("builds percentile interval", () => {
    const interval = buildPredictionInterval(3600, 240);
    expect(interval.p50).toBe(3600);
    expect(interval.p10).toBeLessThan(interval.p90);
  });
});

describe("contributions", () => {
  it("classifies positive and negative contributors", () => {
    const f = buildRaceForecastV2(hmReadyRunner);
    expect(f.contributors.positive.length).toBeGreaterThan(0);
    const neg = buildRaceForecastV2(fatigueHeavyRunner);
    expect(neg.contributors.negative.length).toBeGreaterThan(0);
  });
});

describe("scenarios", () => {
  it("includes fade-risk when execution risk high", () => {
    const f = buildRaceForecastV2(fatigueHeavyRunner);
    expect(f.scenarios.some((s) => s.name.includes("Fade"))).toBe(true);
  });

  it("generates expected/conservative/optimistic", () => {
    const scenarios = buildScenarios({
      mostLikelyTimeSec: 6000,
      conservativeTimeSec: 6180,
      optimisticTimeSec: 5880,
      execution: {
        score: 50,
        fadeRisk: "medium",
        pacingRisk: "medium",
        evidence: [],
        recommendation: "Even pace",
        conservativePaddingSec: 45,
      },
      freshness: {
        score: 60,
        label: "neutral",
        timeAdjustmentSec: 0,
        evidence: [],
        risks: [],
      },
    });
    expect(scenarios.map((s) => s.name)).toContain("Expected");
    expect(scenarios.map((s) => s.name)).toContain("Conservative");
  });
});

describe("buildRaceForecastV2", () => {
  it("returns full V2 shape with uncertainty and agreement", () => {
    const f = buildRaceForecastV2(hmReadyRunner);
    expect(f.mostLikelyTimeSec).toBeGreaterThan(0);
    expect(f.predictionIntervalSec.p50).toBe(f.mostLikelyTimeSec);
    expect(f.modelEstimates.length).toBeGreaterThan(0);
    expect(f.modelAgreement.spreadSec).toBeGreaterThanOrEqual(0);
    expect(f.limitations.length).toBeGreaterThan(0);
    expect(f.observability.summary.length).toBeGreaterThan(10);
  });

  it("marathon from 5K is slower than hm-ready hm forecast per km", () => {
    const m = buildRaceForecastV2(marathonWeakDurability);
    const h = buildRaceForecastV2(hmReadyRunner);
    expect(m.mostLikelyTimeSec / 42).toBeGreaterThan(h.mostLikelyTimeSec / 21);
  });

  it("includes target analysis when target set", () => {
    const f = buildRaceForecastV2(hmReadyRunner);
    expect(f.targetAnalysis?.targetTimeSec).toBe(6480);
  });

  it("low agreement when models diverge", () => {
    const f = buildRaceForecastV2(inconsistentModels);
    expect(f.modelAgreement.label).not.toBe("high");
  });

  it("most likely stays aligned with capability models", () => {
    const f = buildRaceForecastV2(hmReadyRunner);
    const times = f.modelEstimates.map((e) => e.predictedTimeSec);
    const min = Math.min(...times);
    const max = Math.max(...times);
    expect(f.capabilityBaseTimeSec).toBeGreaterThanOrEqual(min - 5);
    expect(f.capabilityBaseTimeSec).toBeLessThanOrEqual(max + 5);
    expect(f.mostLikelyTimeSec).toBeLessThanOrEqual(max * 1.2 + 120);
    expect(f.mostLikelyTimeSec).toBeGreaterThanOrEqual(min * 0.88 - 60);
  });

  it("dedupes bloated efforts and reports model spread", () => {
    const efforts = [...hmReadyRunner.efforts];
    for (let i = 0; i < 108; i++) {
      efforts.push({
        ...hmReadyRunner.efforts[0],
        runId: `dup${i}`,
        runName: `dup${i}`,
      });
    }
    const prepared = prepareCapabilityEfforts(efforts);
    expect(prepared.length).toBeLessThanOrEqual(40);
    const f = buildRaceForecastV2({ ...hmReadyRunner, efforts: prepared });
    expect(f.modelAgreement.spreadSec).toBeGreaterThan(0);
    f.modelEstimates.forEach((e) => {
      expect(e.weight).toBeGreaterThanOrEqual(0);
      expect(e.weight).toBeLessThanOrEqual(1);
    });
  });

  it("reconciles headline time when weights were invalid (slow HM outlier)", () => {
    const f = buildRaceForecastV2({
      ...hmReadyRunner,
      efforts: [
        ...hmReadyRunner.efforts,
        {
          distanceKm: 21.1,
          timeSec: 10500,
          runId: "slowhm",
          runName: "Slow HM",
          date: "2026-05-01",
          source: "Full run",
          isRaceLike: true,
        },
      ],
    });
    const max = Math.max(...f.modelEstimates.map((e) => e.predictedTimeSec));
    expect(f.mostLikelyTimeSec).toBeLessThanOrEqual(max * 1.2 + 120);
  });
});
