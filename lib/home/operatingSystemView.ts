import { format, parseISO } from "date-fns";
import type { DashboardInsights } from "@/lib/analytics";
import type { Insight } from "@/lib/insights/types";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { RiskOpportunity } from "@/lib/coach/types";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import type { TrainingCalendarWeek } from "@/lib/training-calendar";
import type { IntelligenceSignal } from "@/lib/intelligence/athleteState";
import {
  buildCurrentBelief,
  getStateEvolutionStrip,
  primaryActionBullets,
} from "@/lib/intelligence/presentation";
import { buildHeroSupportingReasons } from "@/lib/intelligence/intelligenceUiHelpers";
import { getPrimaryRecommendation } from "@/lib/intelligence/athleteState";
import { buildCommandCenterView } from "./commandCenter";

export interface HomeHeroView {
  focusTitle: string;
  currentBelief: string;
  primaryAction: string;
  whyBullets: string[];
  planState: string | null;
  hasSavedPlan: boolean;
  savedPlanSummary: string | null;
  raceName: string | null;
  daysUntilRace: number | null;
  readinessScore: number;
  readinessLabel: string;
  freshness: number;
  freshnessLabel: string;
  confidence: "low" | "medium" | "high";
  taperActive: boolean;
}

export interface HomeTodayView {
  title: string;
  why: string;
  stateLine: string;
  fromPlan: boolean;
}

export interface ChangeFeedItem {
  id: string;
  text: string;
  tone: "positive" | "neutral" | "warning";
}

export interface HomeOperatingSystemView {
  hero: HomeHeroView;
  today: HomeTodayView;
  changeFeed: ChangeFeedItem[];
  risks: RiskOpportunity[];
  opportunities: RiskOpportunity[];
  primaryActionBullets: string[];
  trajectory: ReturnType<typeof getStateEvolutionStrip>;
  memory: MemorySnippet[];
  command: ReturnType<typeof buildCommandCenterView>;
}

export function buildHomeOperatingSystemView(params: {
  analytics: DashboardInsights;
  insights: Insight[];
  state: CoachWorkspaceState | null;
  risksAndOpportunities: RiskOpportunity[];
  savedWeek: TrainingCalendarWeek | null;
  signals: IntelligenceSignal[];
  memory: MemorySnippet[];
  recentlyLearned: string[];
  adaptationSignals: string[];
}): HomeOperatingSystemView {
  const { analytics, state, savedWeek } = params;
  const command = buildCommandCenterView(
    analytics,
    params.insights,
    state,
    params.risksAndOpportunities,
    savedWeek ? { summary: savedWeek.summary } : null,
  );

  const primaryAction = state ? getPrimaryRecommendation(state, analytics) : command.nextAction;

  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;
  const daysUntil = analytics.raceReadiness?.daysUntilRace ?? null;
  const taperActive = daysUntil != null && daysUntil <= 14 && daysUntil >= 0;

  const hero: HomeHeroView = {
    focusTitle: state?.currentFocus ?? command.focusLabel,
    currentBelief: state
      ? buildCurrentBelief(state, analytics)
      : command.currentBelief.replace(/^Current belief:\s*/i, ""),
    primaryAction,
    whyBullets: state
      ? buildHeroSupportingReasons(state, analytics)
      : primaryActionBullets(primaryAction).slice(0, 4),
    planState: command.hasSavedPlan
      ? command.savedPlanSummary
        ? `Week of ${formatWeekLabel(savedWeek?.weekStart)} saved locally`
        : "Saved calendar plan ready"
      : null,
    hasSavedPlan: command.hasSavedPlan,
    savedPlanSummary: command.savedPlanSummary,
    raceName: analytics.raceReadiness?.distanceLabel ?? null,
    daysUntilRace: daysUntil,
    readinessScore: Math.round(r.score),
    readinessLabel: r.label,
    freshness: Math.round(analytics.fatigue.freshness),
    freshnessLabel: analytics.fatigue.label,
    confidence: analytics.dataConfidence,
    taperActive,
  };

  return {
    hero,
    today: buildTodayFocus(savedWeek, analytics, primaryAction),
    changeFeed: buildChangeFeed(
      params.signals,
      params.recentlyLearned,
      params.adaptationSignals,
      analytics,
    ),
    risks: params.risksAndOpportunities.filter((x) => x.kind === "risk"),
    opportunities: params.risksAndOpportunities.filter((x) => x.kind === "opportunity"),
    primaryActionBullets: primaryActionBullets(primaryAction),
    trajectory: getStateEvolutionStrip(analytics),
    memory: params.memory,
    command,
  };
}

