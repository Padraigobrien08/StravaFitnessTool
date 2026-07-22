"use client";

import { cn } from "@/lib/utils";
import { dash } from "./tokens";

export function DashboardPanel({
  children,
  className,
  hover = true,
  variant = "default",
  subdued = false,
  elevated = false,
  padding,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  variant?: "default" | "hero" | "flat";
  subdued?: boolean;
  elevated?: boolean;
  padding?: "none" | "compact" | "default" | "hero" | "rail";
}) {
  const pad =
    padding === "none"
      ? ""
      : padding === "compact"
        ? dash.padCompact
        : padding === "hero"
          ? dash.padHero
          : padding === "rail"
            ? dash.padRail
            : dash.pad;

  const surface = elevated ? dash.surfaceElevated : subdued ? dash.surfaceSubdued : dash.surface;

  return (
    <div
      className={cn(
        surface,
        variant === "hero" && "bg-gradient-to-br from-[#0f1218] via-[#0c0d10] to-[#09090b]",
        variant === "flat" && "shadow-none bg-white/[0.02]",
        hover && dash.surfaceHover,
        pad,
        className,
      )}
    >
      {children}
    </div>
  );
}
