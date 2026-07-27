"use client";

import { useMemo, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useAthleteIntelligence } from "@/hooks/use-athlete-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import { useGoalStore, RACE_DISTANCE_LABELS } from "@/stores/goal-store";
import { isRaceUpcoming } from "@/lib/analytics/readiness";
import { buildHomeOperatingSystemView } from "@/lib/home/operatingSystemView";
import { HomeConsole } from "@/components/home/console/home-console";
import { DashboardSkeleton } from "@/components/home/primitives/dashboard-skeleton";
import { useWeeklyPlan } from "@/hooks/use-weekly-plan";
import { useTrainingCalendar } from "@/hooks/use-training-calendar";

export default function HomePage() {
  const { apiConnected, dataSourceLabel, refreshFromStravaApi, loading, error } = useStrava();
  const { analytics, insights, loading: intelLoading } = useTrainingIntelligence();
  const intel = useAthleteIntelligence();
  const { generate, loading: planLoading } = useWeeklyPlan();
  const calendar = useTrainingCalendar();
  const raceGoal = useGoalStore((s) => s.raceGoal);
  const [syncing, setSyncing] = useState(false);

  // A saved goal whose date has passed: kept, but surfaced as a prompt to set the next one.
  const pastRace = useMemo(() => {
    if (!raceGoal || isRaceUpcoming(raceGoal)) return null;
    return { label: RACE_DISTANCE_LABELS[raceGoal.distance], date: raceGoal.date };
  }, [raceGoal]);

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

  return (
    <RequireData>
      {analytics && vm && (
        <div className="dashboard-enter mx-auto w-full max-w-6xl px-0 pb-6">
          <HomeConsole
            vm={vm}
            analytics={analytics}
            savedWeek={calendar.savedWeek}
            calendarHydrated={calendar.hydrated}
            onGeneratePlan={() => void generate()}
            planLoading={planLoading}
            onSync={() => void handleSync()}
            syncing={syncing || loading}
            syncError={error}
            apiConnected={apiConnected}
            dataSourceLabel={dataSourceLabel}
            pastRace={pastRace}
          />
        </div>
      )}
    </RequireData>
  );
}
