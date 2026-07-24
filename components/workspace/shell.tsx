"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import { useStrava } from "@/lib/context/strava-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

/** Usable workspace width on large displays */
export const WORKSPACE_MAX = "max-w-[1500px]";
/** Coach: wider than default pages, with modest side gutters on ultra-wide screens */
export const COACH_WORKSPACE_MAX = "max-w-[1720px]";

export function WorkspaceFrame({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "coach";
}) {
  const isCoach = variant === "coach";
  return (
    <div
      className={cn(
        "mx-auto w-full",
        isCoach
          ? cn(COACH_WORKSPACE_MAX, "px-3 sm:px-4 lg:px-5")
          : cn(WORKSPACE_MAX, "px-4 sm:px-5 lg:px-6"),
        className,
      )}
    >
      {children}
    </div>
  );
}

function WorkspaceMeta() {
  const { importData, clearData, dataSourceLabel, dataSources } = useStrava();
  if (!importData) return null;
  const isDemo = Boolean(dataSources.demo);
  return (
    <div className="hidden items-center gap-2 text-xs text-zinc-500 xl:flex">
      {isDemo ? (
        <span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-2 py-0.5 font-medium text-teal-300">
          Demo
        </span>
      ) : null}
      <span>
        {importData.runs.length} runs
        {!isDemo && dataSourceLabel ? ` · ${dataSourceLabel}` : ""}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-zinc-500"
        onClick={clearData}
      >
        {isDemo ? "Exit demo" : "Clear"}
      </Button>
    </div>
  );
}

export function AppWorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/home" || pathname === "/plan";
  const isCoach = pathname === "/coach";

  useEffect(() => {
    document.documentElement.classList.toggle("coach-route", isCoach);
    document.body.classList.toggle("coach-route", isCoach);
    return () => {
      document.documentElement.classList.remove("coach-route");
      document.body.classList.remove("coach-route");
    };
  }, [isCoach]);

  return (
    <div
      className={cn(
        "relative z-10 flex w-full flex-col",
        isCoach ? "h-dvh max-h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <header className="sticky top-0 z-50 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--header-bg)] backdrop-blur-xl">
        <WorkspaceFrame className="flex h-[var(--app-nav-height)] items-center gap-3 sm:gap-5">
          <Link href="/home" className="type-title shrink-0 text-[1.0625rem] tracking-[-0.03em]">
            Stride<span className="text-teal-400">IQ</span>
          </Link>
          <Nav variant="app" className="min-w-0 flex-1" />
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
              pathname === "/settings" || pathname.startsWith("/settings/")
                ? "bg-teal-500/12 text-teal-300"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
          <ThemeToggle className="shrink-0" />
          <WorkspaceMeta />
        </WorkspaceFrame>
      </header>

      <main className={cn(isCoach ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex-1")}>
        <WorkspaceFrame
          variant={isCoach ? "coach" : "default"}
          className={cn(
            isCoach
              ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden py-1 sm:py-1.5"
              : "py-4 sm:py-5",
            isHome && "pb-8",
          )}
        >
          {children}
        </WorkspaceFrame>
      </main>
    </div>
  );
}
