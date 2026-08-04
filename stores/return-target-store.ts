import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The weekly volume a returning athlete is rebuilding toward.
 *
 * Measurement over seven real gaps found every backward-looking estimator wrong
 * by 2× or more, in both directions, because the sign of the error depends on
 * whether the athlete was building or winding down before they stopped — which
 * their volume history cannot show. The athlete knows instantly. This holds
 * their answer. See docs/proposals/return-baseline.md.
 *
 * Null means "not chosen", which the model reads as the pre-gap default rather
 * than as a target of zero.
 */
interface ReturnTargetState {
  weeklyKm: number | null;
  setWeeklyKm: (km: number) => void;
  clearWeeklyKm: () => void;
}

export const useReturnTargetStore = create<ReturnTargetState>()(
  persist(
    (set) => ({
      weeklyKm: null,
      setWeeklyKm: (weeklyKm) => set({ weeklyKm: weeklyKm > 0 ? weeklyKm : null }),
      clearWeeklyKm: () => set({ weeklyKm: null }),
    }),
    { name: "strideiq-return-target-v1" },
  ),
);
