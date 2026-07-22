/**
 * Unit-aware display formatting.
 *
 * All data in StrideIQ is stored **metric** (`distanceKm`, `paceSecPerKm`,
 * `distanceM`). These helpers convert + label at the display boundary so the
 * athlete's saved `distanceUnit`/`paceUnit` preference is honored everywhere.
 *
 * Pure and framework-free — server code can call them with an explicit unit,
 * and the client binds them to the settings store via `useUnitFormat()`.
 */
import type { DistanceUnit, PaceUnit } from "@/stores/settings-store";

export const KM_PER_MILE = 1.609344;

export interface UnitPreferences {
  distanceUnit: DistanceUnit;
  paceUnit: PaceUnit;
}

/** Metric default — server/LLM paths and untouched callers use this. */
export const DEFAULT_UNITS: UnitPreferences = { distanceUnit: "km", paceUnit: "min/km" };

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function milesToKm(mi: number): number {
  return mi * KM_PER_MILE;
}

/** Convert a metric km value to the display unit's numeric value. */
export function distanceValueIn(km: number, unit: DistanceUnit): number {
  return unit === "mi" ? kmToMiles(km) : km;
}

/** Short label for the distance unit, e.g. "km" or "mi". */
export function distanceUnitLabel(unit: DistanceUnit): string {
  return unit === "mi" ? "mi" : "km";
}

/** Short label for the pace unit, e.g. "/km" or "/mi". */
export function paceUnitLabel(unit: PaceUnit): string {
  return unit === "min/mi" ? "/mi" : "/km";
}

function trimNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Math.abs(rounded - Math.round(rounded)) < 0.05
    ? String(Math.round(rounded))
    : rounded.toFixed(1);
}

/** Bare distance number in the display unit, no suffix (chips, ranges). */
export function formatDistanceValue(km: number, unit: DistanceUnit): string {
  if (!Number.isFinite(km)) return "—";
  return trimNumber(distanceValueIn(km, unit));
}

/** Distance with unit suffix, e.g. "412 km" / "256 mi". */
export function formatDistance(km: number, unit: DistanceUnit): string {
  if (!Number.isFinite(km)) return "—";
  return `${trimNumber(distanceValueIn(km, unit))} ${distanceUnitLabel(unit)}`;
}

/** Distance from meters with unit suffix. */
export function formatDistanceFromMeters(meters: number, unit: DistanceUnit): string {
  if (!Number.isFinite(meters)) return "—";
  return formatDistance(meters / 1000, unit);
}

/** Distance range with a single trailing unit, e.g. "6–8 km" / "4–5 mi". */
export function formatDistanceRange(loKm: number, hiKm: number, unit: DistanceUnit): string {
  return `${formatDistanceValue(loKm, unit)}–${formatDistanceValue(hiKm, unit)} ${distanceUnitLabel(unit)}`;
}

/** Pace (stored as sec per km) rendered as m:ss in the display pace unit. */
export function formatPaceInUnit(secPerKm: number, unit: PaceUnit): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const secPerDisplay = unit === "min/mi" ? secPerKm * KM_PER_MILE : secPerKm;
  const m = Math.floor(secPerDisplay / 60);
  const s = Math.round(secPerDisplay % 60);
  // Carry a rounded 60s into the minutes place.
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${ss.toString().padStart(2, "0")}${paceUnitLabel(unit)}`;
}
