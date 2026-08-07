import { describe, expect, it } from "vitest";
import {
  filterExplorerRows,
  groupExplorerRows,
  monthKeyFromDate,
  monthLabelFromKey,
  paginateRows,
  sortExplorerRows,
} from "../explorerUtils";
import type { RunExplorerRow } from "../viewModels";

/**
 * The activity explorer's filter, sort and paginate logic — 5% covered, and the part
 * of the runs page that decides what an athlete can actually find.
 *
 * Tested here rather than through `RunExplorer` because it is pure: driving it via the
 * component would need a 25-field fixture per row and a jsdom render to assert the
 * same things, and would fail for layout reasons that have nothing to do with the
 * filtering.
 */

let seq = 0;

function row(overrides: Partial<RunExplorerRow> = {}): RunExplorerRow {
  seq += 1;
  const date = overrides.date ?? `2026-03-${String((seq % 28) + 1).padStart(2, "0")}`;
  return {
    runId: `run-${seq}`,
    date,
    dateDisplay: date,
    formattedTitle: { primary: `Run ${seq}` },
    rawName: `Run ${seq}`,
    workout: { type: "easy" },
    purpose: "Aerobic maintenance",
    impact: "",
    markers: [],
    distanceDisplay: "10.0 km",
    distanceKm: 10,
    paceDisplay: "5:00",
    paceSec: 300,
    hrDisplay: "150",
    loadDisplay: "50",
    loadValue: 50,
    hasFit: false,
    significanceScore: 10,
    significanceTier: "routine",
    executionLabel: "Solid",
    executionRank: 3,
    adaptationTags: [],
    groupKey: date.slice(0, 7),
    groupLabel: "Mar 2026",
    ...overrides,
  } as RunExplorerRow;
}

const NO_FILTERS = {
  search: "",
  typeFilter: "all",
  quickFilter: "all" as const,
  significanceFilter: "all",
  effortFilter: "all" as const,
};

const filter = (rows: RunExplorerRow[], opts: Partial<typeof NO_FILTERS> = {}) =>
  filterExplorerRows(rows, { ...NO_FILTERS, ...opts });

const ids = (rows: RunExplorerRow[]) => rows.map((r) => r.runId);