function formatWeekLabel(weekStart?: string): string {
  if (!weekStart) return "this week";
  try {
    return format(parseISO(weekStart), "MMM d");
  } catch {
    return weekStart;
  }
}

function buildTodayFocus(
  savedWeek: TrainingCalendarWeek | null,
  analytics: DashboardInsights,
  fallbackAction: string,
): HomeTodayView {
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const dayShort = format(new Date(), "EEE");

  const planned = savedWeek?.workouts.find(
    (w) =>
      w.date.slice(0, 10) === todayIso || w.day.toLowerCase().startsWith(dayShort.toLowerCase()),
  );

  if (planned && planned.modality !== "rest") {
    return {
      title: planned.title,
      why:
        planned.purpose ||
        planned.reasoning ||
        "Scheduled in your saved week — stay aligned with the plan rhythm.",
      stateLine: buildOperationalStateLine(analytics),
      fromPlan: true,
    };
  }

  if (planned?.modality === "rest") {
    return {
      title: "Recovery / rest",
      why:
        planned.purpose ||
        "Rest day in your saved plan — absorb recent load before the next quality session.",
      stateLine: buildOperationalStateLine(analytics),
      fromPlan: true,
    };
  }

  const firstLine = primaryActionBullets(fallbackAction)[0] ?? fallbackAction;
  return {
    title: inferTodayTitle(analytics, firstLine),
    why: firstLine,
    stateLine: buildOperationalStateLine(analytics),
    fromPlan: false,
  };
}

function inferTodayTitle(analytics: DashboardInsights, action: string): string {
  if (analytics.raceReadiness && analytics.raceReadiness.daysUntilRace <= 3) {
    return "Race-week execution";
  }
  if (/easy|aerobic|recovery/i.test(action)) return "Easy aerobic rhythm";
  if (/tempo|threshold/i.test(action)) return "Controlled quality";
  if (/long/i.test(action)) return "Long aerobic work";
  if (/rest|recover/i.test(action)) return "Recovery emphasis";
  return "Today's training focus";
}

function buildOperationalStateLine(analytics: DashboardInsights): string {
  const parts: string[] = [];
  parts.push(`Freshness ${Math.round(analytics.fatigue.freshness)}`);
  if (analytics.intensityAdvice.status === "too_hard") {
    parts.push("intensity elevated");
  } else {
    parts.push("intensity balanced");
  }
  if (analytics.raceReadiness && analytics.raceReadiness.daysUntilRace <= 14) {
    parts.push("taper active");
  }
  return parts.join(" · ");
}

function buildChangeFeed(
  signals: IntelligenceSignal[],
  recentlyLearned: string[],
  adaptationSignals: string[],
  analytics: DashboardInsights,
): ChangeFeedItem[] {
  const items: ChangeFeedItem[] = [];
  const seen = new Set<string>();

  const push = (id: string, text: string, tone: ChangeFeedItem["tone"] = "neutral") => {
    const key = text.slice(0, 48);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id, text, tone });
  };

  for (const line of recentlyLearned.slice(0, 4)) {
    push(`learned-${items.length}`, line, "positive");
  }
  for (const line of adaptationSignals.slice(0, 3)) {
    push(`adapt-${items.length}`, line, "positive");
  }

  for (const s of signals.slice(0, 5)) {
    const tone: ChangeFeedItem["tone"] =
      s.severity === "warning"
        ? "warning"
        : s.severity === "positive" || s.severity === "opportunity"
          ? "positive"
          : "neutral";
    push(s.id, s.headline, tone);
  }

  if (analytics.efficiencySummary.trend === "improving") {
    push("eff-trend", "Aerobic efficiency trend strengthened", "positive");
  }
  if (analytics.fatigue.freshness >= 65) {
    push("fresh-high", "Freshness supports quality execution", "positive");
  }
  if (analytics.intensityAdvice.status === "too_hard") {
    push("intensity", "Threshold density elevated this block", "warning");
  }

  const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;
  if (r.score >= 80) {
    push("readiness", `${r.label} readiness stabilized`, "positive");
  }

  return items.slice(0, 8);
}
