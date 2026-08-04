import { allBeliefs } from "./beliefUtils";
import type { AthleteBelief, AthleteMemoryProfile } from "./types";

export function serializeAthleteMemoryForLLM(
  profile: AthleteMemoryProfile,
  beliefs?: AthleteBelief[],
): string {
  const list = beliefs ?? allBeliefs(profile).slice(0, 8);
  if (list.length === 0) {
    return "No structured athlete memory yet: rely on current analytics only.";
  }

  const sections = list.map((b) => {
    const lines = [
      `- [${b.category}] ${b.statement}`,
      `  Confidence: ${b.confidence} · Stability: ${b.stability}`,
      `  Use: ${b.recommendedUse}`,
    ];
    if (b.evidence.length) {
      lines.push(`  Evidence: ${b.evidence.slice(0, 3).join("; ")}`);
    }
    if (b.counterEvidence.length) {
      lines.push(`  Counter: ${b.counterEvidence.slice(0, 2).join("; ")}`);
    }
    return lines.join("\n");
  });

  return `## Athlete memory (structured beliefs)\n${sections.join("\n\n")}`;
}

export function serializeMemoryForCoachAnswer(
  profile: AthleteMemoryProfile,
  topic?: "fatigue" | "adaptation" | "pacing" | "taper" | "modality" | "all",
): string {
  let beliefs = allBeliefs(profile);
  if (topic && topic !== "all") {
    beliefs = beliefs.filter((b) => b.category === topic);
  }
  if (beliefs.length === 0) {
    return "I don't have enough repeated evidence to state a reliable pattern yet. More consistent training history will sharpen this.";
  }

  const parts = beliefs
    .slice(0, 6)
    .map(
      (b) =>
        `**${b.statement}** (${b.confidence} confidence, ${b.stability})\n` +
        `Evidence: ${b.evidence.slice(0, 2).join("; ")}\n` +
        (b.counterEvidence.length ? `Uncertainty: ${b.counterEvidence[0]}` : "") +
        `\nHow to use this: ${b.recommendedUse}`,
    );

  return parts.join("\n\n");
}

export function profileToJson(profile: AthleteMemoryProfile): string {
  return JSON.stringify(profile, null, 2);
}
