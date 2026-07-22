import type { CausalExplanation } from "./types";

export function buildCausalNarrative(explanation: CausalExplanation): string {
  const lines: string[] = [explanation.summary];

  for (const d of explanation.likelyDrivers.slice(0, 3)) {
    const ev = d.evidence[0] ? ` (${d.evidence[0]})` : "";
    lines.push(`• ${d.driver} — likely ${d.impact} impact, ${d.confidence} confidence${ev}`);
  }

  if (explanation.uncertainties.length) {
    lines.push(`Uncertainty: ${explanation.uncertainties.slice(0, 2).join("; ")}`);
  }

  return lines.join("\n");
}
