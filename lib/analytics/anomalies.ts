import type { RunActivity } from "@/lib/strava/types";
import type { PersonalZScores, SessionZScore } from "./personalZScores";

/**
 * D3 — Anomaly detection (Pillar 4, data-scientist rigor).
 *
 * Flags the sessions that don't fit the athlete's personal model — large-|z|
 * outliers from D4 — and attributes a *likely cause* from concrete per-run
 * signals (heat, terrain, fatigue). An outlier alone isn't actionable; the
 * value is the why, so a "bad" run reads as "slow, but 28°C and hilly" rather
 * than a mystery. Glass-box: every cause names its evidence, and when nothing
 * explains the outlier D3 says so instead of inventing a reason.
 */

export type AnomalyCauseKind = "heat" | "terrain" | "fatigue" | "unexplained" | "favorable";

export interface AnomalyCause {
  cause: AnomalyCauseKind;
  detail: string;
}

export interface Anomaly {
  runId: string;
  date: string;
  runName: string;
  type: string;
  typeLabel: string;
  /** Personal z (higher = better than the athlete's typical for this type). */
  z: number;
  direction: "under" | "over";
  likelyCauses: AnomalyCause[];
  confidence: "low" | "medium" | "high";
  headline: string;
}

export interface AnomalyReport {
  available: boolean;
  anomalies: Anomaly[];
  evidence: string[];
  limitations: string[];
}

/** |z| at/above which a session is treated as not fitting the personal model. */
const ANOMALY_Z = 1.5;
/** Absolute floors so tiny/quiet signals don't get labelled a "cause". */
const HOT_ABS_C = 22;
const HILLY_ABS_M_PER_KM = 8;
const FATIGUE_ABS_KM = 15;

function median(xs: number[]): number | null {
  const s = xs.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function elevPerKm(run: RunActivity): number | null {
  const km = run.distanceM / 1000;
  if (km <= 0 || run.elevationGainM == null) return null;
  return run.elevationGainM / km;
}

/** Sum of run distance (km) in the 3 days strictly before `dateIso`. */
function preceding3dayKm(runs: RunActivity[], dateIso: string, excludeId: string): number {
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return 0;
  const windowStart = t - 3 * 86_400_000;
  let km = 0;
  for (const r of runs) {
    if (r.id === excludeId) continue;
    const rt = Date.parse(r.date);
    if (Number.isNaN(rt)) continue;
    if (rt < t && rt >= windowStart) km += r.distanceM / 1000;
  }
  return km;
}

export function computeAnomalies(
  runs: RunActivity[],
  personalZScores: PersonalZScores,
): AnomalyReport {
  if (!personalZScores.available) {
    return {
      available: false,
      anomalies: [],
      evidence: [],
      limitations: [
        "Personal z-scores aren't available yet — need enough comparable sessions to detect what's abnormal.",
      ],
    };
  }

  const runById = new Map(runs.map((r) => [r.id, r]));

  // Athlete baselines (over all runs) for cause attribution.
  const medTemp = median(runs.map((r) => r.weatherTempC).filter((v): v is number => v != null));
  const medElev = median(runs.map(elevPerKm).filter((v): v is number => v != null));
  const medPreceding = median(
    runs.map((r) => preceding3dayKm(runs, r.date, r.id)).filter((v) => v > 0),
  );

  const outliers = personalZScores.sessions.filter(
    (s) => s.primaryZ != null && Math.abs(s.primaryZ) >= ANOMALY_Z,
  );

  const anomalies: Anomaly[] = outliers
    .map((s) => buildAnomaly(s, runById.get(s.runId), { medTemp, medElev, medPreceding, runs }))
    .filter((a): a is Anomaly => a != null)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

  if (anomalies.length === 0) {
    return {
      available: false,
      anomalies: [],
      evidence: [],
      limitations: ["No recent runs fall outside your normal range for their workout type."],
    };
  }

  const evidence = anomalies.slice(0, 3).map((a) => a.headline);
  const limitations = [
    "Causes are contextual associations from temperature, elevation, and recent load — not proven explanations.",
  ];

  return { available: true, anomalies, evidence, limitations };
}

function buildAnomaly(
  s: SessionZScore,
  run: RunActivity | undefined,
  baselines: {
    medTemp: number | null;
    medElev: number | null;
    medPreceding: number | null;
    runs: RunActivity[];
  },
): Anomaly | null {
  if (!run || s.primaryZ == null) return null;
  const z = s.primaryZ;
  const direction: Anomaly["direction"] = z < 0 ? "under" : "over";
  const causes: AnomalyCause[] = [];

  const temp = run.weatherTempC;
  const elev = elevPerKm(run);
  const preceding = preceding3dayKm(baselines.runs, run.date, run.id);

  const isHot =
    temp != null &&
    temp >= HOT_ABS_C &&
    (baselines.medTemp == null || temp >= baselines.medTemp + 6);
  const isHilly =
    elev != null &&
    elev >= HILLY_ABS_M_PER_KM &&
    (baselines.medElev == null || elev >= baselines.medElev * 1.8);
  const isFatigued =
    preceding >= FATIGUE_ABS_KM &&
    baselines.medPreceding != null &&
    preceding >= baselines.medPreceding * 1.4;

  if (direction === "under") {
    if (isHot)
      causes.push({
        cause: "heat",
        detail: `${Math.round(temp!)}°C${baselines.medTemp != null ? ` vs your ~${Math.round(baselines.medTemp)}°C typical` : ""}`,
      });
    if (isHilly)
      causes.push({
        cause: "terrain",
        detail: `${Math.round(elev!)} m/km${baselines.medElev != null ? ` vs your ~${Math.round(baselines.medElev)}` : ""}`,
      });
    if (isFatigued)
      causes.push({ cause: "fatigue", detail: `${Math.round(preceding)} km in the 3 days prior` });
    if (causes.length === 0) {
      causes.push({
        cause: "unexplained",
        detail: "no obvious heat, hills, or recent-load explanation — worth a look",
      });
    }
  } else {
    // Overperformance — note favourable conditions if present.
    const favs: string[] = [];
    if (temp != null && baselines.medTemp != null && temp <= baselines.medTemp - 4)
      favs.push(`cool ${Math.round(temp)}°C`);
    if (elev != null && baselines.medElev != null && elev <= baselines.medElev * 0.6)
      favs.push("flat");
    causes.push({
      cause: "favorable",
      detail:
        favs.length > 0 ? `standout — ${favs.join(", ")}` : "standout — no adverse conditions",
    });
  }

  const sigma = `${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(1)}σ`;
  const causeText =
    direction === "under"
      ? causes[0].cause === "unexplained"
        ? "doesn't fit your model"
        : `likely ${causes.map((c) => c.cause).join(" + ")}`
      : "overperformed";
  const headline = `${s.typeLabel} ${sigma} — ${causeText}.`;

  return {
    runId: s.runId,
    date: s.date,
    runName: s.runName,
    type: s.type,
    typeLabel: s.typeLabel,
    z,
    direction,
    likelyCauses: causes,
    confidence: s.confidence,
    headline,
  };
}
