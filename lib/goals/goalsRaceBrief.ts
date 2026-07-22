import type { RaceGoal, RaceReadiness } from "@/lib/analytics/readiness";
import { coachUrl } from "@/lib/coach/domainLinks";
import type { ForecastV2View } from "@/lib/goals/forecastV2ViewModel";
import { formatDuration } from "@/lib/utils";

export interface GoalsCoachPrompt {
  label: string;
  href: string;
}

export interface GoalsRaceBriefView {
  headline: string;
  belief: string;
  primaryAction: string;
  evidenceBullets: string[];
  confidenceLine: string;
  warnings: string[];
  coachPrompts: GoalsCoachPrompt[];
  mostLikely: string;
  rangeDisplay: string;
  distanceLabel: string;
  targetTimeDisplay: string | null;
  readinessScore: number | null;
  readinessLabel: string | null;
}

function stripRecommendationPrefix(text: string): string {
  return text.replace(/^Recommendation:\s*/i, "").trim();
}

function formatEffortClause(forecast: ForecastV2View): string | null {
  const efforts = forecast.keyEfforts;
  if (efforts.length === 0) return null;

  const parts = efforts.slice(0, 2).map((e) => {
    const dist =
      e.distanceKm >= 20
        ? `${e.distanceKm.toFixed(1)} km`
        : e.distanceKm >= 15.5
          ? "10-mile"
          : `${e.distanceKm.toFixed(1)} km`;
    return `${dist} (${e.time})`;
  });

  if (parts.length === 1) {
    return `Your recent ${parts[0]} run`;
  }
  return `Your recent efforts — ${parts.join(" and ")}`;
}

function buildBelief(forecast: ForecastV2View, goal: RaceGoal | null): string {
  const effortClause = formatEffortClause(forecast);
  const opener = effortClause
    ? `${effortClause} support a ${forecast.distanceLabel.toLowerCase()} around ${forecast.mostLikely} (realistic range ${forecast.rangeDisplay}).`
    : `Current training supports a ${forecast.distanceLabel.toLowerCase()} around ${forecast.mostLikely} (realistic range ${forecast.rangeDisplay}).`;

  if (goal?.targetTimeSec != null && forecast.targetGapDisplay) {
    const target = formatDuration(goal.targetTimeSec);
    if (forecast.targetRealistic) {
      return `${opener} Your ${target} goal aligns with this forecast.`;
    }
    return `${opener} Your ${target} goal is more ambitious — ${forecast.targetGapDisplay.toLowerCase()}.`;
  }

  return opener;
}

function buildEvidenceBullets(forecast: ForecastV2View): string[] {
  const bullets: string[] = [];

  for (const c of forecast.positiveContributors.slice(0, 2)) {
    bullets.push(`${c.label} — ${c.evidence}`);
  }
  for (const c of forecast.negativeContributors.slice(0, 3)) {
    bullets.push(`${c.label} — ${c.evidence}`);
  }
  if (bullets.length < 4) {
    for (const d of forecast.uncertaintyDrivers.slice(0, 2)) {
      if (bullets.length >= 5) break;
      bullets.push(`${d.label} (${d.impact} impact) — ${d.explanation}`);
    }
  }

  return bullets.slice(0, 5);
}

function buildConfidenceLine(forecast: ForecastV2View): string {
  const drivers = forecast.uncertaintyDrivers.slice(0, 2).map((d) => d.label.toLowerCase());
  const why = drivers.length > 0 ? ` — mainly because of ${drivers.join(" and ")}.` : ".";
  return `${forecast.confidence} confidence${why} Model agreement is ${forecast.modelAgreement.label} (spread ${forecast.modelAgreement.spread}).`;
}

function buildCoachPrompts(forecast: ForecastV2View, goal: RaceGoal | null): GoalsCoachPrompt[] {
  const prompts: GoalsCoachPrompt[] = [
    {
      label: "Why this forecast?",
      href: coachUrl({
        q: `Why is my ${forecast.distanceLabel} forecast ${forecast.mostLikely}? Walk through the evidence.`,
        investigate: true,
      }),
    },
  ];

  const topEffort = forecast.keyEfforts[0];
  if (topEffort) {
    prompts.push({
      label: `Compare to ${topEffort.label}`,
      href: coachUrl({
        q: `How does my ${topEffort.distanceKm.toFixed(1)} km in ${topEffort.time} affect my ${forecast.distanceLabel} forecast of ${forecast.mostLikely}?`,
        investigate: true,
      }),
    });
  }

  if (goal?.targetTimeSec) {
    prompts.push({
      label: `Can I hit ${formatDuration(goal.targetTimeSec)}?`,
      href: coachUrl({
        q: `My ${forecast.distanceLabel} forecast is ${forecast.mostLikely} but my goal is ${formatDuration(goal.targetTimeSec)}. What would need to change?`,
        investigate: true,
      }),
    });
  } else {
    prompts.push({
      label: "Race-week plan",
      href: coachUrl({
        domain: "race_prep",
        q: "What should I prioritize in the final week before my race?",
        investigate: true,
      }),
    });
  }

  return prompts.slice(0, 4);
}

export function buildGoalsRaceBrief(opts: {
  forecast: ForecastV2View;
  goal: RaceGoal | null;
  readiness: RaceReadiness | null;
}): GoalsRaceBriefView {
  const { forecast, goal, readiness } = opts;
  const targetTimeDisplay = goal?.targetTimeSec ? formatDuration(goal.targetTimeSec) : null;

  return {
    headline: `${forecast.mostLikely} ${forecast.distanceLabel}`,
    belief: buildBelief(forecast, goal),
    primaryAction: stripRecommendationPrefix(forecast.recommendation),
    evidenceBullets: buildEvidenceBullets(forecast),
    confidenceLine: buildConfidenceLine(forecast),
    warnings: forecast.observability.warnings.slice(0, 4),
    coachPrompts: buildCoachPrompts(forecast, goal),
    mostLikely: forecast.mostLikely,
    rangeDisplay: forecast.rangeDisplay,
    distanceLabel: forecast.distanceLabel,
    targetTimeDisplay,
    readinessScore: readiness?.score ?? null,
    readinessLabel: readiness?.label ?? null,
  };
}
