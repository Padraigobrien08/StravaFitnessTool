import { describe, expect, it } from "vitest";
import { buildRouteGeometry, computeBounds, positionAtTime } from "../geometry";
import { analyzeElevationSegments } from "../elevation";
import type { TimelinePoint } from "../types";

/**
 * Route geometry and elevation analysis — what the map draws and what the replay
 * scrubber points at.
 *
 * These are the numbers behind a picture, which is what makes them worth pinning:
 * a wrong bounding box or a misplaced marker looks like a rendering glitch rather
 * than a calculation error, so nobody goes looking in the maths.
 */

function point(overrides: Partial<TimelinePoint> = {}): TimelinePoint {
  return {
    elapsedSec: 0,
    lat: 53.35,
    lon: -6.26,
    elevationM: 10,
    paceSecPerKm: 300,
    hr: 150,
    cadence: 170,
    ...overrides,
  };
}

/** A straight line of `n` points, one per `stepSec`, climbing `climbPerPoint` metres. */
function track(n: number, stepSec = 10, climbPerPoint = 0): TimelinePoint[] {
  return Array.from({ length: n }, (_, i) =>
    point({
      elapsedSec: i * stepSec,
      lat: 53.35 + i * 0.001,
      lon: -6.26 + i * 0.001,
      elevationM: 10 + i * climbPerPoint,
    }),
  );
}

describe("computeBounds", () => {
  it("brackets the points", () => {
    const b = computeBounds([
      { lat: 10, lon: 20 },
      { lat: -5, lon: 40 },
    ]);
    expect(b).toEqual({ minLat: -5, maxLat: 10, minLon: 20, maxLon: 40 });
  });

  it("handles a single point as a degenerate box", () => {
    expect(computeBounds([{ lat: 1, lon: 2 }])).toEqual({
      minLat: 1,
      maxLat: 1,
      minLon: 1 * 0 + 2,
      maxLon: 2,
    });
  });

  /**
   * With no points the seeds are returned unchanged: min lat 90 and max lat -90, an
   * inverted box covering nothing and everything at once. Recorded rather than
   * changed — `buildRouteGeometry` never calls it with fewer than two points, so no
   * caller can reach it today, and returning something different would be a silent
   * contract change for whoever calls it next.
   */
  it("returns an inverted box for no points, which callers must not pass", () => {
    const b = computeBounds([]);
    expect(b.minLat).toBeGreaterThan(b.maxLat);
    expect(b.minLon).toBeGreaterThan(b.maxLon);
  });
});

describe("buildRouteGeometry", () => {
  it("refuses to draw a route from fewer than two points", () => {
    expect(buildRouteGeometry("a", [])).toBeNull();
    expect(buildRouteGeometry("a", [point()])).toBeNull();
  });

  // GeoJSON order is [lon, lat]; swapping them puts Dublin in Antarctica.
  it("emits coordinates as [lon, lat]", () => {
    const geo = buildRouteGeometry("a", track(3))!;
    expect(geo.coordinates[0]).toEqual([-6.26, 53.35]);
  });

  it("measures the route rather than the straight line between its ends", () => {
    const geo = buildRouteGeometry("a", track(5))!;
    expect(geo.totalDistanceM).toBeGreaterThan(0);
  });

  it("takes duration from the last sample", () => {
    expect(buildRouteGeometry("a", track(4, 15))!.durationSec).toBe(45);
  });

  it("carries the activity id through", () => {
    expect(buildRouteGeometry("run-7", track(3))!.activityId).toBe("run-7");
  });
});

