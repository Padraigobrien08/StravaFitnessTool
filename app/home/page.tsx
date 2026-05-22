"use client";

import { useMemo, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import {
  buildHeroView,
  buildThisWeekOps,
  buildNextWeekOps,
  buildInsightRows,
  buildProgressionView,
  buildGoalMission,
} from "@/lib/home/dashboardData";
import { OperationalDashboard, OpsWeekRow, OpsIntelRow } from "@/components/home/primitives/operational-dashboard";
import { DashboardSkeleton } from "@/components/home/primitives/dashboard-skeleton";
import { HomeCommandBar } from "@/components/home/home-command-bar";
import { HeroIntelligence } from "@/components/home/hero-intelligence";
import { WeekOpsPanel } from "@/components/home/week-ops-panel";
import { InsightsEnginePanel } from "@/components/home/insights-engine-panel";
import { ProgressionMomentumPanel } from "@/components/home/progression-momentum-panel";
import { GoalMissionControl } from "@/components/home/goal-mission-control";
import { DataQualityFooter } from "@/components/home/data-quality-footer";

export default function HomePage() {
  const {
    apiConnected,
    dataSourceLabel,
    refreshFromStravaApi,
    loading,
  } = useStrava();
  const { insights, analytics, quality } = useTrainingIntelligence();
  const [syncing, setSyncing] = useState(false);

  const vm = useMemo(() => {
    if (!analytics) return null;
    return {
      hero: buildHeroView(insights, analytics),
      thisWeek: buildThisWeekOps(analytics),
      nextWeek: buildNextWeekOps(analytics),
      insightRows: buildInsightRows(analytics, insights),
      progression: buildProgressionView(analytics, insights),
      goal: buildGoalMission(analytics),
    };
  }, [analytics, insights]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await refreshFromStravaApi();
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !analytics) {
    return <DashboardSkeleton />;
  }

  return (
    <RequireData>
      {analytics && quality && vm && (
        <div className="dashboard-enter w-full">
          <OperationalDashboard>
            <HomeCommandBar
              apiConnected={apiConnected}
              confidence={analytics.dataConfidence}
              syncing={syncing || loading}
              onSync={() => void handleSync()}
              mobileSummary={{
                title: vm.hero.title,
                readinessScore: vm.hero.readinessScore,
                freshness: vm.hero.freshness,
              }}
            />

            <HeroIntelligence hero={vm.hero} />

            <OpsIntelRow>
              <InsightsEnginePanel rows={vm.insightRows} />
              <ProgressionMomentumPanel data={vm.progression} />
            </OpsIntelRow>

            <OpsWeekRow>
              <WeekOpsPanel title="This week" ops={vm.thisWeek} href="/report" />
              <WeekOpsPanel title="Next week" ops={vm.nextWeek} href="/training" />
            </OpsWeekRow>

            <GoalMissionControl goal={vm.goal} />

            <DataQualityFooter report={quality} />
          </OperationalDashboard>
        </div>
      )}
    </RequireData>
  );
}
