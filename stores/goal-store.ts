import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RaceGoal } from "@/lib/analytics/readiness";

export type { RaceDistance, RaceGoal } from "@/lib/analytics/readiness";
export { RACE_DISTANCE_LABELS } from "@/lib/analytics/readiness";

interface GoalState {
  raceGoal: RaceGoal | null;
  setRaceGoal: (goal: RaceGoal) => void;
  clearRaceGoal: () => void;
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set) => ({
      raceGoal: null,
      setRaceGoal: (raceGoal) => set({ raceGoal }),
      clearRaceGoal: () => set({ raceGoal: null }),
    }),
    { name: "strideiq-goal-store-v1" }
  )
);
