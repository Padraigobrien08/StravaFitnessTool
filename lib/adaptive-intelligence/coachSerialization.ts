import type { AdaptiveIntelligenceSnapshot } from "./types";
import { buildAttributionNarrative } from "@/lib/driver-attribution";

export function serializeAdaptiveIntelligenceForCoach(
  snap: AdaptiveIntelligenceSnapshot,
  topic?: "adaptation" | "readiness" | "taper" | "outcomes" | "history" | "fatigue" | "all",
): string {
  const sections: string[] = [];

  if (!topic || topic === "all" || topic === "adaptation") {
    if (snap.recentlyLearned.length) {
      sections.push("## Recently learned\n" + snap.recentlyLearned.map((l) => `- ${l}`).join("\n"));
    }
    if (snap.adaptationSignals.length) {
      sections.push(
        "## Adaptation signals\n" +
          snap.adaptationSignals
            .slice(0, 6)
            .map((s) => `- ${s.statement} (${s.confidence}, ${s.stability})`)
            .join("\n"),
      );
    }
  }

  if (!topic || topic === "all" || topic === "readiness" || topic === "fatigue") {
    sections.push(buildAttributionNarrative(snap.attribution.readiness));
    sections.push(buildAttributionNarrative(snap.attribution.fatigue));
  }

  if (!topic || topic === "all" || topic === "outcomes") {
    const outcomes = snap.recommendationOutcomes.filter((o) => o.evaluatedAt);
    if (outcomes.length) {
      sections.push(
        "## Recommendation outcomes\n" +
          outcomes
            .slice(0, 5)
            .map((o) => `- [${o.evaluation}] ${o.recommendation.slice(0, 100)}`)
            .join("\n"),
      );
    }
  }

  if (!topic || topic === "all" || topic === "history") {
    if (snap.longitudinalComparisons.length) {
      sections.push(
        "## Longitudinal comparisons\n" +
          snap.longitudinalComparisons.map((c) => `- ${c.title}: ${c.summary}`).join("\n"),
      );
    }
  }

  if (!topic || topic === "all" || topic === "taper") {
    const taper = snap.adaptationSignals.filter(
      (s) => s.category === "recovery" || /taper/i.test(s.statement),
    );
    if (taper.length) {
      sections.push(
        "## Taper / recovery patterns\n" + taper.map((s) => `- ${s.statement}`).join("\n"),
      );
    }
  }

  if (snap.recentSessions.length && (!topic || topic === "all")) {
    sections.push(
      "## Recent session execution\n" +
        snap.recentSessions
          .slice(0, 3)
          .map((s) => `- ${s.narrative}`)
          .join("\n"),
    );
  }

  return sections.filter(Boolean).join("\n\n");
}
