import { describe, it, expect } from "vitest";
import { formatWorkoutTitle, semanticSearchTokens } from "../formatWorkoutName";

describe("formatWorkoutTitle", () => {
  it("parses structured interval-style titles", () => {
    const f = formatWorkoutTitle("1@6:00, 40:00@5:15, 1@6:00");
    expect(f.isStructured).toBe(true);
    expect(f.segments.length).toBe(3);
    expect(f.segments[0].label).toBe("Warm-up");
    expect(["Main set", "Interval block"]).toContain(f.segments[1].label);
    expect(f.segments[2].label).toBe("Cool-down");
  });

  it("parses arrow warmup/cooldown titles", () => {
    const f = formatWorkoutTitle("⬆️, 4@4:50, 3@5:00, ⬇️");
    expect(f.isStructured).toBe(true);
    expect(f.segments[0].label).toBe("Warm-up");
    expect(f.segments.at(-1)?.label).toBe("Cool-down");
  });

  it("leaves simple titles unchanged", () => {
    const f = formatWorkoutTitle("Morning easy run");
    expect(f.isStructured).toBe(false);
    expect(f.primary).toBe("Morning easy run");
  });
});

describe("semanticSearchTokens", () => {
  it("maps tempo query to type", () => {
    const t = semanticSearchTokens("tempo threshold");
    expect(t.types).toContain("tempo");
  });

  it("maps pr query to marker", () => {
    const t = semanticSearchTokens("pr run");
    expect(t.markers).toContain("pr");
  });
});
