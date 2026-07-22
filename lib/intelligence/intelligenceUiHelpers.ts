import type { DashboardInsights } from "@/lib/analytics";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { AthleteBelief } from "@/lib/athlete-memory/types";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import type { StateEvolutionItem } from "./presentation";

export function buildHeroSupportingReasons(
  state: CoachWorkspaceState,
  analytics: DashboardInsights,
): string[] {
  const reasons: string[] = [];
  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;

  if (r.label.toLowerCase().includes("ready") || r.score >= 80) {
    reasons.push("Readiness strong");
  } else {
    reasons.push(`Readiness ${r.label.toLowerCase()}`);
  }

  const fresh = state.snapshot.freshness ?? analytics.fatigue.freshness;
  if (fresh >= 60) reasons.push("Freshness high");
  else if (fresh < 45) reasons.push("Freshness constrained");
  else reasons.push("Freshness moderate");

  if (analytics.intensityAdvice.status === "too_hard") {
    reasons.push("Intensity density elevated");
  } else if (analytics.efficiencySummary.trend === "improving") {
    reasons.push("Efficiency improving");
  }

  if (analytics.raceReadiness && analytics.raceReadiness.daysUntilRace <= 14) {
    reasons.push("Race week context");
  }

  return reasons.slice(0, 4);
}

export function buildSystemConfidenceSummary(analytics: DashboardInsights): {
  level: string;
  reason: string;
} {
  const level =
    analytics.dataConfidence === "high"
      ? "High"
      : analytics.dataConfidence === "medium"
        ? "Moderate"
        : "Low";

  const parts: string[] = [];
  if (analytics.raceReadiness) {
    parts.push("race-specific context");
  }
  if (analytics.fatigue.freshness >= 55) {
    parts.push("stable freshness signal");
  }
  if (analytics.efficiencySummary.trend === "improving") {
    parts.push("efficiency trend");
  }
  if (analytics.dataConfidence === "low" || analytics.summary.runCount < 12) {
    return {
      level,
      reason: "limited history and sparse HR/stream coverage",
    };
  }
  if (parts.length === 0) {
    parts.push("ongoing load and session history");
  }

  return {
    level,
    reason: parts.join(", "),
  };
}

export function formatTrajectoryDisplay(item: StateEvolutionItem): {
  headline: string;
  sub: string;
} {
  const sub = item.interpretation.replace(/^·\s*/, "").trim();
  let headline = item.direction;

  if (item.id === "readiness") {
    headline = item.trend === "flat" ? "Stable" : item.direction;
    return {
      headline: `${headline} · ${sub || "race ready"}`,
      sub: "",
    };
  }
  if (item.id === "freshness") {
    const [level, ctx] = item.interpretation.split("·").map((x) => x.trim());
    return {
      headline: `${level || item.direction} · ${ctx || "quality window"}`,
      sub: "",
    };
  }
  if (item.id === "efficiency") {
    return {
      headline: `${item.direction} · ${sub || "aerobic signal"}`,
      sub: sub || "efficiency",
    };
  }
  if (item.id === "volume") {
    const volSub =
      item.trend === "down" ? "taper effect" : item.trend === "up" ? "build phase" : sub;
    return {
      headline: `${item.direction} this week`,
      sub: volSub || "weekly load",
    };
  }
  if (item.id === "intensity") {
    return {
      headline: "Elevated",
      sub: "watch stacking",
    };
  }

  return { headline: `${item.direction} · ${item.label}`, sub };
}

export type MemoryGroup = "stable" | "emerging" | "watchlist";

export function groupMemoryItems(items: MemorySnippet[]): Record<MemoryGroup, MemorySnippet[]> {
  const stable: MemorySnippet[] = [];
  const emerging: MemorySnippet[] = [];
  const watchlist: MemorySnippet[] = [];

  for (const m of items) {
    const label = m.label.toLowerCase();
    const text = m.text.toLowerCase();
    const isWatch =
      m.stability === "weakening" ||
      label.includes("fatigue") ||
      label.includes("modality") ||
      /interfer|stack|sensitive|density/i.test(text);

    const isStable =
      m.stability === "stable" || (m.confidence === "high" && m.stability !== "emerging");

    if (isWatch) watchlist.push(m);
    else if (isStable) stable.push(m);
    else emerging.push(m);
  }

  return { stable, emerging, watchlist };
}

export function beliefsToSnippets(beliefs: AthleteBelief[]): MemorySnippet[] {
  return beliefs.map((b) => ({
    id: b.id,
    label: b.category.charAt(0).toUpperCase() + b.category.slice(1),
    text: b.statement,
    confidence: b.confidence,
    stability: b.stability,
  }));
}

export function signalImplication(signal: {
  severity: string;
  headline: string;
  text: string;
}): string {
  if (signal.severity === "warning") {
    return "Freshness risk if pattern continues";
  }
  if (signal.severity === "positive") {
    if (/efficiency|aerobic/i.test(signal.headline)) {
      return "Supports current race fitness outlook";
    }
    return "Supports current recommendation";
  }
  if (signal.severity === "opportunity") {
    return "Actionable window if protected";
  }
  if (/readiness|fresh/i.test(signal.headline)) {
    return "Taper response appears positive";
  }
  if (/threshold|tempo|interval/i.test(signal.headline)) {
    return "Supports lactate tolerance";
  }
  return "Shapes the current recommendation";
}
