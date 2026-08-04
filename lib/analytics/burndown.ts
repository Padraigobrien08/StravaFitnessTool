import { addDays, format, parseISO } from "date-fns";
import { RACE_READINESS_CONFIG, type RaceGoal, type RaceReadiness } from "./readiness";

/**
 * T3 — Progression burn-downs (Pillar 3).
 *
 * "Am I on pace to be *ready*?" For the two build metrics that gate race
 * readiness — long run and weekly volume — draw a target line to a dated
 * deadline (race day minus a taper buffer) and say how far ahead or behind the
 * athlete's current trajectory is.
 *
 * Pure trajectory math over existing signals — no forecasting. Glass-box: each
 * metric carries current, target, the required weekly ramp, the athlete's recent
 * rate, and the ahead/behind delta, with honest limitations (e.g. the required
 * ramp exceeding a safe progression, or a stalled trajectory).
 */

/** Weeks before race day by which the peak long run / volume should be reached. */
const PEAK_BUFFER_WEEKS = 3;
/** Safe weekly progression ceilings. */
const SAFE_LONG_RUN_STEP_KM = 2;
const SAFE_VOLUME_STEP_PCT = 0.1;

export type BurndownStatus = "met" | "ahead" | "on_track" | "behind" | "stalled";

export interface BurndownPoint {
  weeksOut: number;
  targetKm: number;
}

export interface BurndownMetric {
  key: "long_run" | "weekly_volume";
  label: string;
  unit: string;
  current: number;
  target: number;
  neededPerWeek: number;
  recentRatePerWeek: number;
  weeksToDeadline: number;
  status: BurndownStatus;
  /** Weeks behind the target line (negative = ahead); null when stalled/unprojectable. */
  weeksBehind: number | null;
  targetLine: BurndownPoint[];
  evidence: string;
}

export interface ProgressionBurndown {
  available: boolean;
  goalDistanceLabel: string | null;
  deadlineLabel: string | null;
  metrics: BurndownMetric[];
  headline: string;
  evidence: string[];
  limitations: string[];
}

