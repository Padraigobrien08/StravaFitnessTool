import { useMemo } from "react";
import type { Theme } from "@/stores/theme-store";
import { useThemeStore } from "@/stores/theme-store";

export type TrainingChartTheme = {
  tick: { fontSize: number; fill: string };
  grid: string;
  tooltip: {
    backgroundColor: string;
    border: string;
    borderRadius: number;
    fontSize: number;
    color: string;
  };
  teal: string;
  tealFill: string;
  amber: string;
  amberFill: string;
};

const themes: Record<Theme, TrainingChartTheme> = {
  dark: {
    tick: { fontSize: 10, fill: "#71717a" },
    grid: "rgba(255,255,255,0.04)",
    tooltip: {
      backgroundColor: "#121316",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8,
      fontSize: 12,
      color: "#fafafa",
    },
    teal: "#2dd4bf",
    tealFill: "rgba(45, 212, 191, 0.18)",
    amber: "#fbbf24",
    amberFill: "rgba(251, 191, 36, 0.12)",
  },
  light: {
    tick: { fontSize: 10, fill: "#52525b" },
    grid: "rgba(0,0,0,0.06)",
    tooltip: {
      backgroundColor: "#ffffff",
      border: "1px solid rgba(0,0,0,0.1)",
      borderRadius: 8,
      fontSize: 12,
      color: "#18181b",
    },
    teal: "#0d9488",
    tealFill: "rgba(13, 148, 136, 0.15)",
    amber: "#d97706",
    amberFill: "rgba(217, 119, 6, 0.12)",
  },
};

/** Static dark theme — prefer `useTrainingChart()` in client components. */
export const trainingChart = themes.dark;

export function getTrainingChartTheme(theme: Theme): TrainingChartTheme {
  return themes[theme];
}

export function useTrainingChart(): TrainingChartTheme {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => themes[theme], [theme]);
}

/** Recharts grid stroke — reads CSS variable for instant theme sync. */
export const CHART_GRID_STROKE = "var(--chart-grid)";
