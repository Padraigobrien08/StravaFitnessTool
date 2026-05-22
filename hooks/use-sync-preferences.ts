"use client";

import { useEffect, useRef } from "react";
import { useGoalStore } from "@/stores/goal-store";
import { useSettingsStore } from "@/stores/settings-store";
import { sanitizeRaceGoalForApi } from "@/lib/preferences/sanitize";

/** Sync client goal/settings to server for MCP + coach parity */
export function useSyncPreferences(enabled: boolean) {
  const raceGoal = useGoalStore((s) => s.raceGoal);
  const defaultWeeklyRuns = useSettingsStore((s) => s.defaultWeeklyRuns);
  const maxWeeklyKm = useSettingsStore((s) => s.maxWeeklyKm);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const safeGoal = sanitizeRaceGoalForApi(raceGoal);
      const runs = Math.round(Number(defaultWeeklyRuns));
      const km = Number(maxWeeklyKm);
      if (!Number.isFinite(runs) || runs < 1 || runs > 14) return;
      if (!Number.isFinite(km) || km < 0) return;

      void fetch("/api/me/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultWeeklyRuns: runs,
          maxWeeklyKm: km,
          raceGoal: safeGoal,
        }),
      }).catch(() => {
        /* non-fatal */
      });
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, raceGoal, defaultWeeklyRuns, maxWeeklyKm]);
}
