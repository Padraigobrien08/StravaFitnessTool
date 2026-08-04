import type { DashboardInsights } from "@/lib/analytics";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { AthleteBelief } from "@/lib/athlete-memory/types";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import type { StateEvolutionItem } from "./presentation";
import { isTrainingCurrent, stalenessClause } from "@/lib/insights/consistency";

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
  const trainingCurrent = isTrainingCurrent(analytics.fatigue);
  // Freshness after a layoff is rest, not sharpness, and the intensity and
  // efficiency reasons below describe a block that has already finished.
  if (!trainingCurrent) reasons.push(`Out of training · ${stalenessClause(analytics.fatigue)}`);
  else if (fresh >= 60) reasons.push("Freshness high");
  else if (fresh < 45) reasons.push("Freshness constrained");
  else reasons.push("Freshness moderate");

  if (analytics.intensityAdvice.status === "too_hard") {
    reasons.push(trainingCurrent ? "Intensity density elevated" : "Last block intensity-heavy");
  } else if (trainingCurrent && analytics.efficiencySummary.trend === "improving") {
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

/**
 * Join label segments with " · " while dropping empties and case-insensitive
 * duplicates. Prevents the "Stable · Stable · nearly there" /
 * "Improving · Improving · MoM gain" repetition when a segment (direction) is
 * already echoed by the interpretation string.
 */
function cleanSegments(...parts: (string | undefined | null)[]): string {
  const seen = new Set<string>();
  const segs: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.split("·")) {
      const s = raw.trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      segs.push(s);
    }
  }
  return segs.join(" · ");
}

export function formatTrajectoryDisplay(item: StateEvolutionItem): {
  headline: string;
  sub: string;
} {
  const interp = item.interpretation.replace(/^·\s*/, "").trim();
  const dir = item.direction.trim();

  if (item.id === "readiness") {
    const level = item.trend === "flat" ? "Stable" : dir;
    return {
      headline: cleanSegments(level, interp || "race ready"),
      sub: "",
    };
  }
  if (item.id === "freshness") {
    return {
      headline: cleanSegments(interp || dir, "quality window"),
      sub: "",
    };
  }
  if (item.id === "efficiency") {
    return {
      headline: cleanSegments(dir, interp || "aerobic signal"),
      sub: "",
    };
  }
  if (item.id === "volume") {
    // `dir` may already read "Down this week" — don't append the phrase twice.
    const headline = /week/i.test(dir) ? dir : cleanSegments(dir, "this week");
    const volSub =
      item.trend === "down" ? "taper effect" : item.trend === "up" ? "build phase" : interp;
    const sub =
      volSub && !headline.toLowerCase().includes(volSub.toLowerCase()) ? volSub : "weekly load";
    return { headline, sub };
  }
  if (item.id === "intensity") {
    return {
      headline: "Elevated",
      sub: "watch stacking",
    };
  }

  return { headline: cleanSegments(dir, item.label), sub: interp };
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
