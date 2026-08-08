import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachMiniContext } from "../coach-mini-context";
import { buildCoachContextSnapshot } from "@/lib/coach/viewModel";
import type { CoachWorkspaceState } from "@/lib/coach/types";

/**
 * The answer-context rail is where the two-surface contradiction was visible: on a
 * live account fifteen days without a run, Home led with DETRAINED while this rail
 * showed "Readiness 67 · Nearly there" from the same analytics.
 *
 * `buildCoachContextSnapshot` now carries a `currencyNote`, and that is unit-tested —
 * but a value that never reaches the screen fixes nothing, which is precisely the
 * failure being corrected. This pins the last step.
 */

vi.mock("@/components/jargon-term", () => ({
  JargonTerm: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

/** Minimal state: the rail reads `snapshot` and `risksAndOpportunities` only. */
function stateWith(currencyNote: string | null): CoachWorkspaceState {
  const snapshot = {
    ...buildCoachContextSnapshot(null, null),
    readinessScore: 67,
    readinessLabel: "Nearly there",
    currentFocus: "Getting back to running",
    currencyNote,
  };
  return { snapshot, risksAndOpportunities: [] } as unknown as CoachWorkspaceState;
}

describe("CoachMiniContext currency note", () => {
  it("shows the gap alongside the readiness score", () => {
    render(
      <CoachMiniContext
        state={stateWith("Measured before 15 days without a run")}
        collapsed={false}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText("67")).toBeInTheDocument();
    expect(screen.getByText(/measured before 15 days without a run/i)).toBeInTheDocument();
  });

  it("shows nothing extra for an athlete who is training", () => {
    render(<CoachMiniContext state={stateWith(null)} collapsed={false} onToggle={() => {}} />);
    expect(screen.getByText("67")).toBeInTheDocument();
    expect(screen.queryByText(/measured before/i)).not.toBeInTheDocument();
  });

  it("renders the note above the score, not below it", () => {
    const { container } = render(
      <CoachMiniContext
        state={stateWith("Measured before 15 days without a run")}
        collapsed={false}
        onToggle={() => {}}
      />,
    );
    const text = container.textContent ?? "";
    // A caveat printed under a number is read after the number has been believed.
    expect(text.indexOf("Measured before")).toBeLessThan(text.indexOf("67"));
  });
});
