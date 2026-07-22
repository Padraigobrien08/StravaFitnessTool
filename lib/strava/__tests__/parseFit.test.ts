import { describe, expect, it } from "vitest";
import { gzip } from "pako";
import { decompressFitBuffer, matchFitFileToActivityId } from "../parseFit";

describe("decompressFitBuffer", () => {
  // Strava exports FIT files gzipped (.fit.gz); the decompressor must inflate
  // them and pass raw .fit bytes through untouched. Guards the pako dependency.
  it("inflates gzip-compressed bytes back to the original", () => {
    const original = new Uint8Array(Array.from({ length: 256 }, (_, i) => (i * 7) % 256));
    const compressed = gzip(original);
    expect(compressed[0]).toBe(0x1f);
    expect(compressed[1]).toBe(0x8b);

    const result = decompressFitBuffer(compressed.buffer);
    expect(Array.from(result)).toEqual(Array.from(original));
  });

  it("passes uncompressed bytes through unchanged", () => {
    const raw = new Uint8Array([0x0e, 0x10, 0x2e, 0x46, 0x49, 0x54]); // ".FIT" header, no gzip magic
    const result = decompressFitBuffer(raw.buffer);
    expect(Array.from(result)).toEqual(Array.from(raw));
  });
});

describe("matchFitFileToActivityId", () => {
  const map = new Map([
    ["18438355701", "activities/19543214110.fit.gz"],
    ["18415960522", "activities/19520593212.fit.gz"],
  ]);

  it("matches by basename from activities path", () => {
    expect(matchFitFileToActivityId("export_105352925/activities/19543214110.fit.gz", map)).toBe(
      "18438355701",
    );
  });

  it("matches when only filename is provided", () => {
    expect(matchFitFileToActivityId("19520593212.fit.gz", map)).toBe("18415960522");
  });

  it("returns null for unrelated files", () => {
    expect(matchFitFileToActivityId("activities/99999999.fit.gz", map)).toBe(null);
  });
});
