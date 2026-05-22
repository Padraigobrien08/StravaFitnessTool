"use client";

import { useMemo } from "react";
import { useGoalStore } from "@/stores/goal-store";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import {
  getAthleteIntelligenceState,
  getActiveSignals,
  getCoachDefaultInvestigation,
  getLongitudinalMemory,
  getPrimaryRecommendation,
  getRisksAndOpportunities,
  getTrainingEcosystem,
  getTrajectorySeries,
  getCoachingStateBullets,
} from "@/lib/intelligence/athleteState";

/** Shared intelligence model for /intelligence and /coach */
export function useAthleteIntelligence(
  threadMessages: import("@/lib/coach/types").CoachMessage[] = []
) {
  const { analytics, insights, loading, quality, dataset } =
    useTrainingIntelligence();
  const raceGoal = useGoalStore((s) => s.raceGoal);

  return useMemo(() => {
    const state = getAthleteIntelligenceState(
      analytics,
      insights,
      raceGoal,
      threadMessages
    );

    if (!analytics || !state) {
      return {
        loading,
        analytics: null,
        state: null,
        raceGoal,
        quality,
        dataset,
        signals: [],
        memory: [],
        risksAndOpportunities: [],
        ecosystem: null,
        trajectories: [],
        primaryRecommendation: null,
        coachingBullets: [],
        defaultInvestigation: null,
      };
    }

    return {
      loading,
      analytics,
      state,
      raceGoal,
      quality,
      dataset,
      signals: getActiveSignals(state),
      memory: getLongitudinalMemory(state),
      risksAndOpportunities: getRisksAndOpportunities(state),
      ecosystem: getTrainingEcosystem(analytics),
      trajectories: getTrajectorySeries(analytics),
      primaryRecommendation: getPrimaryRecommendation(state, analytics),
      coachingBullets: getCoachingStateBullets(state, analytics),
      defaultInvestigation: getCoachDefaultInvestigation(analytics, raceGoal),
    };
  }, [
    analytics,
    insights,
    raceGoal,
    threadMessages,
    loading,
    quality,
    dataset,
  ]);
}
