import type { DashboardInsights } from "@/lib/analytics";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { IntelligenceSignal, TrajectorySeries } from "./athleteState";
import { getTrajectorySeries } from "./athleteState";

export interface PrioritizedSignals {
  primary: IntelligenceSignal | null;
  secondary: IntelligenceSignal[];
  watchlist: IntelligenceSignal[];
}

export interface StateEvolutionItem {
  id: string;
  label: string;
  direction: string;
  interpretation: string;
  trend: "up" | "down" | "flat";
  values: { label: string; value: number }[];
}

export function buildCurrentBelief(
  state: CoachWorkspaceState,
  analytics: DashboardInsights,
): string {
  const snap = state.snapshot;
  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;
  const ready = r.label.toLowerCase().includes("ready") || r.score >= 85;
  const freshHigh = snap.freshness != null && snap.freshness >= 60;
  const intensityHigh = analytics.intensityAdvice.status === "too_hard";

  if (ready && freshHigh && intensityHigh) {
    return "Race readiness is strong and freshness is high, but intensity stacking remains elevated.";
  }

  const parts: string[] = [];
  parts.push(ready ? "Race readiness is strong" : `Race readiness is ${r.label.toLowerCase()}`);
  if (snap.freshness != null && snap.freshness >= 60) {
    parts.push("freshness is high");
  } else if (snap.freshness != null && snap.freshness < 45) {
    parts.push("freshness is constrained");
  }
  if (intensityHigh) {
    parts.push("intensity stacking remains elevated");
  } else if (analytics.efficiencySummary.trend === "improving") {
    parts.push("aerobic efficiency is improving");
  }

  return parts.join(", ") + ".";
}

export function prioritizeSignals(signals: IntelligenceSignal[]): PrioritizedSignals {
  if (signals.length === 0) {
    return { primary: null, secondary: [], watchlist: [] };
  }

  const watchlist = signals.filter((s) => s.severity === "warning");
  const primary =
    signals.find((s) => s.id === "eff-trend") ??
    signals.find((s) => s.severity === "positive") ??
    signals.find((s) => s.severity === "opportunity") ??
    signals[0];

  const secondary = signals
    .filter((s) => s.id !== primary?.id && s.severity !== "warning")
    .slice(0, 4);

  return { primary: primary ?? null, secondary, watchlist };
}

export function getStateEvolutionStrip(analytics: DashboardInsights): StateEvolutionItem[] {
  const series = getTrajectorySeries(analytics);
  const items: StateEvolutionItem[] = series.map((s) => ({
    id: s.id,
    label: shortLabel(s),
    direction: trendDirection(s),
    interpretation: s.interpretation,
    trend: s.trend,
    values: s.values,
  }));

  if (analytics.intensityAdvice.status === "too_hard") {
    items.push({
      id: "intensity",
      label: "Intensity",
      direction: "Elevated",
      interpretation: "Watch stacking",
      trend: "flat",
      values: [],
    });
  }

  return items;
}

function shortLabel(s: TrajectorySeries): string {
  if (s.id === "readiness") return "Race readiness";
  if (s.id === "freshness") return "Freshness";
  if (s.id === "efficiency") return "Aerobic efficiency";
  if (s.id === "volume") return "Weekly volume";
  return s.label;
}

function trendDirection(s: TrajectorySeries): string {
  const [dir] = s.interpretation.split("·").map((x) => x.trim());
  if (dir) return dir;
  if (s.trend === "up") return "Rising";
  if (s.trend === "down") return "Falling";
  return "Stable";
}

export function primaryActionBullets(recommendation: string): string[] {
  const parts = recommendation
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 8);
  if (parts.length <= 1) {
    return [recommendation];
  }
  return parts.slice(0, 4);
}

export function memoryKind(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("strongest") || l.includes("historical")) return "Historical signal";
  if (l.includes("current block") || l === "current block") return "Current model belief";
  if (l.includes("pattern") || l.includes("intensity") || l.includes("efficiency")) {
    return "Observed pattern";
  }
  if (l.includes("profile") || l.includes("archetype")) return "Athlete profile";
  return "Learned context";
}
