import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  IntelligenceDecisionSupport,
  IntelligenceMemoryGrouped,
  IntelligenceSignalBoard,
  IntelligenceStateEvolution,
} from "../intelligence-sections";
import type { IntelligenceSignal } from "@/lib/intelligence/athleteState";
import type { StateEvolutionItem } from "@/lib/intelligence/presentation";

/**
 * The Intelligence surface's renderers.
 *
 * These are presentational, so the assertions are about *editorial* behaviour rather
 * than markup: which signal is promoted to the top, what gets hidden when there is
 * nothing to say, and whether a warning can be crowded out by cheerier news. The
 * Intelligence page is meant to be read before training, so a buried warning is the
 * failure mode that matters.
 *
 * Pure props throughout — no hooks, no mocking.
 */

function signal(overrides: Partial<IntelligenceSignal> = {}): IntelligenceSignal {
  return {
    id: `sig-${Math.abs(hash(JSON.stringify(overrides)))}`,
    type: "Efficiency",
    severity: "neutral",
    text: "Your aerobic efficiency is holding steady.",
    headline: "Efficiency steady",
    evidence: "12 runs analysed",
    confidence: "medium",
    ...overrides,
  };
}

/** Deterministic id source, so fixtures do not depend on ordering luck. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function evolutionItem(overrides: Partial<StateEvolutionItem> = {}): StateEvolutionItem {
  return {
    id: "volume",
    label: "Weekly volume",
    direction: "rising",
    interpretation: "Building steadily",
    trend: "up",
    values: [
      { label: "4w ago", value: 30 },
      { label: "now", value: 42 },
    ],
    ...overrides,
  } as StateEvolutionItem;
}

describe("state evolution", () => {
  // Rendering an empty panel would take vertical space on the most important screen
  // in the app to say nothing.
  it("renders nothing at all when there is no movement to report", () => {
    const { container } = render(<IntelligenceStateEvolution items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names each metric it is tracking", () => {
    render(
      <IntelligenceStateEvolution
        items={[
          evolutionItem({ id: "volume", label: "Weekly volume" }),
          evolutionItem({ id: "freshness", label: "Freshness", trend: "down" }),
        ]}
      />,
    );
    expect(screen.getByText("Weekly volume")).toBeInTheDocument();
    expect(screen.getByText("Freshness")).toBeInTheDocument();
  });

  it.each([["up"], ["down"], ["flat"]])("renders a %s trend without complaint", (trend) => {
    expect(() =>
      render(<IntelligenceStateEvolution items={[evolutionItem({ trend: trend as never })]} />),
    ).not.toThrow();
  });
});

describe("which signal gets promoted", () => {
  it("shows nothing when there are no signals", () => {
    const { container } = render(<IntelligenceSignalBoard signals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Efficiency trend is the deliberate exception: it outranks everything because it
   * is the signal that most often explains the others.
   */
  it("promotes the efficiency trend above a positive signal", () => {
    render(
      <IntelligenceSignalBoard
        signals={[
          signal({ id: "other", severity: "positive", headline: "Positive news" }),
          signal({ id: "eff-trend", headline: "Efficiency improving" }),
        ]}
      />,
    );
    expect(screen.getByText("Efficiency improving")).toBeInTheDocument();
  });

  it("falls back to a positive signal when there is no efficiency trend", () => {
    render(
      <IntelligenceSignalBoard
        signals={[
          signal({ id: "a", severity: "neutral", headline: "Neutral note" }),
          signal({ id: "b", severity: "positive", headline: "Good news" }),
        ]}
      />,
    );
    expect(screen.getByText("Good news")).toBeInTheDocument();
  });

  /**
   * The one that would actually harm someone. Warnings are routed to a watchlist
   * rather than the primary slot, so a board that dropped them would show an athlete
   * only the encouraging half of their data.
   */
  it("still shows a warning even when good news outranks it", () => {
    render(
      <IntelligenceSignalBoard
        signals={[
          signal({ id: "eff-trend", headline: "Efficiency improving" }),
          signal({ id: "warn", severity: "warning", headline: "Fatigue accumulating" }),
        ]}
      />,
    );
    expect(screen.getByText("Efficiency improving")).toBeInTheDocument();
    expect(screen.getByText("Fatigue accumulating")).toBeInTheDocument();
  });

  it("does not repeat the promoted signal further down", () => {
    render(
      <IntelligenceSignalBoard
        signals={[
          signal({ id: "eff-trend", headline: "Efficiency improving" }),
          signal({ id: "b", headline: "Second thing" }),
        ]}
      />,
    );
    expect(screen.getAllByText("Efficiency improving")).toHaveLength(1);
  });

  it("caps the compact variant so it cannot fill the page", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      signal({ id: `s${i}`, headline: `Signal ${i}` }),
    );
    render(<IntelligenceSignalBoard signals={many} compact />);
    const shown = many.filter((s) => screen.queryByText(s.headline) !== null);
    expect(shown.length).toBeLessThanOrEqual(5);
  });

  it("shows the evidence behind a signal rather than the claim alone", () => {
    render(
      <IntelligenceSignalBoard
        signals={[signal({ id: "eff-trend", evidence: "18 runs analysed" })]}
      />,
    );
    expect(screen.getByText(/18 runs analysed/)).toBeInTheDocument();
  });
});

