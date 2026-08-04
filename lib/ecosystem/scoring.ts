import { format, parseISO } from "date-fns";
import type {
  EcosystemScores,
  InterferenceFlag,
  NormalizedActivity,
  TrainingSupportSignal,
} from "./types";
import { isAerobicSupportModality } from "./modality";
import { inWindow, isQualityRun } from "./aggregates";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function scoreAerobicSupport(
  activities: NormalizedActivity[],
  runKm28: number,
): { score: number; signals: TrainingSupportSignal[] } {
  const aerobic = activities.filter(
    (a) =>
      isAerobicSupportModality(a.modality) &&
      inWindow(a.startDate, 28) &&
      a.perceivedIntensity !== "high",
  );
  const bikeMin = aerobic
    .filter((a) => a.modality === "bike")
    .reduce((s, a) => s + a.movingTimeSec / 60, 0);
  const swimMin = aerobic
    .filter((a) => a.modality === "swim")
    .reduce((s, a) => s + a.movingTimeSec / 60, 0);
  const minutes = aerobic.reduce((s, a) => s + a.movingTimeSec / 60, 0);
  const sessions = aerobic.length;
  let score = 0;
  if (sessions >= 2) score += 30;
  if (minutes >= 90) score += 35;
  if (runKm28 > 0 && minutes >= 60) score += 15;
  if (bikeMin >= 60 || swimMin >= 45) score += 20;

  const signals: TrainingSupportSignal[] = [];
  if (sessions > 0) {
    const parts: string[] = [];
    if (bikeMin > 0) parts.push(`${Math.round(bikeMin)} min cycling`);
    if (swimMin > 0) parts.push(`${Math.round(swimMin)} min swim`);
    signals.push({
      id: "aerobic-support",
      dimension: "aerobic_support",
      label:
        score >= 60
          ? "Cross-training added aerobic support without extra run impact"
          : "Some aerobic cross-training present",
      trend: score >= 50 ? "positive" : "neutral",
      evidence: [
        `${sessions} low-moderate aerobic sessions in 28d`,
        parts.length ? parts.join("; ") : `${Math.round(minutes)} total minutes`,
      ],
      confidence: sessions >= 3 ? "medium" : "low",
      limitations: [
        "Not run-equivalent mileage, duration and modality only.",
        "Does not directly adjust race predictions.",
      ],
      directness: "supporting_context",
    });
  }
  return { score: clamp(score, 0, 100), signals };
}

export function scoreStrength(activities: NormalizedActivity[]): {
  score: number;
  signals: TrainingSupportSignal[];
} {
  const strength = activities.filter((a) => a.modality === "strength" && inWindow(a.startDate, 14));
  const count = strength.length;
  let score = count === 0 ? 15 : count === 1 ? 45 : count >= 2 ? 75 : 50;
  if (count >= 3) score = 85;
  const weeksWith = new Set(strength.map((s) => format(parseISO(s.startDate), "yyyy-'W'ww"))).size;

  return {
    score: clamp(score, 0, 100),
    signals:
      count > 0
        ? [
            {
              id: "strength-support",
              dimension: "strength",
              label:
                count >= 2
                  ? `Strength training consistent (${weeksWith} weeks with sessions)`
                  : "Strength support emerging",
              trend: count >= 2 ? "positive" : "neutral",
              evidence: [
                `${count} WeightTraining sessions in 14 days`,
                ...strength
                  .slice(-2)
                  .map((s) => `${format(parseISO(s.startDate), "d MMM")}: ${s.name}`),
              ],
              confidence: count >= 2 ? "medium" : "low",
              limitations: [
                "Strava lacks set/rep/load: fatigue estimated from timing and duration.",
              ],
              directness: "supporting_context",
            },
          ]
        : [],
  };
}

export function scoreMobility(
  activities: NormalizedActivity[],
  runKm28: number,
): { score: number; signals: TrainingSupportSignal[] } {
  const mob = activities.filter(
    (a) => (a.modality === "mobility" || a.modality === "recovery") && inWindow(a.startDate, 14),
  );
  const count = mob.length;
  let score = count === 0 ? 20 : count === 1 ? 50 : count >= 2 ? 78 : 55;
  if (count >= 4) score = 90;
  if (runKm28 > 50 && count < 2) score = Math.min(score, 40);

  return {
    score: clamp(score, 0, 100),
    signals: [
      {
        id: count >= 2 ? "mobility-support" : "mobility-low",
        dimension: "mobility",
        label:
          count >= 2
            ? "Mobility/recovery movement is consistent"
            : "Mobility work sparse relative to running load",
        trend: count >= 2 ? "positive" : "warning",
        evidence: [
          count > 0
            ? `${count} mobility/recovery sessions in 14 days`
            : "No yoga, pilates, PT, or walks logged in 14 days",
          runKm28 > 0 ? `~${Math.round(runKm28)} km run volume (28d)` : "",
        ].filter(Boolean),
        confidence: count >= 2 ? "medium" : "low",
        limitations: ["Session quality inferred from sport_type only."],
        directness: "recovery_context",
      },
    ],
  };
}

