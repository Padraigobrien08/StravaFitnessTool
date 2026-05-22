"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import { useStrava } from "@/lib/context/strava-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Usable workspace width on large displays */
export const WORKSPACE_MAX = "max-w-[1500px]";
export const COACH_WORKSPACE_MAX = "max-w-[1550px]";

export function WorkspaceFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        WORKSPACE_MAX,
        "px-4 sm:px-5 lg:px-6",
        className
      )}
    >
      {children}
    </div>
  );
}

function WorkspaceMeta() {
  const { importData, clearData, dataSourceLabel } = useStrava();
  if (!importData) return null;
  return (
    <div className="hidden items-center gap-2 text-xs text-zinc-500 xl:flex">
      <span>
        {importData.runs.length} runs
        {dataSourceLabel ? ` · ${dataSourceLabel}` : ""}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-zinc-500"
        onClick={clearData}
      >
        Clear
      </Button>
    </div>
  );
}

export function AppWorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/home";
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
        isCoach ? "h-dvh max-h-dvh overflow-hidden" : "min-h-dvh"
      )}
    >
      <header className="sticky top-0 z-50 shrink-0 border-b border-white/[0.06] bg-[#09090b]/88 backdrop-blur-xl">
        <WorkspaceFrame className="flex h-[var(--app-nav-height)] items-center gap-3 sm:gap-5">
          <Link
            href="/home"
            className="shrink-0 font-display text-lg font-bold tracking-tight text-white"
          >
            Stride<span className="text-teal-400">IQ</span>
          </Link>
          <Nav variant="app" className="min-w-0 flex-1" />
          <WorkspaceMeta />
        </WorkspaceFrame>
      </header>

      <main
        className={cn(
          isCoach ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex-1"
        )}
      >
        <WorkspaceFrame
          className={cn(
            isCoach
              ? "flex h-full min-h-0 max-w-[1550px] flex-1 flex-col overflow-hidden px-3 py-2 sm:px-4"
              : "py-4 sm:py-5",
            isHome && "pb-8"
          )}
        >
          {children}
        </WorkspaceFrame>
      </main>
    </div>
  );
}
