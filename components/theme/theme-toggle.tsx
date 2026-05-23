"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";

export function ThemeToggle({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        className
      )}
      aria-pressed={isLight}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      {isLight ? (
        <Moon className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
      ) : (
        <Sun className="h-3.5 w-3.5 text-amber-300/90" aria-hidden />
      )}
      {showLabel ? (
        <span>{isLight ? "Dark" : "Light"}</span>
      ) : (
        <span className="sr-only">{isLight ? "Dark mode" : "Light mode"}</span>
      )}
    </button>
  );
}

export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useThemeStore();

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--surface)] p-0.5",
        className
      )}
      role="group"
      aria-label="Color theme"
    >
      {(["dark", "light"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
            theme === value
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
          aria-pressed={theme === value}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