export function scoreRecoveryBehavior(
  activities: NormalizedActivity[],
  interference: InterferenceFlag[],
): { score: number; signals: TrainingSupportSignal[] } {
  const hardRuns = activities.filter((a) => isQualityRun(a) && inWindow(a.startDate, 21));
  let positive = 0;
  let opportunities = 0;
  for (const run of hardRuns) {
    const runTime = parseISO(run.startDate).getTime();
    const after = activities.filter((a) => {
      const h = (parseISO(a.startDate).getTime() - runTime) / 3600000;
      return (
        h > 0 &&
        h <= 48 &&
        (a.modality === "mobility" ||
          a.modality === "recovery" ||
          (isAerobicSupportModality(a.modality) && a.perceivedIntensity === "low"))
      );
    });
    opportunities++;
    if (after.length > 0) positive++;
  }

  const score =
    opportunities === 0 ? 50 : clamp(Math.round((positive / opportunities) * 100), 0, 100);

  const signals: TrainingSupportSignal[] = [];
  if (opportunities > 0 && positive / opportunities >= 0.5) {
    signals.push({
      id: "recovery-behavior",
      dimension: "recovery_behavior",
      label: `Easy movement followed ${positive} of your last ${opportunities} hard sessions`,
      trend: "positive",
      evidence: [`${positive}/${opportunities} within 48h after key runs`],
      confidence: opportunities >= 3 ? "medium" : "low",
      limitations: ["Cannot verify intent beyond sport_type."],
      directness: "recovery_context",
    });
  }

  const near = interference.filter((f) => f.kind === "near_quality_run" && f.severity !== "low");
  if (near.length > 0) {
    signals.push({
      id: "recovery-interference",
      dimension: "recovery_behavior",
      label: "HIIT or hard gym close to quality run days",
      trend: "warning",
      evidence: near.slice(0, 2).map((f) => f.message),
      confidence: "medium",
      limitations: ["Timing from start_date only."],
      directness: "fatigue_context",
    });
  }

  return { score, signals };
}

export function scoreInterferenceRisk(flags: InterferenceFlag[]): number {
  if (flags.length === 0) return 10;
  const high = flags.filter((f) => f.severity === "high").length;
  const med = flags.filter((f) => f.severity === "medium").length;
  return clamp(20 + high * 28 + med * 14 + flags.length * 4, 0, 100);
}

export function scoreDurability(
  strengthScore: number,
  mobilityScore: number,
  runKm28: number,
  fatigueNote: string | null,
): { score: number; signals: TrainingSupportSignal[] } {
  let adj = strengthScore * 0.55 + mobilityScore * 0.45;
  if (runKm28 > 55 && strengthScore < 50) adj -= 15;
  if (fatigueNote) adj -= 5;
  const score = clamp(Math.round(adj), 0, 100);
  return {
    score,
    signals: [
      {
        id: "durability",
        dimension: "durability",
        label:
          score >= 65
            ? "Durability support aligns with run load"
            : "Run volume increased while strength/mobility support remained low",
        trend: score >= 60 ? "positive" : score >= 40 ? "neutral" : "warning",
        evidence: [
          `28d run ~${Math.round(runKm28)} km`,
          `Strength ${strengthScore}, mobility ${mobilityScore}`,
        ],
        confidence: "medium",
        limitations: ["Training sustainability framing, not injury assessment."],
        directness: "supporting_context",
      },
    ],
  };
}

export function scoreModalityBalance(
  runPct: number,
  nonRunSessions: number,
): { score: number; signals: TrainingSupportSignal[] } {
  let score = 70;
  if (runPct > 90 && nonRunSessions < 2) score = 45;
  if (runPct > 85 && nonRunSessions < 4) score = 55;
  if (runPct >= 50 && runPct <= 80 && nonRunSessions >= 4) score = 78;

  const signals: TrainingSupportSignal[] = [];
  if (runPct > 88) {
    signals.push({
      id: "modality-balance",
      dimension: "modality_balance",
      label: "This block is run-dominant with limited cross-training support",
      trend: "neutral",
      evidence: [
        `${Math.round(runPct)}% of sessions are runs`,
        `${nonRunSessions} non-run sessions in window`,
      ],
      confidence: "medium",
      limitations: ["Balance is session-count based, not physiological load."],
      directness: "supporting_context",
    });
  }
  return { score: clamp(score, 0, 100), signals };
}

export function computeEcosystemScores(
  activities: NormalizedActivity[],
  interferenceFlags: InterferenceFlag[],
  runKm28: number,
  runSessionPct: number,
  nonRunSessions28: number,
): {
  scores: EcosystemScores;
  supportSignals: TrainingSupportSignal[];
  fatigueContext: string | null;
} {
  const aerobic = scoreAerobicSupport(activities, runKm28);
  const strength = scoreStrength(activities);
  const mobility = scoreMobility(activities, runKm28);
  const recovery = scoreRecoveryBehavior(activities, interferenceFlags);
  const interferenceRisk = scoreInterferenceRisk(interferenceFlags);
  const fatigueContext =
    interferenceRisk >= 50
      ? "Non-run intensity near key runs could increase fatigue beyond run TSB."
      : null;
  const durability = scoreDurability(strength.score, mobility.score, runKm28, fatigueContext);
  const balance = scoreModalityBalance(runSessionPct, nonRunSessions28);

  return {
    scores: {
      aerobicSupport: aerobic.score,
      strengthSupport: strength.score,
      mobilitySupport: mobility.score,
      recoveryBehavior: recovery.score,
      interferenceRisk,
      durabilitySupport: durability.score,
      modalityBalance: balance.score,
    },
    supportSignals: [
      ...aerobic.signals,
      ...strength.signals,
      ...mobility.signals,
      ...recovery.signals,
      ...durability.signals,
      ...balance.signals,
    ],
    fatigueContext,
  };
}
