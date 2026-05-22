import { describe, expect, it } from "vitest";
import {
  acuteChronicLoad,
  buildFatigueSnapshot,
  weeklyLoadSeries,
} from "../fatigue";
import type { RunActivity } from "@/lib/strava/types";
import { format, subWeeks, startOfWeek } from "date-fns";

function mockRun(date: string, load: number): RunActivity {
  const movingSec = 3000;
  return {
    id: date,
    name: "Run",
    date,
    distanceM: 8000,
    movingSec,
    elapsedSec: movingSec,
    avgHr: 150,
    maxHr: 170,
    avgSpeedMps: null,
    maxSpeedMps: null,
    elevationGainM: 50,
    calories: null,
    relativeEffort: null,
    trainingLoad: load,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence: null,
    totalSteps: null,
    weatherTempC: null,
  } as RunActivity;
}

describe("fatigue", () => {
  it("ATL exceeds CTL after rising load", () => {
    const runs: RunActivity[] = [];
    for (let i = 8; i >= 0; i--) {
      const d = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
      runs.push(mockRun(format(d, "yyyy-MM-dd"), 20 + (8 - i) * 15));
    }
    const series = weeklyLoadSeries(runs);
    const { atl, ctl, tsb } = acuteChronicLoad(series);
    expect(atl).toBeGreaterThan(0);
    expect(tsb).toBeLessThan(atl);
  });

  it("builds freshness snapshot", () => {
    const runs = [mockRun(new Date().toISOString().slice(0, 10), 50)];
    const snap = buildFatigueSnapshot(runs);
    expect(snap.freshness).toBeGreaterThanOrEqual(0);
    expect(snap.freshness).toBeLessThanOrEqual(100);
    expect(snap.evidence.length).toBeGreaterThan(0);
  });
});
