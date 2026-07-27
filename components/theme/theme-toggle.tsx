"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className={cn("gap-2", className)}
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
    </Button>
  );
}

export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useThemeStore();

  return (
    <ToggleGroup
      value={[theme]}
      onValueChange={(values) => {
        const next = values[0];
        if (next === "dark" || next === "light") setTheme(next);
      }}
      variant="outline"
      size="sm"
      className={className}
      aria-label="Color theme"
    >
      {(["dark", "light"] as const).map((value) => (
        <ToggleGroupItem
          key={value}
          value={value}
          className="capitalize data-pressed:bg-accent/15 data-pressed:text-accent dark:data-pressed:text-accent"
        >
          {value}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
