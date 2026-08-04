import type { DashboardInsights } from "@/lib/analytics";
import { createBelief } from "./beliefUtils";
import type { AthleteBelief } from "./types";

export function inferModalityInteractions(analytics: DashboardInsights): AthleteBelief[] {
  const out: AthleteBelief[] = [];
  const eco = analytics.trainingEcosystem;

  if (eco.scores.interferenceRisk >= 50) {
    const flags = eco.interferenceFlags.filter((f) => f.severity !== "low").slice(0, 2);
    out.push(
      createBelief({
        id: "mod-interference",
        category: "modality",
        statement:
          "Hard non-run work clustered near quality runs may compress run freshness and readiness.",
        evidence: [
          `Interference risk score ${eco.scores.interferenceRisk}`,
          ...flags.map((f) => f.message),
        ],
        confidence: eco.scores.interferenceRisk >= 65 ? "medium" : "low",
        recommendedUse:
          "Separate hard cross-training from key run sessions by at least 24–48 hours.",
      }),
    );
  }

  if (eco.scores.strengthSupport >= 55 && eco.totalContext.last28Days.strengthSessions >= 2) {
    out.push(
      createBelief({
        id: "mod-strength-support",
        category: "modality",
        statement:
          "Regular strength support appears consistent without overload signal: durability may benefit.",
        evidence: [
          `${eco.totalContext.last28Days.strengthSessions} strength sessions (28d)`,
          `Strength support score ${eco.scores.strengthSupport}`,
        ],
        confidence: "low",
        counterEvidence:
          eco.scores.interferenceRisk >= 50 ? ["Interference risk elevated: timing matters"] : [],
        recommendedUse: "Keep strength moderate in build phases; reduce before race week.",
      }),
    );
  }

  if (eco.archetype.archetype !== "unknown") {
    out.push(
      createBelief({
        id: "mod-archetype",
        category: "modality",
        statement: `${eco.archetype.label}: training mix should be interpreted through this lens.`,
        evidence: eco.archetype.evidence.slice(0, 3),
        confidence: eco.archetype.confidence,
        recommendedUse: eco.archetype.coachingNotes[0] ?? "Balance modalities around run priority.",
      }),
    );
  }

  return out;
}
