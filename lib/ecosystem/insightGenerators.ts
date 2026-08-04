import type {
  AthleteArchetypeResult,
  EcosystemInsight,
  EcosystemScores,
  InterferenceFlag,
  NormalizedActivity,
  TrainingSupportSignal,
} from "./types";
import type { RollingEcosystemSnapshot } from "./types";

export function buildEcosystemInsightList(input: {
  scores: EcosystemScores;
  supportSignals: TrainingSupportSignal[];
  interferenceFlags: InterferenceFlag[];
  activities: NormalizedActivity[];
  archetype: AthleteArchetypeResult;
  rolling28?: RollingEcosystemSnapshot;
}): EcosystemInsight[] {
  const out: EcosystemInsight[] = [];
  const { scores, supportSignals, interferenceFlags, archetype, rolling28 } = input;

  const hiFlags = interferenceFlags.filter((f) => f.severity !== "low" && f.kind !== "race_week");

  if (hiFlags.length > 0) {
    out.push({
      id: "interference",
      category: "interference_risk",
      title: "Interference risk near quality runs",
      severity: hiFlags[0].severity === "high" ? "warning" : "neutral",
      evidence: [hiFlags[0].message, ...hiFlags[0].evidence],
      recommendation:
        "Separate HIIT, CrossFit, or heavy strength from tempo, intervals, and long runs by 24–48h when possible.",
      confidence: hiFlags[0].confidence,
      limitations: ["May interfere with run quality, not a medical assessment."],
      directness: "fatigue_context",
    });
  }

  const cluster = interferenceFlags.find((f) => f.kind === "hybrid_cluster");
  if (cluster) {
    out.push({
      id: "hybrid-cluster",
      category: "hybrid_load",
      title: "Hybrid load concentration",
      severity: "warning",
      evidence: cluster.evidence,
      recommendation:
        archetype.archetype === "hybrid_runner" || archetype.archetype === "strength_endurance"
          ? "Spread gym, HIIT, and quality runs: avoid stacking within 3 days."
          : "Review weekly intensity distribution on Training.",
      confidence: "medium",
      limitations: ["Based on session timing and modality only."],
      directness: "fatigue_context",
    });
  }

  const aerobicSig = supportSignals.find((s) => s.id === "aerobic-support");
  if (aerobicSig && scores.aerobicSupport >= 55) {
    out.push({
      id: "aerobic",
      category: "aerobic_support",
      title: aerobicSig.label,
      severity: "positive",
      evidence: aerobicSig.evidence,
      recommendation:
        archetype.archetype === "triathlete"
          ? "Bike/swim support race aerobic base: keep run specificity for pace work."
          : "Keep cross-training easy-moderate on days adjacent to quality runs.",
      confidence: aerobicSig.confidence,
      limitations: aerobicSig.limitations,
      directness: aerobicSig.directness,
    });
  }

  const strengthSig = supportSignals.find((s) => s.id === "strength-support");
  if (strengthSig) {
    out.push({
      id: "strength",
      category: "strength_support",
      title: strengthSig.label,
      severity: scores.strengthSupport >= 70 ? "positive" : "neutral",
      evidence: strengthSig.evidence,
      recommendation: "Maintain strength 24–48h from key runs; reduce load in race week.",
      confidence: strengthSig.confidence,
      limitations: strengthSig.limitations,
      directness: strengthSig.directness,
    });
  }

  const mobSig = supportSignals.find((s) => s.id === "mobility-low");
  if (mobSig || scores.mobilitySupport < 50) {
    const sig = mobSig ?? supportSignals.find((s) => s.dimension === "mobility");
    out.push({
      id: "mobility",
      category: "mobility_support",
      title: sig?.label ?? "Mobility consistency low",
      severity: "warning",
      evidence: sig?.evidence ?? [],
      recommendation: "Short mobility or easy walks after hard sessions support recovery context.",
      confidence: sig?.confidence ?? "low",
      limitations: sig?.limitations ?? [],
      directness: "recovery_context",
    });
  }

  const recoverySig = supportSignals.find((s) => s.id === "recovery-behavior");
  if (recoverySig) {
    out.push({
      id: "recovery",
      category: "recovery_behavior",
      title: recoverySig.label,
      severity: "positive",
      evidence: recoverySig.evidence,
      confidence: recoverySig.confidence,
      limitations: recoverySig.limitations,
      directness: recoverySig.directness,
    });
  }

  const balanceSig = supportSignals.find((s) => s.id === "modality-balance");
  if (balanceSig) {
    out.push({
      id: "balance",
      category: "modality_balance",
      title: balanceSig.label,
      severity: "neutral",
      evidence: balanceSig.evidence,
      recommendation:
        "Add low-intensity bike, swim, or mobility if building aerobic support without more run volume.",
      confidence: balanceSig.confidence,
      limitations: balanceSig.limitations,
      directness: balanceSig.directness,
    });
  }

  if (rolling28 && rolling28.hiitSessions >= 2 && rolling28.runHardCount >= 2) {
    out.push({
      id: "hi-density",
      category: "hybrid_load",
      title: "High-intensity density in recent block",
      severity: "warning",
      evidence: [
        `${rolling28.hiitSessions} HIIT sessions and ${rolling28.runHardCount} hard runs (28d)`,
      ],
      recommendation: "Am I stacking too much intensity? Review interference panel.",
      confidence: "medium",
      limitations: ["Session counts, not TRIMP or TSS."],
      directness: "fatigue_context",
    });
  }

  return out;
}
