import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachResponseMeta } from "../coach-response-meta";
import type { ParsedCoachResponse } from "@/lib/coach/parseResponse";

/**
 * The meta line is the reply's own account of itself: how confident, grounded in what,
 * and what it could not see. Two ways it used to overstate:
 *
 *  - "Grounded in" was partly derived from regexes over the model's `## Evidence` prose,
 *    so a reply that called no tools could still claim four grounds.
 *  - "medium-high" rendered as "high", because the check was `includes("high")`.
 *
 * Both are decided in `groundingMeta` and unit-tested there. This covers the last step,
 * which is the one that was actually wrong: what a reader ends up seeing.
 */

vi.mock("@/lib/coach/formatText", () => ({ formatCoachText: (s: string) => s }));

const parsed = (over: Partial<ParsedCoachResponse> = {}): ParsedCoachResponse =>
  ({
    summary: "You are on track.",
    // Deliberately stuffed with the words the old regexes keyed on: readiness, tsb,
    // volume, km, tempo, marathon, ecosystem. None may produce a grounding chip.
    evidence: [
      "Readiness 67 and TSB +47 with weekly volume of 38 km",
      "tempo and threshold work before the marathon, plus gym in the ecosystem",
    ],
    confidence: "high",
    limitations: [],
    ...over,
  }) as ParsedCoachResponse;

describe("CoachResponseMeta grounding", () => {
  it("lists the tools that ran", () => {
    render(<CoachResponseMeta parsed={parsed()} toolsUsed={["get_readiness"]} />);
    expect(screen.getByText(/grounded in/i)).toBeInTheDocument();
    expect(screen.getByText("readiness")).toBeInTheDocument();
  });

  it("says no tools were called rather than staying silent", () => {
    render(<CoachResponseMeta parsed={parsed()} toolsUsed={[]} />);
    expect(screen.getByText(/no tools called/i)).toBeInTheDocument();
  });

  // The regression: evidence prose mentioning every keyword must not invent grounds.
  it("cannot be talked into a grounding claim by the answer's own wording", () => {
    render(<CoachResponseMeta parsed={parsed()} toolsUsed={[]} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/grounded in\s*(readiness|volume|sessions|race prep|ecosystem)/i);
  });

  it("claims nothing when there is no record of tool use", () => {
    render(<CoachResponseMeta parsed={parsed()} toolsUsed={undefined} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/grounded in/i);
    // Still renders the rest, so the line does not vanish for older stored threads.
    expect(screen.getByText(/confidence/i)).toBeInTheDocument();
  });
});

describe("CoachResponseMeta confidence", () => {
  it("shows medium-high as itself, not as high", () => {
    render(<CoachResponseMeta parsed={parsed({ confidence: "medium-high" })} toolsUsed={[]} />);
    expect(screen.getByText("medium-high")).toBeInTheDocument();
    expect(screen.queryByText(/^high$/)).not.toBeInTheDocument();
  });

  it("still shows a genuinely high confidence", () => {
    render(<CoachResponseMeta parsed={parsed({ confidence: "high" })} toolsUsed={[]} />);
    expect(screen.getByText("high")).toBeInTheDocument();
  });
});
