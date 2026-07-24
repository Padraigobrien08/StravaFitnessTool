"use client";

import { useMemo, useState } from "react";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import { useGoalStore } from "@/stores/goal-store";
import { buildGoalsPageView } from "@/lib/goals/viewModels";
import { GoalsWorkspace, GoalsIntelRow } from "@/components/goals/goals-workspace";
import { CompactRaceGoalForm } from "@/components/goals/compact-race-goal-form";
import { RaceMissionHero } from "@/components/goals/race-mission-hero";
import { ReadinessIntelligencePanel } from "@/components/goals/readiness-intelligence-panel";
import { PredictionIntegrityPanel } from "@/components/goals/prediction-integrity-panel";
import { ExecutionIntelligencePanel } from "@/components/goals/execution-intelligence-panel";
import { TrajectoryForecastPanel } from "@/components/goals/trajectory-forecast-panel";
import { ProjectionCurvePanel } from "@/components/goals/projection-curve-panel";
import { PredictionConsensusPanel } from "@/components/goals/prediction-consensus-panel";
import { GoalRisksPanel } from "@/components/goals/goal-risks-panel";
import { GoalsExplainability } from "@/components/goals/goals-explainability";
import { HistoricalReadinessPanel } from "@/components/goals/historical-readiness-panel";
import { ForecastV2Panel } from "@/components/goals/forecast-v2-panel";
import { GoalScenariosPanel } from "@/components/goals/goal-scenarios-panel";
import { GoalsRaceBrief } from "@/components/goals/goals-race-brief";
import { GoalsEvidenceDrawer } from "@/components/goals/goals-evidence-drawer";
import { GenerateWeekPlanButton } from "@/components/planning/generate-week-plan-button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

/**
 * The race-goal view. Lives inside Plan as the "Race goal" tab — a goal is the
 * target the weekly plan aims at, so setting it and planning around it share
 * one destination. Assumes data is present (callers wrap in RequireData).
 */
export function RaceGoalWorkspace() {
  const { analytics, insights } = useTrainingIntelligence();
  const { importData, fitDetails } = useStrava();
  const raceGoal = useGoalStore((s) => s.raceGoal);
  const readyInsights = insights.filter((i) => i.question === "ready");
  const [showLegacyV1, setShowLegacyV1] = useState(false);

  const view = useMemo(() => {
    if (!analytics) return null;
    return buildGoalsPageView(analytics, raceGoal, readyInsights, {
      runs: importData?.runs,
      fitDetails,
    });
  }, [analytics, raceGoal, readyInsights, importData?.runs, fitDetails]);

  const trajectoryNarrative = useMemo(() => {
    const item = view?.historical.find((h) => h.label === "Projection trajectory");
    return item?.value ?? null;
  }, [view?.historical]);

  const useBriefLayout = Boolean(view?.raceBrief && view?.forecastV2);

  if (!view || !analytics) {
    return (
      <div className="dashboard-enter w-full space-y-4 pb-8">
        <div className="skeleton-shimmer h-52 w-full rounded-xl" />
        <div className="skeleton-shimmer h-64 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton-shimmer h-56 rounded-xl" />
          <div className="skeleton-shimmer h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <GoalsWorkspace>
      <CompactRaceGoalForm />

      {raceGoal ? <GenerateWeekPlanButton label="Generate next week" /> : null}

      {useBriefLayout && view.raceBrief && view.forecastV2 ? (
        <>
          <GoalsRaceBrief brief={view.raceBrief} />
          {view.scenarios ? <GoalScenariosPanel scenarios={view.scenarios} /> : null}
          <GoalsEvidenceDrawer
            forecast={view.forecastV2}
            showLegacy={showLegacyV1}
            projection={view.projection}
            consensus={view.consensus}
            analysis={analytics.racePredictionAnalysis}
          />
          {!showLegacyV1 ? (
            <button
              type="button"
              onClick={() => setShowLegacyV1(true)}
              className="text-left text-xs text-zinc-600 underline-offset-2 hover:text-zinc-500 hover:underline"
            >
              Compare legacy V1 estimate
            </button>
          ) : null}
        </>
      ) : (
        <>
          <RaceMissionHero hero={view.hero} />
          {view.forecastV2 ? <ForecastV2Panel forecast={view.forecastV2} /> : null}
          {view.scenarios ? <GoalScenariosPanel scenarios={view.scenarios} /> : null}
          <GoalsIntelRow>
            <div className="lg:col-span-7">
              <PredictionIntegrityPanel projection={view.projection} />
            </div>
            <div className="lg:col-span-5">
              <PredictionConsensusPanel
                rows={view.consensus}
                analysis={analytics.racePredictionAnalysis}
              />
            </div>
          </GoalsIntelRow>
        </>
      )}

      <ReadinessIntelligencePanel dimensions={view.dimensions} readiness={view.readiness} />

      {raceGoal ? (
        <ExecutionIntelligencePanel raceGoal={raceGoal} analytics={analytics} />
      ) : (
        <section className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
          <p className="text-sm text-zinc-500">
            Set a race mission above to unlock execution intelligence and segment pacing plans.
          </p>
        </section>
      )}

      <CollapsibleSection
        variant="card"
        title="Deeper forecast analysis"
        summary="trajectory, risks, and the full explanation"
      >
        <TrajectoryForecastPanel
          timeline={analytics.predictionTimeline}
          narrative={trajectoryNarrative}
          goalDistance={raceGoal?.distance ?? null}
        />

        {!useBriefLayout ? (
          <ProjectionCurvePanel
            projection={view.projection}
            targetDistanceLabel={view.targetDistanceLabel}
          />
        ) : null}

        <GoalsIntelRow>
          <div className="lg:col-span-7">
            <GoalRisksPanel risks={view.risks} />
          </div>
          <div className="lg:col-span-5">
            <HistoricalReadinessPanel items={view.historical} />
          </div>
        </GoalsIntelRow>

        <GoalsExplainability data={view.explain} confidence={analytics.dataConfidence} />
      </CollapsibleSection>
    </GoalsWorkspace>
  );
}
