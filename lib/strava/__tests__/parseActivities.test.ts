import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseActivitiesCsv } from "../parseActivities";

const exportPath = path.join(
  process.cwd(),
  "export_105352925",
  "activities.csv"
);

describe("parseActivitiesCsv", () => {
  it("parses 57 runs from sample export", () => {
    const csv = readFileSync(exportPath, "utf-8");
    const { runs } = parseActivitiesCsv(csv);
    expect(runs.length).toBe(57);
  });

  it("normalizes longest run distance to meters", () => {
    const csv = readFileSync(exportPath, "utf-8");
    const { runs } = parseActivitiesCsv(csv);
    const longest = runs.reduce((a, b) =>
      a.distanceM > b.distanceM ? a : b
    );
    expect(longest.distanceM).toBeGreaterThan(20000);
    expect(longest.distanceM).toBeLessThan(21000);
  });
});
