import { describe, expect, it } from "vitest";
import { buildImportPageView } from "../viewModels";
import type { ImportQualityReport } from "@/lib/quality/assessImport";

/**
 * The import page's view model — 557 lines feeding four components, at 0% coverage.
 *
 * This is the first screen a new athlete sees, and it is entirely derived state: what
 * is unlocked, what is missing, what to do next. A wrong branch here does not throw,
 * it just quietly tells someone their data is worse (or better) than it is.
 */

type FieldCoverage = ImportQualityReport["fieldCoverage"][number];

function field(label: string, count: number, total: number): FieldCoverage {
  const ratio = total > 0 ? count / total : 0;
  return {
    label,
    count,
    total,
    level: ratio >= 0.85 ? "high" : ratio >= 0.5 ? "medium" : "low",
  } as FieldCoverage;
}

function report(overrides: Partial<ImportQualityReport> = {}): ImportQualityReport {
  return {
    runCount: 50,
    activityCount: 60,
    fitParsed: 40,
    fitReferenced: 45,
    skippedFit: 5,
    lastImport: "2026-01-01T00:00:00Z",
    sportTypes: ["Run"],
    fieldCoverage: [
      field("Distance & time", 50, 50),
      field("Heart rate", 45, 50),
      field("FIT streams", 40, 50),
      field("Elevation", 50, 50),
    ],
    warnings: [],
    overallConfidence: "high",
    ...overrides,
  };
}

type Opts = Parameters<typeof buildImportPageView>[1];

const baseOpts: Opts = {
  apiConnected: false,
  dataSources: { localExport: true, stravaApi: false },
  dataSourceLabel: "Local export",
  fitParsed: 40,
  parsing: false,
  loading: false,
};

const view = (r: ImportQualityReport | null, o: Partial<Opts> = {}) =>
  buildImportPageView(r, { ...baseOpts, ...o });

describe("the empty state", () => {
  it.each([
    ["a null report", null],
    ["a report with no runs", report({ runCount: 0 })],
  ])("treats %s as no data", (_label, r) => {
    const v = view(r as ImportQualityReport | null);
    expect(v.hero.hasData).toBe(false);
    expect(v.hero.confidenceScore).toBe(0);
    expect(v.coverage).toEqual([]);
  });

  // The distinction the page acts on: someone with no connection needs to connect,
  // someone connected with nothing synced needs to wait or sync.
  it("distinguishes no connection from a connected athlete with nothing yet", () => {
    expect(view(null).emptyState).toBe("no_connection");
    expect(view(null, { apiConnected: true }).emptyState).toBe("low_sample");
  });

  it("names the missing capabilities rather than showing an empty list", () => {
    expect(view(null).hero.missingCapabilities.length).toBeGreaterThan(0);
  });

  it("still reports Strava as connected when it is", () => {
    const strava = view(null, { apiConnected: true }).sources.find((s) => s.id === "strava");
    expect(strava).toMatchObject({ status: "connected", enabledCapabilities: ["Live sync"] });
  });
});

describe("capability gating", () => {
  const capabilityFor = (r: ImportQualityReport, id: string, apiConnected = false) =>
    view(r, { apiConnected }).capabilities.find((c) => c.id === id);

  it("unlocks readiness only with enough runs and HR", () => {
    expect(capabilityFor(report(), "readiness")?.unlocked).toBe(true);
    expect(capabilityFor(report({ runCount: 7 }), "readiness")?.unlocked).toBe(false);
  });

  it("explains which of the two conditions failed", () => {
    expect(capabilityFor(report({ runCount: 7 }), "readiness")?.reason).toMatch(/more runs/);
    expect(
      capabilityFor(
        report({ fieldCoverage: [field("Heart rate", 5, 50), field("FIT streams", 40, 50)] }),
        "readiness",
      )?.reason,
    ).toMatch(/HR coverage/);
  });

  it("gates live sync on the connection, not the data", () => {
    expect(capabilityFor(report(), "api")?.unlocked).toBe(false);
    expect(capabilityFor(report(), "api", true)?.unlocked).toBe(true);
  });

  it("unlocks interval detection by either ratio or absolute count", () => {
    // fitRatio 0 but fitParsed 3 clears the absolute threshold.
    const r = report({ fitParsed: 3, fieldCoverage: [field("FIT streams", 0, 50)] });
    expect(capabilityFor(r, "intervals")?.unlocked).toBe(true);
  });

  it("splits the hero's unlocked and missing lists consistently", () => {
    const v = view(report());
    const all = v.capabilities.length;
    expect(
      v.hero.unlockedCapabilities.length + v.capabilities.filter((c) => !c.unlocked).length,
    ).toBe(all);
  });
});

