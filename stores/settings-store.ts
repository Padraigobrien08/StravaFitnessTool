import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DistanceUnit = "km" | "mi";
export type PaceUnit = "min/km" | "min/mi";

interface SettingsState {
  distanceUnit: DistanceUnit;
  paceUnit: PaceUnit;
  /** Used when Strava export has no weekly run-count goal */
  defaultWeeklyRuns: number;
  /** Cap for adaptive weekly plan (km); 0 = auto from history */
  maxWeeklyKm: number;
  setDistanceUnit: (u: DistanceUnit) => void;
  setPaceUnit: (u: PaceUnit) => void;
  setDefaultWeeklyRuns: (n: number) => void;
  setMaxWeeklyKm: (n: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      distanceUnit: "km",
      paceUnit: "min/km",
      defaultWeeklyRuns: 3,
      maxWeeklyKm: 0,
      setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
      setPaceUnit: (paceUnit) => set({ paceUnit }),
      setDefaultWeeklyRuns: (defaultWeeklyRuns) => set({ defaultWeeklyRuns }),
      setMaxWeeklyKm: (maxWeeklyKm) => set({ maxWeeklyKm }),
    }),
    { name: "strideiq-settings-v1" },
  ),
);
