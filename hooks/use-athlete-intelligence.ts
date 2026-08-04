"use client";

import { useMemo } from "react";
import { useGoalStore } from "@/stores/goal-store";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import {
  getAthleteIntelligenceState,
  getActiveSignals,
  getCoachDefaultInvestigation,
  getPrimaryRecommendation,
  getRisksAndOpportunities,
  getTrainingEcosystem,
  getTrajectorySeries,
  getCoachingStateBullets,
} from "@/lib/intelligence/athleteState";
import { buildAdaptiveSnapshotFromAnalytics } from "@/lib/intelligence/adaptiveState";
import { dedupeIntelligenceSlots } from "@/lib/intelligence/presentation";
import { beliefsToMemoryDisplay } from "@/lib/athlete-memory";

/** Shared intelligence model for /intelligence and /coach */
export function useAthleteIntelligence(
  threadMessages: import("@/lib/coach/types").CoachMessage[] = [],
) {
  const { analytics, insights, loading, quality } = useTrainingIntelligence();
  const { importData } = useStrava();
  const raceGoal = useGoalStore((s) => s.raceGoal);

  return useMemo(() => {
    const state = getAthleteIntelligenceState(analytics, insights, raceGoal, threadMessages);

    if (!analytics || !state) {
      return {
        loading,
        analytics: null,
        state: null,
        raceGoal,
        quality,
        signals: [],
        memory: [],
        risksAndOpportunities: [],
        ecosystem: null,
        trajectories: [],
        primaryRecommendation: null,
        coachingBullets: [],
        defaultInvestigation: null,
        adaptive: null,
        recentlyLearned: [] as string[],
        adaptationSignals: [],
      };
    }

    const adaptive = buildAdaptiveSnapshotFromAnalytics(
      {
        analytics,
        insights,
        quality: quality!,
        runs: importData?.runs ?? [],
        fitDetails: [],
      },
      raceGoal,
    );

    // Each slot is generated independently, so the same sentence can arrive in
    // several of them at once; filter across them before rendering.
    const slots = dedupeIntelligenceSlots({
      primaryRecommendation: getPrimaryRecommendation(state, analytics),
      risksAndOpportunities: getRisksAndOpportunities(state),
      coachingBullets: getCoachingStateBullets(state, analytics),
      recentlyLearned: adaptive.recentlyLearned,
    });

    return {
      loading,
      analytics,
      state,
      raceGoal,
      quality,
      signals: getActiveSignals(state, analytics),
      memory: beliefsToMemoryDisplay(
        [
          ...adaptive.memory.adaptationPatterns,
          ...adaptive.memory.fatiguePatterns,
          ...adaptive.memory.pacingPatterns,
          ...adaptive.memory.taperResponses,
          ...adaptive.memory.durabilitySignals,
        ].slice(0, 6),
      ),
      risksAndOpportunities: slots.risksAndOpportunities,
      ecosystem: getTrainingEcosystem(analytics),
      trajectories: getTrajectorySeries(analytics),
      primaryRecommendation: slots.primaryRecommendation,
      coachingBullets: slots.coachingBullets,
      defaultInvestigation: getCoachDefaultInvestigation(analytics, raceGoal),
      adaptive,
      recentlyLearned: slots.recentlyLearned,
      adaptationSignals: adaptive.adaptationSignals,
      longitudinalComparisons: adaptive.longitudinalComparisons,
    };
  }, [analytics, insights, raceGoal, threadMessages, loading, quality, importData]);
}