describe("decision support", () => {
  const risk = (text: string) => ({ id: text, text, kind: "risk" as const, domain: "load" });
  const opp = (text: string) => ({
    id: text,
    text,
    kind: "opportunity" as const,
    domain: "load",
  });

  it("surfaces a risk the athlete should act on", () => {
    render(
      <IntelligenceDecisionSupport
        risks={[risk("Hard sessions stacked")]}
        opportunities={[]}
        recommendation="Keep this week easy."
      />,
    );
    expect(screen.getByText(/Hard sessions stacked/)).toBeInTheDocument();
  });

  it("keeps risks and opportunities in separate columns", () => {
    render(
      <IntelligenceDecisionSupport
        risks={[risk("Fatigue rising")]}
        opportunities={[opp("Room for a quality session")]}
        recommendation="Hold steady."
      />,
    );
    expect(screen.getByText(/Fatigue rising/)).toBeInTheDocument();
    expect(screen.getByText(/Room for a quality session/)).toBeInTheDocument();
  });

  /**
   * A multi-sentence recommendation is split into bullets, because the primary action
   * column is scanned rather than read. A single sentence is left whole rather than
   * being turned into a one-item list of fragments.
   */
  it("splits a multi-sentence recommendation into separate actions", () => {
    render(
      <IntelligenceDecisionSupport
        risks={[]}
        opportunities={[]}
        recommendation="Keep Monday easy. Move the tempo to Thursday."
      />,
    );
    expect(screen.getByText(/Keep Monday easy\./)).toBeInTheDocument();
    expect(screen.getByText(/Move the tempo to Thursday\./)).toBeInTheDocument();
  });

  it("leaves a single-sentence recommendation intact", () => {
    render(
      <IntelligenceDecisionSupport
        risks={[]}
        opportunities={[]}
        recommendation="Hold the current volume for another week."
      />,
    );
    expect(screen.getByText(/Hold the current volume for another week\./)).toBeInTheDocument();
  });
});

describe("grouped memory", () => {
  const snippet = (overrides: Record<string, unknown> = {}) => ({
    id: "m1",
    label: "Recovery",
    text: "You respond well to two easy days after a long run",
    confidence: "high" as const,
    stability: "stable" as const,
    ...overrides,
  });

  it("renders nothing when the athlete has no beliefs yet", () => {
    const { container } = render(<IntelligenceMemoryGrouped memory={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows what has been learned about the athlete", () => {
    render(<IntelligenceMemoryGrouped memory={[snippet()]} />);
    expect(
      screen.getByText(/You respond well to two easy days after a long run/),
    ).toBeInTheDocument();
  });

  // Stability is the difference between "we have seen this repeatedly" and "this may
  // be noise", which is exactly what an athlete needs to weigh a claim.
  it("separates stable patterns from emerging ones", () => {
    render(
      <IntelligenceMemoryGrouped
        memory={[
          snippet({ id: "a", text: "Stable claim", stability: "stable" }),
          snippet({ id: "b", text: "Emerging claim", stability: "emerging" }),
        ]}
      />,
    );
    expect(screen.getByText(/Stable patterns/)).toBeInTheDocument();
    expect(screen.getByText(/Emerging patterns/)).toBeInTheDocument();
  });
});
