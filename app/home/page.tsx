"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useAthleteIntelligence } from "@/hooks/use-athlete-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import { buildHomeOperatingSystemView } from "@/lib/home/operatingSystemView";
import { AthleteOperatingSystem } from "@/components/home/athlete-operating-system";
import { DashboardSkeleton } from "@/components/home/primitives/dashboard-skeleton";
import { HomeCommandBar } from "@/components/home/home-command-bar";
import { useWeeklyPlan } from "@/hooks/use-weekly-plan";
import { useTrainingCalendar } from "@/hooks/use-training-calendar";

export default function HomePage() {
  const {
    apiConnected,
    dataSourceLabel,
    refreshFromStravaApi,
    loading,
  } = useStrava();
  const { analytics, insights, loading: intelLoading } =
    useTrainingIntelligence();
  const intel = useAthleteIntelligence();
  const { generate, loading: planLoading } = useWeeklyPlan();
  const calendar = useTrainingCalendar();
  const [syncing, setSyncing] = useState(false);

  const vm = useMemo(() => {
    if (!analytics) return null;
    return buildHomeOperatingSystemView({
      analytics,
      insights,
      state: intel.state,
      risksAndOpportunities: intel.risksAndOpportunities,
      savedWeek: calendar.savedWeek,
      signals: intel.signals,
      memory: intel.memory,
      recentlyLearned: intel.recentlyLearned,
      adaptationSignals: intel.adaptationSignals.map((s) => s.statement),
    });
  }, [
    analytics,
    intel.state,
    intel.risksAndOpportunities,
    intel.signals,
    intel.memory,
    intel.recentlyLearned,
    intel.adaptationSignals,
    insights,
    calendar.savedWeek,
  ]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await refreshFromStravaApi();
    } finally {
      setSyncing(false);
    }
  };

  if ((loading || intelLoading) && !analytics) {
    return <DashboardSkeleton />;
  }

  const readinessScore =
    analytics?.raceReadiness?.score ??
    analytics?.halfMarathonReadiness.score ??
    0;

  return (
    <RequireData>
      {analytics && vm && (
        <div className="dashboard-enter mx-auto w-full max-w-6xl space-y-3 px-0 pb-6">
          <HomeCommandBar
            apiConnected={apiConnected}
            confidence={analytics.dataConfidence}
            syncing={syncing || loading}
            onSync={() => void handleSync()}
            mobileSummary={{
              title: vm.hero.focusTitle,
              readinessScore,
              freshness: analytics.fatigue.freshness,
            }}
          />

          <AthleteOperatingSystem
            vm={vm}
            savedWeek={calendar.savedWeek}
            calendarHydrated={calendar.hydrated}
            onPatchWorkout={calendar.patchWorkout}
            onGeneratePlan={() => void generate()}
            planLoading={planLoading}
          />

          <p className="border-t border-[var(--border-subtle)] pt-3 text-[10px] text-zinc-600">
            {dataSourceLabel ? `${dataSourceLabel} · ` : ""}
            Deep analytics →{" "}
            <Link
              href="/intelligence"
              className="text-zinc-500 hover:text-zinc-400"
            >
              Intelligence
            </Link>
            {" · "}
            <Link
              href="/performance"
              className="text-zinc-500 hover:text-zinc-400"
            >
              Performance
            </Link>
          </p>
        </div>
      )}
    </RequireData>
  );
}