describe("positionAtTime", () => {
  const timeline = track(5, 10);

  it("has no position on an empty timeline", () => {
    expect(positionAtTime([], 0)).toBeNull();
  });

  // Scrubbing before the start or past the end must clamp, not extrapolate off-route.
  it("clamps to the start before the run begins", () => {
    expect(positionAtTime(timeline, -50)).toMatchObject({ index: 0 });
  });

  it("clamps to the finish after the run ends", () => {
    expect(positionAtTime(timeline, 9_999)).toMatchObject({ index: timeline.length - 1 });
  });

  it("lands exactly on a sample when the time matches one", () => {
    const at = positionAtTime(timeline, 20)!;
    expect(at.lat).toBeCloseTo(timeline[2].lat, 10);
  });

  // Between samples the marker interpolates, or it would jump in visible steps.
  it("interpolates between two samples", () => {
    const at = positionAtTime(timeline, 15)!;
    expect(at.lat).toBeGreaterThan(timeline[1].lat);
    expect(at.lat).toBeLessThan(timeline[2].lat);
  });

  it("does not divide by zero when two samples share a timestamp", () => {
    const dupe = [
      point({ elapsedSec: 0 }),
      point({ elapsedSec: 0, lat: 54 }),
      point({ elapsedSec: 10, lat: 55 }),
    ];
    expect(() => positionAtTime(dupe, 0)).not.toThrow();
  });
});

describe("analyzeElevationSegments", () => {
  it("says nothing without enough elevation samples", () => {
    expect(analyzeElevationSegments(track(3, 10, 5))).toEqual([]);
  });

  it("ignores points with no elevation reading", () => {
    const mixed = track(10, 10, 5).map((p, i) => (i % 2 ? { ...p, elevationM: null } : p));
    expect(() => analyzeElevationSegments(mixed)).not.toThrow();
  });

  it("finds nothing on a flat route", () => {
    expect(analyzeElevationSegments(track(20, 10, 0))).toEqual([]);
  });

  it("finds a climb on a sustained ascent", () => {
    const segments = analyzeElevationSegments(track(20, 10, 8));
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].kind).toBe("climb");
    expect(segments[0].label).toMatch(/^Climb \+\d+m$/);
  });

  it("finds a descent on a sustained drop", () => {
    const segments = analyzeElevationSegments(track(20, 10, -8));
    expect(segments[0].kind).toBe("descent");
    expect(segments[0].label).toMatch(/^Descent/);
  });

  it("reports gain as a positive number for both kinds", () => {
    for (const per of [8, -8]) {
      for (const s of analyzeElevationSegments(track(20, 10, per))) {
        expect(s.gainM).toBeGreaterThanOrEqual(0);
        expect(s.avgGradePct).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("keeps segments within the run's own timespan", () => {
    const timeline = track(30, 10, 8);
    const end = timeline[timeline.length - 1].elapsedSec;
    for (const s of analyzeElevationSegments(timeline)) {
      expect(s.startSec).toBeGreaterThanOrEqual(0);
      expect(s.endSec).toBeLessThanOrEqual(end);
      expect(s.endSec).toBeGreaterThan(s.startSec);
    }
  });

  // The list is rendered, so an unbounded one would be a wall of text on a long ride.
  it("caps the number of segments", () => {
    expect(analyzeElevationSegments(track(400, 10, 9)).length).toBeLessThanOrEqual(16);
  });

  it("survives samples that share a timestamp", () => {
    const stalled = track(20, 10, 8).map((p, i) => (i === 5 ? { ...p, elapsedSec: 40 } : p));
    expect(() => analyzeElevationSegments(stalled)).not.toThrow();
  });

  /**
   * Recorded, not changed: grade is computed against `dt * 3`, a hardcoded 3 m/s
   * (about 5:33/km) rather than the athlete's actual speed. At half that pace the
   * distance is overestimated twofold and the grade halved, so a real climb can fall
   * under the 2.5% threshold and vanish. Changing the constant would change every
   * climb every athlete sees, which is a product decision rather than a bug fix.
   */
  it("derives grade from an assumed pace, not the recorded one", () => {
    const fast = track(20, 10, 8).map((p) => ({ ...p, paceSecPerKm: 200 }));
    const slow = track(20, 10, 8).map((p) => ({ ...p, paceSecPerKm: 600 }));
    expect(analyzeElevationSegments(fast)).toEqual(analyzeElevationSegments(slow));
  });
});
