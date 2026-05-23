import type { DashboardInsights } from "@/lib/analytics";

export interface MemorySnippet {
  id: string;
  label: string;
  text: string;
  confidence: "low" | "medium" | "high";
  era?: string;
  stability?: "emerging" | "stable" | "weakening";
}

export function buildMemorySnippets(
  analytics: DashboardInsights | null
): MemorySnippet[] {
  if (!analytics) return [];

  const out: MemorySnippet[] = [];

  if (analytics.bestBlock) {
    out.push({
      id: "best-block",
      label: "Strongest volume block",
      text: `Historically, your highest 4-week volume was ${analytics.bestBlock.label} (${analytics.bestBlock.distanceKm} km, longest ${analytics.bestBlock.longestRunKm} km).`,
      confidence: analytics.dataConfidence,
      era: analytics.bestBlock.label,
    });
  }

  if (analytics.intensityAdvice.recommendations[0]) {
    out.push({
      id: "intensity",
      label: "Intensity pattern",
      text: analytics.intensityAdvice.recommendations[0],
      confidence:
        analytics.intensityAdvice.status === "insufficient_data"
          ? "low"
          : "medium",
    });
  }

  if (analytics.efficiencyMoM.narrative) {
    out.push({
      id: "efficiency",
      label: "Aerobic efficiency",
      text: analytics.efficiencyMoM.narrative,
      confidence:
        analytics.efficiencyMoM.comparableCount >= 6 ? "medium" : "low",
    });
  }

  const blocks = analytics.trainingBlocks;
  if (blocks.length >= 2) {
    const recent = blocks[blocks.length - 1];
    out.push({
      id: "recent-block",
      label: "Current block",
      text: `Recent training: ${recent.label} — ${recent.distanceKm} km across ${recent.runCount} runs.`,
      confidence: "medium",
      era: "Current",
    });
  }

  const longest = analytics.halfMarathonReadiness.longestRunKm;
  if (analytics.summary.runCount >= 8 && longest > 0 && longest < 18) {
    out.push({
      id: "fade",
      label: "Long-run density",
      text: `Longest recent run ${longest} km — when long-run frequency drops, late-run pace often softens past ~15 km.`,
      confidence: "medium",
    });
  }

  const eco = analytics.trainingEcosystem;
  if (eco.archetype.archetype !== "unknown") {
    out.push({
      id: "archetype",
      label: "Athlete profile",
      text: `${eco.archetype.label}. ${eco.archetype.coachingNotes[0] ?? ""}`,
      confidence: eco.archetype.confidence,
    });
  }

  if (eco.totalContext.last28Days.nonRunSessions > 0) {
    const headline = eco.ecosystemInsights[0]?.title;
    if (headline) {
      out.push({
        id: "ecosystem",
        label: "Training ecosystem",
        text: headline,
        confidence: eco.confidence,
      });
    }
  }

  const prRecent = analytics.prTimeline.filter((p) => p.isNewPr).slice(-1)[0];
  if (prRecent) {
    out.push({
      id: "pr",
      label: "Recent breakthrough",
      text: `New ${prRecent.label} PR — training block before this phase showed ${analytics.consistencyScore.label.toLowerCase()} consistency.`,
      confidence: analytics.dataConfidence,
    });
  }

  return out.slice(0, 8);
}
