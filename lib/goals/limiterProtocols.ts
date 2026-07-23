import { formatDuration } from "@/lib/utils";
import { buildRaceForecastInput } from "@/lib/forecasting-v2/buildInput";
import { computeForecastSensitivity } from "@/lib/forecasting-v2/sensitivity";
import type { CapabilityAxisKey } from "@/lib/analytics/capabilityRadar";
import type { DashboardInsights } from "@/lib/analytics";
import type { RaceGoal } from "@/lib/analytics/readiness";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { computeGoalScenarios } from "./goalScenarios";

/**
 * T2 — Per-limiter protocols (Pillar 3).
 *
 * Turns the capability radar's diagnosed limiter (T1) into a training
 * prescription with a *predicted, probabilistic* outcome, then hands it to the
 * recommendation-outcomes log so the loop closes: diagnosis → prescription →
 * predicted → measured.
 *
 * Nothing here is invented: the protocol is a fixed block keyed to the limiter,
 * and its projected time + probability come straight from `computeGoalScenarios`
 * (which perturbs the forecast levers and re-runs the model). We only *join* the
 * limiter to the scenario lever that addresses it, and corroborate with the
 * forecast sensitivity (leverage per lever).
 */

/** A goal-scenario lever id (see goalScenarios.ts). */
type ScenarioLeverId = "volume" | "quality" | "full-block";
/** A forecast sensitivity lever id (see sensitivity.ts). */
type SensitivityLeverId = "volume" | "quality" | "long_run";

export interface LimiterProtocol {
  title: string;
  focus: string;
  weeks: number;
  sessionsPerWeek: number;
  description: string;
}

interface ProtocolSpec extends LimiterProtocol {
  scenarioId: ScenarioLeverId;
  sensitivityId: SensitivityLeverId;
}

const PROTOCOL_LIBRARY: Record<CapabilityAxisKey, ProtocolSpec> = {
  top_end_speed: {
    title: "VO₂ / speed block",
    focus: "Top-end speed",
    weeks: 6,
    sessionsPerWeek: 2,
    description:
      "Weekly strides plus a VO₂ interval session (e.g. 5–6 × 3 min hard) to lift your ceiling.",
    scenarioId: "quality",
    sensitivityId: "quality",
  },
  threshold: {
    title: "Threshold block",
    focus: "Lactate threshold",
    weeks: 6,
    sessionsPerWeek: 2,
    description:
      "Two quality sessions/week of tempo and cruise intervals to raise the pace you can hold.",
    scenarioId: "quality",
    sensitivityId: "quality",
  },
  aerobic_base: {
    title: "Aerobic base block",
    focus: "Aerobic base",
    weeks: 8,
    sessionsPerWeek: 5,
    description: "Build easy volume ~12% with mostly aerobic running to deepen the engine.",
    scenarioId: "volume",
    sensitivityId: "volume",
  },
  durability: {
    title: "Long-run / durability block",
    focus: "Durability",
    weeks: 8,
    sessionsPerWeek: 1,
    description:
      "Progressive long runs (with late-run pace pickups) plus supporting volume to hold form deep into the race.",
    scenarioId: "full-block",
    sensitivityId: "long_run",
  },
  economy: {
    title: "Economy block",
    focus: "Running economy",
    weeks: 6,
    sessionsPerWeek: 3,
    description: "Strides, hill sprints, and cadence/form work on a steady aerobic base.",
    scenarioId: "quality",
    sensitivityId: "quality",
  },
  consistency: {
    title: "Consistency block",
    focus: "Consistency",
    weeks: 4,
    sessionsPerWeek: 4,
    description: "Lock in a repeatable weekly rhythm — frequency before intensity.",
    scenarioId: "volume",
    sensitivityId: "volume",
  },
};

export interface LimiterProtocolResult {
  available: boolean;
  limiter: { key: CapabilityAxisKey; label: string; score: number } | null;
  protocol: LimiterProtocol | null;
  goalDistanceLabel: string | null;
  leverSummary: string | null;
  baselineTimeLabel: string | null;
  projectedTimeLabel: string | null;
  /** Seconds faster than the baseline projection (positive = improvement). */
  projectedGainSec: number | null;
  probabilityPct: number | null;
  targetLabel: string | null;
  /** Sustained weekly volume the protocol's lever implies (km) — for outcome tracking. */
  targetWeeklyKm: number | null;
  rationale: string[];
  evidence: string[];
  limitations: string[];
}

