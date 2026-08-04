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
import { alreadyStated } from "@/lib/insights/consistency";
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

  const today = buildTodayFocus(savedWeek, analytics, primaryAction);
  const actionBullets = primaryActionBullets(primaryAction);

  // Decision support renders three columns beside the hero's "Why this", and all
  // four draw from overlapping pools. On the live account one sentence filled the
  // hero, a Risks bullet and the Primary action at once, reading as three
  // findings when it was one. The primary action is the canonical place for it,
  // so risks and opportunities yield to whatever the hero and action already say.
  const alreadyShown = [today.why, ...actionBullets];
  const withoutRepeats = <T extends { text: string }>(items: T[]) =>
    dedupeByTopic(items, (x) => x.text).filter((x) => !alreadyStated(x.text, alreadyShown));

  return {
    hero,
    today,
    changeFeed: buildChangeFeed(
      params.signals,
      params.recentlyLearned,
      params.adaptationSignals,
      analytics,
    ),
    risks: withoutRepeats(params.risksAndOpportunities.filter((x) => x.kind === "risk")),
    opportunities: withoutRepeats(
      params.risksAndOpportunities.filter((x) => x.kind === "opportunity"),
    ),
    primaryActionBullets: actionBullets,
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
        "Scheduled in your saved week: stay aligned with the plan rhythm.",
      stateLine: buildOperationalStateLine(analytics),
      fromPlan: true,
    };
  }

  if (planned?.modality === "rest") {
    return {
      title: "Recovery / rest",
      why:
        planned.purpose ||
        "Rest day in your saved plan: absorb recent load before the next quality session.",
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
  const push = (id: string, text: string, tone: ChangeFeedItem["tone"] = "neutral") => {
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

  return dedupeByTopic(items, (i) => i.text).slice(0, 6);
}

/* ------------------------------ dedup helpers ----------------------------- */

const FEED_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "to",
  "in",
  "on",
  "under",
  "during",
  "with",
  "for",
  "appears",
  "likely",
  "has",
  "have",
  "had",
  "been",
  "is",
  "are",
  "was",
  "this",
  "that",
  "these",
  "those",
  "across",
  "recent",
  "recently",
  "your",
  "you",
  "its",
  "their",
  "when",
  "while",
  "from",
  "into",
]);

function feedTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FEED_STOP.has(w));
}

/**
 * Drop rows that a reader would experience as "the same point again": either
 * a near-duplicate (≥60% token overlap, so "efficiency improves under stable
 * volume" ≈ "efficiency improves during stable volume") or a repeat of a topic
 * already shown (first two content words), keeping the first of each. A change
 * feed earns trust by reporting each thing once.
 */
function dedupeByTopic<T>(rows: T[], getText: (row: T) => string): T[] {
  const seenTopics = new Set<string>();
  const tokenSets: Set<string>[] = [];
  const out: T[] = [];
  for (const row of rows) {
    const toks = feedTokens(getText(row));
    if (toks.length === 0) {
      out.push(row);
      continue;
    }
    const topic = toks.slice(0, 2).join(" ");
    if (topic && seenTopics.has(topic)) continue;
    const set = new Set(toks);
    const near = tokenSets.some((b) => {
      let inter = 0;
      for (const w of set) if (b.has(w)) inter++;
      const union = set.size + b.size - inter;
      return union > 0 && inter / union >= 0.6;
    });
    if (near) continue;
    if (topic) seenTopics.add(topic);
    tokenSets.push(set);
    out.push(row);
  }
  return out;
}