export interface ProgressionBurndownInputs {
  raceReadiness: RaceReadiness | null;
  /** Recent long-run distances, oldest → newest (km). */
  recentLongRunsKm: number[];
  /** Weekly volume series, oldest → newest (km/wk). */
  weeklyVolumeKm: number[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Average weekly change across a short series (oldest → newest). */
function ratePerWeek(series: number[], maxPoints = 4): number {
  const tail = series.slice(-maxPoints).filter((v) => Number.isFinite(v));
  if (tail.length < 2) return 0;
  return (tail[tail.length - 1] - tail[0]) / (tail.length - 1);
}

function buildTargetLine(
  current: number,
  target: number,
  weeksToDeadline: number,
): BurndownPoint[] {
  const steps = Math.max(1, Math.min(9, Math.round(weeksToDeadline)));
  const points: BurndownPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    points.push({
      weeksOut: round1(weeksToDeadline * (1 - frac)),
      targetKm: round1(current + (target - current) * frac),
    });
  }
  return points;
}

function buildMetric(
  key: BurndownMetric["key"],
  label: string,
  current: number,
  target: number,
  rate: number,
  weeksToDeadline: number,
  safeStepKm: number,
): { metric: BurndownMetric; limitation: string | null } {
  const neededPerWeek = round1(Math.max(0, (target - current) / weeksToDeadline));
  const recentRatePerWeek = round1(rate);
  const targetLine = buildTargetLine(current, target, weeksToDeadline);

  let status: BurndownStatus;
  let weeksBehind: number | null;
  if (current >= target) {
    status = "met";
    weeksBehind = 0;
  } else if (rate <= 0.05) {
    status = "stalled";
    weeksBehind = null;
  } else {
    const projectedWeeks = (target - current) / rate;
    const delta = projectedWeeks - weeksToDeadline;
    weeksBehind = Math.round(delta);
    status = delta <= -0.5 ? "ahead" : delta >= 0.5 ? "behind" : "on_track";
  }

  const evidence =
    status === "met"
      ? `${label} target of ${target} km already met (${current} km).`
      : status === "stalled"
        ? `${label} at ${current} km isn't trending up: needs ~${neededPerWeek} km/wk to reach ${target} km in time.`
        : `${label} ${current} → ${target} km: rising ~${recentRatePerWeek} km/wk, needs ~${neededPerWeek} km/wk (${
            weeksBehind === 0
              ? "on the line"
              : weeksBehind! > 0
                ? `~${weeksBehind}w behind`
                : `~${Math.abs(weeksBehind!)}w ahead`
          }).`;

  const limitation =
    current < target && neededPerWeek > safeStepKm
      ? `${label} needs ~${neededPerWeek} km/wk to hit ${target} km in time, above the safe ~${round1(safeStepKm)} km/wk ramp; consider a longer runway or a nearer target.`
      : null;

  return {
    metric: {
      key,
      label,
      unit: key === "weekly_volume" ? "km/wk" : "km",
      current: round1(current),
      target: round1(target),
      neededPerWeek,
      recentRatePerWeek,
      weeksToDeadline: round1(weeksToDeadline),
      status,
      weeksBehind,
      targetLine,
      evidence,
    },
    limitation,
  };
}

function unavailable(reason: string): ProgressionBurndown {
  return {
    available: false,
    goalDistanceLabel: null,
    deadlineLabel: null,
    metrics: [],
    headline: reason,
    evidence: [],
    limitations: [reason],
  };
}

export function computeProgressionBurndown(
  inputs: ProgressionBurndownInputs,
  raceGoal: RaceGoal | null,
): ProgressionBurndown {
  const rr = inputs.raceReadiness;
  if (!raceGoal || !rr) {
    return unavailable("Set a race goal to see progression burn-downs toward race-ready targets.");
  }
  const weeksToRace = rr.daysUntilRace / 7;
  if (weeksToRace <= 0) {
    return unavailable("Race date has passed: no build runway to project.");
  }
  const cfg = RACE_READINESS_CONFIG[rr.distance];
  const weeksToDeadline = Math.max(1, weeksToRace - PEAK_BUFFER_WEEKS);
  const deadlineDate = addDays(parseISO(rr.raceDate), -PEAK_BUFFER_WEEKS * 7);
  const deadlineLabel = format(deadlineDate, "MMM d");

  const longRun = buildMetric(
    "long_run",
    "Long run",
    rr.longestRunKm,
    cfg.longRunTargetKm,
    ratePerWeek(inputs.recentLongRunsKm),
    weeksToDeadline,
    SAFE_LONG_RUN_STEP_KM,
  );
  const currentWeeklyKm = rr.fourWeekVolumeKm / 4;
  const volume = buildMetric(
    "weekly_volume",
    "Weekly volume",
    currentWeeklyKm,
    cfg.fourWeekVolumeTargetKm / 4,
    ratePerWeek(inputs.weeklyVolumeKm),
    weeksToDeadline,
    Math.max(SAFE_LONG_RUN_STEP_KM, currentWeeklyKm * SAFE_VOLUME_STEP_PCT),
  );

  const metrics = [longRun.metric, volume.metric];
  const limitations = [longRun.limitation, volume.limitation].filter((l): l is string => l != null);

  // Headline: the metric furthest behind (most weeks), else on-pace.
  const behind = metrics
    .filter((m) => m.status === "behind" || m.status === "stalled")
    .sort((a, b) => (b.weeksBehind ?? 99) - (a.weeksBehind ?? 99));
  let headline: string;
  if (behind.length === 0) {
    headline = `On pace for your ${cfg.label}: build targets tracking to ${deadlineLabel}.`;
  } else {
    const m = behind[0];
    headline =
      m.status === "stalled"
        ? `${m.label} has stalled at ${m.current} ${m.unit}: off pace for ${m.target} by ${deadlineLabel}.`
        : `${m.label} ${m.current} → ${m.target} ${m.unit} by ${deadlineLabel}: ~${m.weeksBehind}w behind.`;
  }

  return {
    available: true,
    goalDistanceLabel: cfg.label,
    deadlineLabel,
    metrics,
    headline,
    evidence: metrics.map((m) => m.evidence),
    limitations,
  };
}