function unavailable(reason: string, limiterLabel?: string): LimiterProtocolResult {
  return {
    available: false,
    limiter: null,
    protocol: null,
    goalDistanceLabel: null,
    leverSummary: null,
    baselineTimeLabel: null,
    projectedTimeLabel: null,
    projectedGainSec: null,
    probabilityPct: null,
    targetLabel: null,
    targetWeeklyKm: null,
    rationale: [],
    evidence: [],
    limitations: [reason, ...(limiterLabel ? [] : [])],
  };
}

export function buildLimiterProtocol(opts: {
  analytics: DashboardInsights;
  goal: RaceGoal | null;
  runs?: RunActivity[];
  fitDetails?: FitRunDetail[];
}): LimiterProtocolResult {
  const radar = opts.analytics.capabilityRadar;
  if (!radar.available) {
    return unavailable(
      "Not enough history to diagnose a limiter yet — the capability radar isn't available.",
    );
  }
  if (!radar.biggestLimiter) {
    return unavailable(
      opts.goal
        ? "No single limiter stands out — your capabilities are well-rounded for this race."
        : "Set a race goal to diagnose the limiter that matters most and get a targeted protocol.",
    );
  }

  const limiter = radar.biggestLimiter;
  const spec = PROTOCOL_LIBRARY[limiter.key];
  const protocol: LimiterProtocol = {
    title: spec.title,
    focus: spec.focus,
    weeks: spec.weeks,
    sessionsPerWeek: spec.sessionsPerWeek,
    description: spec.description,
  };

  const base = {
    available: true,
    limiter: { key: limiter.key, label: limiter.label, score: limiter.score },
    protocol,
    goalDistanceLabel: radar.goalDistanceLabel,
    leverSummary: null as string | null,
    baselineTimeLabel: null as string | null,
    projectedTimeLabel: null as string | null,
    projectedGainSec: null as number | null,
    probabilityPct: null as number | null,
    targetLabel: null as string | null,
    targetWeeklyKm: null as number | null,
    rationale: [
      `Your biggest limiter for the ${radar.goalDistanceLabel} is ${limiter.label} (${limiter.score}/100) — ${limiter.evidence}`,
      `${protocol.title}: ${protocol.description}`,
    ],
    evidence: [] as string[],
    limitations: [] as string[],
  };

  const input = buildRaceForecastInput({
    analytics: opts.analytics,
    goal: opts.goal,
    runs: opts.runs,
    fitDetails: opts.fitDetails,
  });
  if (!input || input.efforts.length === 0) {
    return {
      ...base,
      limitations: ["Not enough race-quality efforts to project this protocol's time gain yet."],
    };
  }

  const scenarios = computeGoalScenarios(input);
  const sensitivity = computeForecastSensitivity(input);
  const chosen =
    scenarios.scenarios.find((s) => s.id === spec.scenarioId) ??
    scenarios.scenarios.find((s) => s.id === "full-block") ??
    scenarios.scenarios[0];

  if (!chosen) {
    return { ...base, limitations: scenarios.limitations };
  }

  const projectedGainSec = Math.max(0, scenarios.baselineTimeSec - chosen.projectedTimeSec);
  const sens = sensitivity.find((f) => f.id === spec.sensitivityId);

  const evidence: string[] = [
    `Projected ${chosen.projectedTimeLabel} after the block — ${projectedGainSec > 0 ? `~${projectedGainSec}s faster than` : "level with"} your ${formatDuration(scenarios.baselineTimeSec)} baseline.`,
  ];
  if (chosen.probabilityPct != null && scenarios.targetLabel) {
    evidence.push(
      `Chance of hitting ${scenarios.targetLabel}: ${scenarios.baselineProbabilityPct ?? "—"}% → ${chosen.probabilityPct}% with this block.`,
    );
  }
  if (sens && sens.direction === "faster") {
    evidence.push(
      `Forecast sensitivity agrees: ${sens.label} (${sens.change}) is worth ~${Math.abs(sens.deltaSec)}s.`,
    );
  }

  const limitations = [...scenarios.limitations];
  if (spec.scenarioId === "quality") {
    limitations.push(
      "Adherence is tracked via sustained training volume, an imperfect proxy for quality-block execution.",
    );
  }

  return {
    ...base,
    leverSummary: chosen.leverSummary,
    baselineTimeLabel: formatDuration(scenarios.baselineTimeSec),
    projectedTimeLabel: chosen.projectedTimeLabel,
    projectedGainSec,
    probabilityPct: chosen.probabilityPct,
    targetLabel: scenarios.targetLabel,
    targetWeeklyKm: chosen.targetWeeklyKm,
    rationale: base.rationale,
    evidence,
    limitations,
  };
}
