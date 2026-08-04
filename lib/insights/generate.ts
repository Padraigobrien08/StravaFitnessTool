import type { DashboardInsights } from "@/lib/analytics";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import type { Insight } from "./types";
import { formatPace, formatDuration } from "@/lib/utils";
import { recentPrHighlights } from "@/lib/analytics/progression";
import { generateEcosystemInsights } from "@/lib/ecosystem/insights";

export function generateInsights(
  analytics: DashboardInsights,
  quality: ImportQualityReport,
): Insight[] {
  const insights: Insight[] = [];
  const {
    summary,
    easyHard,
    halfMarathonReadiness,
    goalProgress,
    efficiencySummary,
    weeklyNarrative,
    consistencyScore,
    intensityAdvice,
    prTimeline,
    fatigue,
    efficiencyMoM,
  } = analytics;

  // Am I improving?
  for (const pr of recentPrHighlights(prTimeline, 14)) {
    insights.push({
      id: `new-pr-${pr.bucket}`,
      question: "improving",
      title: `New ${pr.label} PR`,
      severity: "positive",
      evidence: [
        `${formatDuration(pr.timeSec)} on ${new Date(pr.date).toLocaleDateString()} (${pr.runName}).`,
      ],
      confidence: analytics.dataConfidence,
    });
  }

  if (efficiencySummary.trend === "improving") {
    const efficiencyEvidence = [
      "Recent runs show lower pace-per-heart-rate vs your prior 4-run window.",
      `${summary.runCount} runs in dataset.`,
    ];
    if (efficiencyMoM.narrative) {
      efficiencyEvidence.unshift(efficiencyMoM.narrative);
    }
    insights.push({
      id: "pace-efficiency-up",
      question: "improving",
      title: "Aerobic efficiency is trending up",
      severity: "positive",
      evidence: efficiencyEvidence,
      confidence: analytics.dataConfidence,
    });
  } else if (efficiencySummary.trend === "declining") {
    insights.push({
      id: "pace-efficiency-down",
      question: "improving",
      title: "Efficiency has dipped recently",
      severity: "warning",
      evidence: [
        "Pace at a given HR has worsened vs your prior block: fatigue or heat may be a factor.",
      ],
      recommendation: "Consider an easy week or check sleep and hydration before adding intensity.",
      confidence: analytics.dataConfidence,
    });
  }

  if (summary.avgPaceSecPerKm) {
    insights.push({
      id: "avg-pace",
      question: "improving",
      title: `Average training pace: ${formatPace(summary.avgPaceSecPerKm)}`,
      severity: "neutral",
      evidence: [
        `Total volume: ${summary.totalDistanceKm} km across ${summary.runCount} runs.`,
        summary.last7DaysKm > 0
          ? `Last 7 days: ${summary.last7DaysKm} km (${summary.last7DaysRuns} runs).`
          : "No runs in the last 7 days.",
      ],
      confidence: analytics.dataConfidence,
    });
  }

  // Am I training correctly?
  const easyPct = easyHard.easyPct;
  if (easyPct < 30 && easyHard.easy + easyHard.hard > 0) {
    insights.push({
      id: "intensity-heavy",
      question: "training",
      title: "Training looks intensity-heavy",
      severity: "warning",
      evidence: [
        `${easyHard.hard} of ${easyHard.easy + easyHard.hard} runs classified as hard (≥80% max HR).`,
        `Only ${easyPct.toFixed(0)}% easy: polarized plans often target ~80% easy.`,
      ],
      recommendation: "Add 1–2 low-HR easy runs per week to support recovery and aerobic base.",
      confidence: quality.fieldCoverage.find((f) => f.label === "Heart rate")?.level ?? "medium",
    });
  }

  insights.push({
    id: "consistency-score",
    question: "training",
    title: `Consistency: ${consistencyScore.overall}/100 (${consistencyScore.label})`,
    severity:
      consistencyScore.overall >= 75
        ? "positive"
        : consistencyScore.overall >= 50
          ? "neutral"
          : "warning",
    evidence: consistencyScore.evidence,
    confidence: analytics.dataConfidence,
  });

  if (fatigue.freshness < 35) {
    insights.push({
      id: "fatigue-warning",
      question: "next",
      title: `Fatigue elevated (${fatigue.label})`,
      severity: "warning",
      evidence: fatigue.evidence,
      recommendation: "Consider an easy week: limit hard sessions and keep most runs in Z1–Z2.",
      confidence: analytics.dataConfidence,
    });
  } else if (fatigue.freshness >= 75) {
    insights.push({
      id: "freshness-good",
      question: "training",
      title: `Fresh enough for quality work (${fatigue.label})`,
      severity: "positive",
      evidence: fatigue.evidence,
      confidence: analytics.dataConfidence,
    });
  }

  const easyTypes = analytics.workoutTypeMix.filter((b) => ["easy", "recovery"].includes(b.type));
  const easyPctMix = easyTypes.reduce((s, b) => s + b.pct, 0);
  if (analytics.workoutTypeMix.length > 0) {
    const top = [...analytics.workoutTypeMix].sort((a, b) => b.runCount - a.runCount)[0];
    insights.push({
      id: "workout-mix",
      question: "training",
      title: `Workout mix: ${top.label} most common (8 weeks)`,
      severity: easyPctMix >= 60 ? "positive" : "neutral",
      evidence: analytics.workoutTypeMix.map(
        (b) => `${b.label}: ${b.runCount} runs (${b.pct.toFixed(0)}%)`,
      ),
      confidence: analytics.dataConfidence,
    });
  }

  if (intensityAdvice.status === "too_hard") {
    insights.push({
      id: "intensity-advice",
      question: "next",
      title: "Intensity balance needs attention",
      severity: "warning",
      evidence: intensityAdvice.recommendations,
      recommendation: intensityAdvice.recommendations[0],
      confidence: intensityAdvice.hardRunsLast14d > 0 ? "medium" : "low",
    });
  } else if (easyPct >= 60) {
    insights.push({
      id: "easy-balance",
      question: "training",
      title: "Good easy-run balance",
      severity: "positive",
      evidence: [`${easyPct.toFixed(0)}% of runs are easy effort, aligns with polarized training.`],
      confidence: "medium",
    });
  }

  // Am I ready?
  if (analytics.raceStrategy && analytics.raceReadiness) {
    const s = analytics.raceStrategy;
    insights.push({
      id: "race-strategy",
      question: "ready",
      title: `Race strategy: ${formatDuration(s.targetTimeSec)} (${s.strategy})`,
      severity: s.fadeRisk === "high" ? "warning" : s.fadeRisk === "low" ? "positive" : "neutral",
      evidence: [
        `Fade risk: ${s.fadeRisk}.`,
        s.narrative[0],
        `First 5K split: ~${formatDuration(s.splits.find((x) => x.km >= 5)?.cumulativeSec ?? s.splits[0]?.cumulativeSec ?? 0)}.`,
      ],
      recommendation:
        s.fadeRisk === "high"
          ? "Use conservative pacing mode on Goals before race day."
          : undefined,
      confidence: analytics.dataConfidence,
    });
  }

  if (analytics.raceReadiness) {
    const r = analytics.raceReadiness;
    insights.push({
      id: "race-readiness",
      question: "ready",
      title: `${r.distanceLabel} readiness: ${r.score}/100 (${r.label})`,
      severity: r.score >= 65 ? "positive" : r.score >= 40 ? "neutral" : "warning",
      evidence: [
        `${r.daysUntilRace} days until race · ${r.probabilityBand}.`,
        `Longest run: ${r.longestRunKm} km (${r.longestRunPct}% of long-run target).`,
        `4-week volume: ${r.fourWeekVolumeKm} km (${r.volumePct}% of volume target).`,
        ...r.gaps.slice(0, 2).map((g) => `${g.metric}: ${g.current} → ${g.target}`),
      ],
      recommendation:
        r.gaps.length > 0 ? `Focus on: ${r.gaps.map((g) => g.metric).join(", ")}.` : undefined,
      confidence: analytics.dataConfidence,
    });
  } else {
    insights.push({
      id: "hm-readiness",
      question: "ready",
      title: `Half-marathon readiness: ${halfMarathonReadiness.score}/100 (${halfMarathonReadiness.label})`,
      severity:
        halfMarathonReadiness.score >= 65
          ? "positive"
          : halfMarathonReadiness.score >= 40
            ? "neutral"
            : "warning",
      evidence: [
        `Longest run: ${halfMarathonReadiness.longestRunKm.toFixed(1)} km (${halfMarathonReadiness.longestRunPct}% of 21.1 km).`,
        `4-week volume: ${halfMarathonReadiness.fourWeekVolumeKm} km (${halfMarathonReadiness.volumePct}% of ~160 km target).`,
      ],
      recommendation:
        halfMarathonReadiness.score < 65
          ? "Build long run toward 18–20 km and hold 4-week volume before racing."
          : "Set a race goal on Goals for distance-specific readiness.",
      confidence: analytics.dataConfidence,
    });
  }

  // What should I do next?
  const plan = analytics.nextWeekPlan;
  insights.push({
    id: "next-week-plan",
    question: "next",
    title: `Next week: ${plan.totalKmRange[0]}–${plan.totalKmRange[1]} km planned`,
    severity:
      plan.template === "recovery" || plan.template === "easy_reset"
        ? "warning"
        : plan.template === "taper" || plan.template === "race_week"
          ? "neutral"
          : "positive",
    evidence: [
      plan.rationale[0],
      ...plan.sessions
        .slice(0, 3)
        .map(
          (s) =>
            `${s.day ? s.day + ": " : ""}${s.description} (${s.distanceKmRange[0]}–${s.distanceKmRange[1]} km)`,
        ),
    ],
    recommendation:
      plan.warnings.find((w) => !w.includes("Not a substitute")) ?? plan.sessions[0]?.description,
    confidence: analytics.dataConfidence,
  });

  if (goalProgress) {
    insights.push({
      id: "weekly-goal",
      question: "next",
      title: goalProgress.met ? "Weekly run goal on track" : "Weekly run goal needs attention",
      severity: goalProgress.met ? "positive" : "warning",
      evidence: [
        `This week: ${goalProgress.currentWeekRuns} / ${goalProgress.targetPerWeek} runs.`,
        `Met goal in ${goalProgress.weeksMet} of ${goalProgress.weeksTotal} weeks since start.`,
      ],
      recommendation: goalProgress.met
        ? undefined
        : `Schedule ${Math.max(0, goalProgress.targetPerWeek - goalProgress.currentWeekRuns)} more run(s) this week.`,
      confidence: "high",
    });
  } else {
    insights.push({
      id: "no-goal",
      question: "next",
      title: "Set a weekly run goal in Strava",
      severity: "neutral",
      evidence: ["No weekly run goal found in your export."],
      recommendation: "Add a count-based weekly run goal in Strava to track consistency here.",
      confidence: "high",
    });
  }

  // What changed recently?
  insights.push({
    id: "weekly-narrative",
    question: "changed",
    title: `This week (${weeklyNarrative.weekLabel})`,
    severity: weeklyNarrative.severity,
    evidence: weeklyNarrative.bullets,
    recommendation:
      weeklyNarrative.severity === "warning" && analytics.currentWeek.runCount === 0
        ? "Resume with an easy run if returning from rest."
        : weeklyNarrative.severity === "warning" &&
            analytics.currentWeek.hardCount > analytics.currentWeek.easyCount
          ? "Add 1–2 easy runs this week to balance intensity."
          : undefined,
    confidence: weeklyNarrative.confidence,
  });

  if (summary.last7DaysRuns === 0 && analytics.currentWeek.runCount === 0) {
    insights.push({
      id: "no-recent",
      question: "changed",
      title: "No runs in the last 7 days",
      severity: "warning",
      evidence: ["Recent training gap may affect fitness and readiness scores."],
      recommendation: "Resume with an easy run if returning from rest.",
      confidence: "high",
    });
  }

  if (quality.warnings.length > 0) {
    insights.push({
      id: "data-quality",
      question: "changed",
      title: "Data quality notes",
      severity: "neutral",
      evidence: quality.warnings,
      confidence: quality.overallConfidence,
    });
  }

  insights.push(...generateEcosystemInsights(analytics.trainingEcosystem));

  return insights;
}

export function insightsByQuestion(insights: Insight[]): Record<string, Insight[]> {
  const map: Record<string, Insight[]> = {};
  for (const i of insights) {
    (map[i.question] ??= []).push(i);
  }
  return map;
}

export function topInsightForHome(insights: Insight[]): Insight | null {
  const planInsight = insights.find((i) => i.id === "next-week-plan");
  if (planInsight) return planInsight;

  const priority = ["warning", "positive", "neutral"] as const;
  for (const sev of priority) {
    const found = insights.find((i) => i.severity === sev && i.question === "next");
    if (found) return found;
  }
  return insights.find((i) => i.severity === "warning") ?? insights[0] ?? null;
}
