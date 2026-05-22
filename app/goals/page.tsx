"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useGoalStore } from "@/stores/goal-store";
import { buildGoalsPageView } from "@/lib/goals/viewModels";
import {
  GoalsWorkspace,
  GoalsIntelRow,
} from "@/components/goals/goals-workspace";
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
import { dash } from "@/components/home/primitives/tokens";

function GoalsBriefingBar() {
  return (
    <div className="border-b border-white/[0.04] pb-3">
      <p className={dash.labelAccent}>Race intelligence & goal planning</p>
      <p className="mt-0.5 text-xs text-zinc-600">
        Readiness · prediction integrity · execution · risks
      </p>
    </div>
  );
}

export default function GoalsPage() {
  const { analytics, insights, loading } = useTrainingIntelligence();
  const raceGoal = useGoalStore((s) => s.raceGoal);
  const readyInsights = insights.filter((i) => i.question === "ready");

  const view = useMemo(() => {
    if (!analytics) return null;
    return buildGoalsPageView(analytics, raceGoal, readyInsights);
  }, [analytics, raceGoal, readyInsights]);

  const trajectoryNarrative = useMemo(() => {
    const item = view?.historical.find((h) => h.label === "Projection trajectory");
    return item?.value ?? null;
  }, [view?.historical]);

  if (loading && !view) {
    return (
      <div className="dashboard-enter w-full space-y-4 pb-8">
        <div className="skeleton-shimmer h-10 w-full rounded-lg" />
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
    <RequireData>
      {view && analytics && (
        <GoalsWorkspace>
          <GoalsBriefingBar />
          <RaceMissionHero hero={view.hero} />
          <CompactRaceGoalForm />

          <ReadinessIntelligencePanel
            dimensions={view.dimensions}
            readiness={view.readiness}
          />

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

          {raceGoal ? (
            <ExecutionIntelligencePanel raceGoal={raceGoal} analytics={analytics} />
          ) : (
            <section className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">
                Set a race mission above to unlock execution intelligence and
                segment pacing plans.
              </p>
            </section>
          )}

          <TrajectoryForecastPanel
            timeline={analytics.predictionTimeline}
            narrative={trajectoryNarrative}
          />

          <ProjectionCurvePanel
            projection={view.projection}
            targetDistanceLabel={view.targetDistanceLabel}
          />

          <GoalsIntelRow>
            <div className="lg:col-span-7">
              <GoalRisksPanel risks={view.risks} />
            </div>
            <div className="lg:col-span-5">
              <HistoricalReadinessPanel items={view.historical} />
            </div>
          </GoalsIntelRow>

          <GoalsExplainability
            data={view.explain}
            confidence={analytics.dataConfidence}
          />

          <p className="text-center text-xs text-zinc-600">
            <Link href="/records" className="text-teal-400/90 hover:underline">
              View all records & PR timeline →
            </Link>
            {" · "}
            <Link href="/performance" className="text-teal-400/90 hover:underline">
              Performance intelligence →
            </Link>
          </p>
        </GoalsWorkspace>
      )}
    </RequireData>
  );
}