describe("searching", () => {
  // Each row is given a distinct purpose, because the default one ("Aerobic
  // maintenance") would otherwise match the adaptation-tag search too and make the
  // per-field cases indistinguishable.
  const rows = [
    row({ runId: "a", rawName: "Morning Tempo", purpose: "Threshold work" }),
    row({
      runId: "b",
      rawName: "Easy shakeout",
      purpose: "Recovery",
      adaptationTags: ["aerobic base"],
    }),
    row({ runId: "c", rawName: "Long run", purpose: "Endurance", dateDisplay: "12 Mar 2026" }),
  ];

  it("returns everything for an empty search", () => {
    expect(filter(rows)).toHaveLength(3);
  });

  // Each of these is a separate field in the predicate; a search that only looked at
  // the name would silently stop finding runs by purpose or tag.
  it.each([
    ["the raw name", "tempo", "a"],
    ["the purpose", "threshold", "a"],
    ["an adaptation tag", "aerobic", "b"],
    ["the displayed date", "12 mar", "c"],
  ])("matches on %s", (_label, search, expected) => {
    expect(ids(filter(rows, { search }))).toEqual([expected]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(ids(filter(rows, { search: "  TEMPO  " }))).toEqual(["a"]);
  });

  it("returns nothing rather than everything when nothing matches", () => {
    expect(filter(rows, { search: "zzzz" })).toEqual([]);
  });
});

describe("filtering by type and quick filter", () => {
  const rows = [
    row({ runId: "easy", workout: { type: "easy" } as never }),
    row({ runId: "tempo", workout: { type: "tempo" } as never }),
    row({ runId: "interval", workout: { type: "interval" } as never }),
    row({ runId: "long", workout: { type: "long" } as never, markers: ["long"] as never }),
    row({ runId: "race", workout: { type: "race" } as never }),
  ];

  it("narrows to a single workout type", () => {
    expect(ids(filter(rows, { typeFilter: "tempo" }))).toEqual(["tempo"]);
  });

  it.each([
    ["threshold", ["tempo", "interval"]],
    ["recovery", ["easy"]],
    ["long", ["long"]],
    ["race_specific", ["tempo", "long", "race"]],
  ])("quick filter %s selects the right sessions", (quickFilter, expected) => {
    expect(ids(filter(rows, { quickFilter: quickFilter as never })).sort()).toEqual(
      [...expected].sort(),
    );
  });

  // `long` keys off a marker rather than the workout type, so a long run that was
  // never marked would not appear — worth pinning, since the two are easy to conflate.
  it("treats long as a marker, not a type", () => {
    const unmarked = [row({ runId: "x", workout: { type: "long" } as never, markers: [] })];
    expect(filter(unmarked, { quickFilter: "long" as never })).toEqual([]);
  });

  it("combines filters rather than replacing one with the next", () => {
    const result = filter(rows, { quickFilter: "threshold" as never, typeFilter: "tempo" });
    expect(ids(result)).toEqual(["tempo"]);
  });

  it("finds a best-execution session by label or marker", () => {
    const rows2 = [
      row({ runId: "by-label", executionLabel: "Excellent" }),
      row({ runId: "by-marker", markers: ["efficient"] as never }),
      row({ runId: "neither", executionLabel: "Solid" }),
    ];
    expect(ids(filter(rows2, { quickFilter: "best_execution" as never })).sort()).toEqual([
      "by-label",
      "by-marker",
    ]);
  });
});

describe("sorting", () => {
  const rows = [
    row({ runId: "mid", date: "2026-03-10", distanceKm: 10, paceSec: 300, loadValue: 50 }),
    row({ runId: "new", date: "2026-03-20", distanceKm: 21, paceSec: 260, loadValue: 90 }),
    row({ runId: "old", date: "2026-03-01", distanceKm: 5, paceSec: 340, loadValue: 20 }),
  ];

  it("defaults to newest first when descending", () => {
    expect(ids(sortExplorerRows(rows, "date", false))).toEqual(["new", "mid", "old"]);
  });

  it("reverses on ascending", () => {
    expect(ids(sortExplorerRows(rows, "date", true))).toEqual(["old", "mid", "new"]);
  });

  it.each([
    ["distance", ["new", "mid", "old"]],
    ["load", ["new", "mid", "old"]],
    // Lower pace seconds is faster, so descending puts the slowest first.
    ["pace", ["old", "mid", "new"]],
  ])("sorts by %s", (key, expected) => {
    expect(ids(sortExplorerRows(rows, key as never, false))).toEqual(expected);
  });

  // A sort that mutates its input would reorder the caller's memoised array and make
  // the next filter pass operate on a different order than it expects.
  it("does not mutate the input", () => {
    const original = ids(rows);
    sortExplorerRows(rows, "distance", true);
    expect(ids(rows)).toEqual(original);
  });

  it("treats a missing load as zero rather than dropping the row", () => {
    const withNull = [
      row({ runId: "none", loadValue: null }),
      row({ runId: "some", loadValue: 5 }),
    ];
    expect(ids(sortExplorerRows(withNull, "load", true))).toEqual(["none", "some"]);
  });
});

describe("pagination", () => {
  const rows = Array.from({ length: 55 }, (_, i) => row({ runId: `r${i}` }));

  it("returns one page at a time", () => {
    const { pageRows, totalPages, total } = paginateRows(rows, 0, 25);
    expect(pageRows).toHaveLength(25);
    expect(totalPages).toBe(3);
    expect(total).toBe(55);
  });

  it("gives the remainder on the last page", () => {
    expect(paginateRows(rows, 2, 25).pageRows).toHaveLength(5);
  });

  // The clamp is what keeps the table populated when the row set shrinks underneath a
  // reader who is on a later page.
  it.each([
    ["past the end", 99],
    ["negative", -3],
  ])("clamps a page index that is %s", (_label, page) => {
    expect(paginateRows(rows, page, 25).pageRows.length).toBeGreaterThan(0);
  });

  it("reports one page for an empty list rather than zero", () => {
    const { totalPages, pageRows } = paginateRows([], 0, 25);
    expect(totalPages).toBe(1);
    expect(pageRows).toEqual([]);
  });
});

describe("grouping", () => {
  const rows = [
    row({ runId: "mar-1", date: "2026-03-05", groupKey: "2026-03", groupLabel: "Mar 2026" }),
    row({ runId: "feb-1", date: "2026-02-20", groupKey: "2026-02", groupLabel: "Feb 2026" }),
    row({ runId: "mar-2", date: "2026-03-18", groupKey: "2026-03", groupLabel: "Mar 2026" }),
  ];

  it("buckets by month, newest month first", () => {
    const groups = groupExplorerRows(rows, "month");
    expect(groups.map((g) => g.key)).toEqual(["2026-03", "2026-02"]);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].label).toBe("Mar 2026");
  });

  it("collapses to a single group when grouping is off", () => {
    const groups = groupExplorerRows(rows, "none");
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(3);
  });

  it("returns no groups for no rows", () => {
    expect(groupExplorerRows([], "month")).toEqual([]);
  });
});

describe("month keys", () => {
  it("derives a sortable key from a date", () => {
    expect(monthKeyFromDate("2026-03-18T00:00:00.000Z")).toBe("2026-03");
  });

  it("renders a key back to a readable label", () => {
    expect(monthLabelFromKey("2026-03")).toBe("Mar 2026");
  });

  // Lexical ordering on the key has to match chronological ordering, which is the
  // whole reason the key is zero-padded.
  it("keeps single-digit months sortable", () => {
    expect(monthKeyFromDate("2026-09-01")).toBe("2026-09");
    expect(["2026-10", "2026-09"].sort()).toEqual(["2026-09", "2026-10"]);
  });
});
