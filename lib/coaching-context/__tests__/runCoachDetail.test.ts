import { describe, expect, it } from "vitest";
import { computeInsights } from "@/lib/analytics";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { buildRunCoachDetail } from "../buildRunCoachDetail";
import { buildRecentSessionDetails } from "../buildRecentSessionDetails";
import { serializeCoachingContextForLLM } from "../serializeForLLM";
import { buildCoachingContext } from "../buildCoachingContext";
import { mkImport, mkRun } from "./fixtures";
import type { FitRunDetail } from "@/lib/strava/fitTypes";

function paceStream(sec: number, basePace: number) {
  const points = [];
  for (let t = 0; t < sec; t += 30) {
    const drift = t > sec * 0.66 ? basePace * 1.04 : basePace;
    points.push({ elapsedSec: t, paceSecPerKm: drift });
  }
  return points;
}

describe("run coach detail", () => {
  it("includes execution and stream metrics when FIT is present", () => {
    const run = mkRun(2, {
      distanceM: 12000,
      movingSec: 3000,
      avgHr: 155,
      name: "Long steady",
    });
    const imp = mkImport([run]);
    const analytics = computeInsights(imp, [], 3, null);
    const fit: FitRunDetail = {
      activityId: run.id,
      laps: [
        {
          index: 1,
          distanceM: 5000,
          timeSec: 1200,
          avgHr: 150,
          avgPaceSecPerKm: 240,
          avgCadence: null,
        },
      ],
      hrStream: Array.from({ length: 40 }, (_, i) => ({
        elapsedSec: i * 60,
        hr: 150 + i * 0.2,
      })),
      paceStream: paceStream(3000, 240),
      cadenceStream: [],
      gpsStream: [],
      hrDriftPct: 5.2,
      avgCadence: null,
      bestEfforts: [],
    };

    const detail = buildRunCoachDetail(run, fit, analytics, [run]);
    expect(detail.executionScore).toBeGreaterThan(0);
    expect(detail.lapSummary).toContain("L1");
    expect(detail.streams).toContain("pace");
    expect(detail.lateFadePct).not.toBeNull();
    expect(detail.narrative.length).toBeGreaterThan(10);
  });

  it("serializes recent session details into coaching context", () => {
    const runs = [mkRun(1), mkRun(4), mkRun(8)];
    const imp = mkImport(runs);
    const analytics = computeInsights(imp, [], 3, null);
    const quality = assessImportQuality(imp);
    const ctx = buildCoachingContext({
      analytics,
      quality,
      runs,
      options: { includeForecast: false },
    });
    expect(ctx.recentSessionDetails.length).toBe(3);
    const text = serializeCoachingContextForLLM(ctx);
    expect(text).toContain("Recent run details");
    expect(text).toContain("runId:");
  });
});
