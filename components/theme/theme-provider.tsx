"use client";

import { useEffect } from "react";
import { applyThemeClass, useThemeStore } from "@/stores/theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  return children;
}
