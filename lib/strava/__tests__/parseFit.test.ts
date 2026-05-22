import { describe, expect, it } from "vitest";
import { matchFitFileToActivityId } from "../parseFit";

describe("matchFitFileToActivityId", () => {
  const map = new Map([
    ["18438355701", "activities/19543214110.fit.gz"],
    ["18415960522", "activities/19520593212.fit.gz"],
  ]);

  it("matches by basename from activities path", () => {
    expect(
      matchFitFileToActivityId(
        "export_105352925/activities/19543214110.fit.gz",
        map
      )
    ).toBe("18438355701");
  });

  it("matches when only filename is provided", () => {
    expect(matchFitFileToActivityId("19520593212.fit.gz", map)).toBe(
      "18415960522"
    );
  });

  it("returns null for unrelated files", () => {
    expect(matchFitFileToActivityId("activities/99999999.fit.gz", map)).toBe(
      null
    );
  });
});