describe("stream coverage", () => {
  it("uses the FIT field when it has a total", () => {
    expect(view(report()).hero.streamCoveragePct).toBe(80);
  });

  // Without the field, it falls back to parsed-over-runs rather than reporting zero.
  it("falls back to fitParsed over runCount", () => {
    const r = report({ runCount: 50, fitParsed: 10, fieldCoverage: [field("Heart rate", 50, 50)] });
    expect(view(r).hero.streamCoveragePct).toBe(20);
  });

  it("is zero when there are no streams at all", () => {
    const r = report({ fitParsed: 0, fieldCoverage: [field("Heart rate", 50, 50)] });
    expect(view(r).hero.streamCoveragePct).toBe(0);
  });

  it("reports the ratio in the comparison label", () => {
    expect(view(report()).fitComparison.coverageLabel).toBe("80% FIT stream coverage (40/50 runs)");
  });
});

describe("guidance", () => {
  it("leads with FIT streams when coverage is the biggest gap", () => {
    const r = report({ fitParsed: 2, fieldCoverage: [field("FIT streams", 2, 50)] });
    expect(view(r).hero.recommendation).toMatch(/FIT activities|sync streams/);
  });

  it("asks for more history when streams are fine but the sample is short", () => {
    const r = report({
      runCount: 12,
      fitParsed: 10,
      fieldCoverage: [field("FIT streams", 10, 12)],
    });
    expect(view(r).hero.recommendation).toMatch(/full history|more runs/);
  });

  it("flags an unconnected API as informational, not critical", () => {
    const item = view(report()).missingGuidance.find((g) => g.title.match(/API not connected/));
    expect(item?.severity).toBe("info");
  });

  it("flags absent data as critical", () => {
    const item = view(null).missingGuidance[0];
    expect(item?.severity).toBe("critical");
  });

  it("surfaces unparsed FIT files as a concrete count", () => {
    const exportSource = view(report({ skippedFit: 7 })).sources.find((s) => s.id === "export");
    expect(exportSource?.missingItems).toContain("7 FIT files referenced but not parsed");
  });
});

describe("processing steps", () => {
  const steps = (loading: boolean, parsing: boolean) =>
    view(report(), { loading, parsing }).processingSteps;

  /**
   * The defect: `done: !(loading || parsing)` meant the ingest row went from active
   * to neither-active-nor-done the moment FIT parsing began, so the checklist showed
   * a stalled first step while the second one worked.
   */
  it.each([
    ["idle", false, false],
    ["loading", true, false],
    ["parsing", false, true],
    ["loading and parsing", true, true],
  ])("leaves no step in limbo while %s", (_label, loading, parsing) => {
    for (const step of steps(loading, parsing)) {
      const pending = !step.active && !step.done;
      const inProgress = loading || parsing;
      // A pending step is only legitimate while something is still running.
      expect(pending && !inProgress, `${step.label} was neither active nor done at rest`).toBe(
        false,
      );
    }
  });

  it("marks ingest done once parsing has started", () => {
    const ingest = steps(false, true)[0];
    expect(ingest).toMatchObject({ label: "Ingest activities", active: false, done: true });
  });

  it("marks ingest active while loading", () => {
    expect(steps(true, false)[0]).toMatchObject({ active: true, done: false });
  });

  it("marks everything done at rest", () => {
    expect(steps(false, false).every((s) => s.done)).toBe(true);
  });

  it("describes what is happening, and nothing at rest", () => {
    // Parsing on top of an existing import is a rebuild, not a first ingest, so the
    // message differs from the parsing-while-loading case.
    expect(view(report(), { parsing: true }).processingMessage).toMatch(/performance baselines/);
    expect(view(report(), { parsing: true, loading: true }).processingMessage).toMatch(
      /workout structure/,
    );
    expect(view(report(), { loading: true }).processingMessage).toMatch(/training archive/);
    expect(view(report()).processingMessage).toBeNull();
  });

  // Worth pinning rather than "fixing": the two branches word the same state
  // differently, which is defensible (one is a first import, the other a rebuild)
  // but is the kind of divergence that looks like a bug on next reading.
  it("words the empty-state message differently from the populated one", () => {
    expect(view(null, { parsing: true }).processingMessage).toMatch(/workout structure/);
    expect(view(report(), { parsing: true }).processingMessage).toMatch(/performance baselines/);
  });
});

describe("source panels", () => {
  it("prefers explicit stream counts over inferring from the report", () => {
    const strava = view(report(), { apiConnected: true, streamsFromApi: 12 }).sources.find(
      (s) => s.id === "strava",
    );
    expect(strava?.streamsLoaded).toBe(12);
  });

  it("counts pending stream syncs as a concrete action", () => {
    const strava = view(report(), { apiConnected: true, runsMissingStreams: 9 }).sources.find(
      (s) => s.id === "strava",
    );
    expect(strava?.missingItems).toContain("9 runs need stream sync");
  });

  it("does not credit runs to a disconnected source", () => {
    const v = view(report(), {
      apiConnected: false,
      dataSources: { localExport: false, stravaApi: false },
    });
    expect(v.sources.find((s) => s.id === "strava")?.runsSynced).toBe(0);
    expect(v.sources.find((s) => s.id === "export")?.runsSynced).toBe(0);
  });
});

describe("low sample", () => {
  it("flags a thin import even when data exists", () => {
    expect(view(report({ runCount: 3 })).emptyState).toBe("low_sample");
    expect(view(report({ runCount: 50 })).emptyState).toBeNull();
  });
});
