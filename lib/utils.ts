import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

export function formatDistanceKm(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  return formatKm(meters / 1000);
}

/** Display km without floating-point noise (e.g. 412.3 km not 412.3000000001). */
export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return "—";
  const rounded = Math.round(km * 10) / 10;
  const text =
    Math.abs(rounded - Math.round(rounded)) < 0.05
      ? String(Math.round(rounded))
      : rounded.toFixed(1);
  return `${text} km`;
}

/** Compact km number for ranges and chips (no unit suffix). */
export function formatKmValue(km: number): string {
  if (!Number.isFinite(km)) return "—";
  const rounded = Math.round(km * 10) / 10;
  return Math.abs(rounded - Math.round(rounded)) < 0.05
    ? String(Math.round(rounded))
    : rounded.toFixed(1);
}

export function formatKmRange(lo: number, hi: number): string {
  return `${formatKmValue(lo)}–${formatKmValue(hi)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export function parseNum(value: string | undefined): number | null {
  if (value === undefined || value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
