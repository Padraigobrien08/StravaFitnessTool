"use client";

import { useMemo } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import {
  distanceUnitLabel,
  formatDistance,
  formatDistanceFromMeters,
  formatDistanceRange,
  formatDistanceValue,
  formatPaceInUnit,
  paceUnitLabel,
  type UnitPreferences,
} from "@/lib/units";

export interface UnitFormatters extends UnitPreferences {
  /** "412 km" / "256 mi" */
  distance: (km: number) => string;
  /** bare number, no unit — for ranges and chips */
  distanceValue: (km: number) => string;
  /** "6–8 km" / "4–5 mi" */
  distanceRange: (loKm: number, hiKm: number) => string;
  /** distance from meters with unit */
  distanceFromMeters: (meters: number) => string;
  /** "5:00/km" / "8:03/mi" (input is sec per km) */
  pace: (secPerKm: number) => string;
  /** "km" / "mi" */
  distanceLabel: string;
  /** "/km" / "/mi" */
  paceLabel: string;
}

/**
 * Reactive, unit-aware formatters bound to the athlete's saved preference.
 * Components re-render when the unit changes because they subscribe to the store.
 */
export function useUnitFormat(): UnitFormatters {
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const paceUnit = useSettingsStore((s) => s.paceUnit);

  return useMemo(
    () => ({
      distanceUnit,
      paceUnit,
      distance: (km: number) => formatDistance(km, distanceUnit),
      distanceValue: (km: number) => formatDistanceValue(km, distanceUnit),
      distanceRange: (loKm: number, hiKm: number) => formatDistanceRange(loKm, hiKm, distanceUnit),
      distanceFromMeters: (meters: number) => formatDistanceFromMeters(meters, distanceUnit),
      pace: (secPerKm: number) => formatPaceInUnit(secPerKm, paceUnit),
      distanceLabel: distanceUnitLabel(distanceUnit),
      paceLabel: paceUnitLabel(paceUnit),
    }),
    [distanceUnit, paceUnit],
  );
}
