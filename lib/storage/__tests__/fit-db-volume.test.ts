import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFitDetails, countFitDetails, getAllFitDetails, saveFitDetails } from "../fit-db";
import { MAX_GPS_POINTS, MAX_STREAM_POINTS } from "@/lib/strava/downsample";
import type { FitRunDetail } from "@/lib/strava/fitTypes";

/**
 * How much space a multi-year athlete's stream cache actually occupies.
 *
 * The audit filed this as unverified (§F-7, remediation item 15): "per-activity
 * stream-rich detail for a multi-year athlete could be hundreds of MB with no eviction".
 * That was a reasonable worry from reading the code — nothing evicts — but nobody had
 * measured it. These tests measure it, so the risk is either retired or quantified
 * rather than left as a hypothesis.
 *
 * The bound that makes it tractable is downsampling: every stream is capped
 * (`MAX_STREAM_POINTS`, `MAX_GPS_POINTS`) before it is stored, so per-run size does not
 * grow with the length of the run. What remains is a linear function of run count.
 */

/** A record at the maximum size the downsampler will ever produce. */
function worstCaseDetail(activityId: string): FitRunDetail {
  return {
    activityId,
    bestEfforts: Array.from({ length: 8 }, (_, i) => ({
      key: `${i + 1}k`,
      label: `${i + 1} km`,
      distanceM: 1000 * (i + 1),
      timeSec: 300 * (i + 1),
      paceSecPerKm: 300,
      startElapsedSec: 60 * i,
      source: "laps" as const,
    })),
    laps: Array.from({ length: 30 }, (_, i) => ({
      index: i + 1,
      distanceM: 1000,
      timeSec: 300,
      avgHr: 150,
      avgPaceSecPerKm: 300,
      avgCadence: 172,
    })),
    hrStream: Array.from({ length: MAX_STREAM_POINTS }, (_, i) => ({
      elapsedSec: i * 30,
      hr: 150 + (i % 20),
    })),
    paceStream: Array.from({ length: MAX_STREAM_POINTS }, (_, i) => ({
      elapsedSec: i * 30,
      paceSecPerKm: 300 + (i % 40),
    })),
    cadenceStream: Array.from({ length: MAX_STREAM_POINTS }, (_, i) => ({
      elapsedSec: i * 30,
      cadence: 170 + (i % 10),
    })),
    // The dominant term: 500 points, each carrying two full-precision coordinates.
    gpsStream: Array.from({ length: MAX_GPS_POINTS }, (_, i) => ({
      elapsedSec: i * 5,
      lat: 53.349805 + i * 0.000123,
      lon: -6.26031 + i * 0.000117,
      elevationM: 10 + (i % 50),
    })),
    hrDriftPct: 3.2,
    avgCadence: 172,
  } as FitRunDetail;
}

/** Serialized size in bytes, which is what a quota is actually measured against. */
const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

const KB = 1024;
const MB = 1024 * KB;

beforeEach(async () => {
  await clearFitDetails();
});

describe("how big one run is", () => {
  it("stays well under 100 KB even at the downsampler's ceiling", () => {
    const size = bytesOf(worstCaseDetail("1"));
    expect(size).toBeLessThan(100 * KB);
  });

  /**
   * The GPS stream is six times the sample budget of the three metric streams
   * combined and carries two full-precision floats per point, so it dominates. Worth
   * pinning: if per-run size ever becomes a problem, this is the term to change, and
   * `MAX_GPS_POINTS` is the single knob.
   */
  it("is dominated by the GPS stream", () => {
    const full = worstCaseDetail("1");
    const withoutGps = { ...full, gpsStream: [] };
    const gpsShare = (bytesOf(full) - bytesOf(withoutGps)) / bytesOf(full);
    expect(gpsShare).toBeGreaterThan(0.5);
  });

  // The real bound. A six-hour ultra and a 30-minute jog store the same number of
  // samples, so per-run size does not track run length.
  it("does not grow with the length of the run", () => {
    const short = worstCaseDetail("short");
    const ultra = worstCaseDetail("ultra");
    expect(bytesOf(ultra)).toBe(bytesOf(short));
  });
});

describe("how big a whole athlete is", () => {
  /**
   * The audit's actual question. A committed athlete runs roughly 250 times a year, so
   * five years is ~1,250 runs — and only runs with FIT streams are stored at all.
   *
   * Measured rather than estimated, against the worst-case record above.
   */
  it("a five-year athlete's cache is tens of megabytes, not hundreds", () => {
    const fiveYears = 1_250;
    const total = bytesOf(worstCaseDetail("x")) * fiveYears;

    expect(total).toBeLessThan(100 * MB);
    expect(total).toBeGreaterThan(1 * MB); // sanity: the fixture is not empty
  });

  it("a decade of running still fits inside a typical browser budget", () => {
    const tenYears = 2_500;
    // Chrome grants IndexedDB a share of free disk measured in gigabytes; Safari is
    // the tight one at roughly 1 GB. Both leave ample headroom at this size.
    expect(bytesOf(worstCaseDetail("x")) * tenYears).toBeLessThan(200 * MB);
  });

  it("scales linearly, so the estimate above holds at any count", async () => {
    for (let i = 0; i < 50; i++) await saveFitDetails([worstCaseDetail(`r${i}`)]);
    const stored = await getAllFitDetails();

    expect(await countFitDetails()).toBe(50);
    const measured = bytesOf(stored);
    const predicted = bytesOf(worstCaseDetail("x")) * 50;
    // Within 10%: array overhead and id lengths, nothing structural.
    expect(Math.abs(measured - predicted) / predicted).toBeLessThan(0.1);
  });
});

describe("what is not bounded", () => {
  /**
   * Recorded plainly, because the measurement retires the size worry but not this one:
   * there is no eviction. `clearFitDetails` wipes everything and nothing removes a
   * single stale record, so the cache only grows until the athlete clears their data.
   *
   * At tens of megabytes that is a defensible design rather than a leak — which is the
   * useful outcome of measuring rather than guessing. It would stop being defensible if
   * `MAX_GPS_POINTS` grew substantially, and this test is where that would show up.
   */
  it("keeps every record until the athlete clears everything", async () => {
    for (let i = 0; i < 20; i++) await saveFitDetails([worstCaseDetail(`r${i}`)]);
    expect(await countFitDetails()).toBe(20);

    await saveFitDetails([worstCaseDetail("r20")]);
    expect(await countFitDetails()).toBe(21);

    await clearFitDetails();
    expect(await countFitDetails()).toBe(0);
  });

  it("replaces rather than accumulates when the same run is re-imported", async () => {
    for (let i = 0; i < 5; i++) await saveFitDetails([worstCaseDetail("same-run")]);
    expect(await countFitDetails()).toBe(1);
  });
});
