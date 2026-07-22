import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseActivitiesCsv } from "../parseActivities";

const exportPath = path.join(process.cwd(), "export_105352925", "activities.csv");
// The sample export is a git-ignored local fixture (real Strava PII), so these
// tests only run when it's present — e.g. locally, not in CI.
const hasExport = existsSync(exportPath);

describe("parseActivitiesCsv", () => {
  it.skipIf(!hasExport)("parses 57 runs from sample export", () => {
    const csv = readFileSync(exportPath, "utf-8");
    const { runs } = parseActivitiesCsv(csv);
    expect(runs.length).toBe(57);
  });

  it.skipIf(!hasExport)("normalizes longest run distance to meters", () => {
    const csv = readFileSync(exportPath, "utf-8");
    const { runs } = parseActivitiesCsv(csv);
    const longest = runs.reduce((a, b) => (a.distanceM > b.distanceM ? a : b));
    expect(longest.distanceM).toBeGreaterThan(20000);
    expect(longest.distanceM).toBeLessThan(21000);
  });

  // Regression: a missing/garbage date must be dropped at parse time. If it
  // survives, date-fns `format(parseISO(...))` throws "Invalid time value" in
  // a render path above the error boundary and white-screens the whole app.
  it("drops rows with a missing or unparseable date", () => {
    const csv = [
      "Activity ID,Activity Date,Activity Name,Activity Type,Distance",
      "1,2024-01-15 08:00:00,Good Run,Run,5",
      "2,,Empty Date,Run,5",
      "3,not-a-date,Garbage Date,Run,5",
    ].join("\n");

    const { runs, allActivities } = parseActivitiesCsv(csv);

    expect(runs.length).toBe(1);
    expect(allActivities.length).toBe(1);
    expect(runs[0].name).toBe("Good Run");
    // The surviving date is always a valid, formattable ISO string.
    expect(Number.isNaN(new Date(runs[0].date).getTime())).toBe(false);
  });
});
