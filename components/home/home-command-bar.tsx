"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { InsightConfidence } from "@/lib/insights/types";
import { RefreshCw, FileText, Dumbbell, TrendingUp, AlertTriangle } from "lucide-react";
import { dash } from "./primitives/tokens";

export function HomeCommandBar({
  apiConnected,
  confidence,
  syncing,
  onSync,
  syncError,
  mobileSummary,
}: {
  apiConnected: boolean;
  confidence: InsightConfidence;
  syncing: boolean;
  onSync?: () => void;
  syncError?: string | null;
  mobileSummary?: {
    title: string;
    readinessScore: number;
    freshness: number;
  };
}) {
  return (
    <div className="space-y-2 border-b border-white/[0.04] pb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={dash.labelAccent}>Command briefing</p>
          {mobileSummary ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 lg:hidden">
              {mobileSummary.title} · R{mobileSummary.readinessScore} · Fresh{" "}
              {mobileSummary.freshness}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ConfidenceBadge level={confidence} />
          <Link
            href="/report"
            title="Weekly report"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <FileText className="h-4 w-4" />
          </Link>
          <Link
            href="/training"
            title="Training"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <Dumbbell className="h-4 w-4" />
          </Link>
          <Link
            href="/performance"
            title="Performance"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <TrendingUp className="h-4 w-4" />
          </Link>
          {apiConnected && onSync ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={syncing}
              onClick={onSync}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
          ) : null}
        </div>
      </div>

      {syncError && !syncing ? (
        <div
          role="alert"
          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/90" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-amber-200/90">
                We couldn&apos;t sync your latest activities from Strava.
              </p>
              <p className="mt-0.5 break-words text-[11px] text-zinc-500">
                Check your connection and try again. If it keeps failing, reconnect Strava in
                Settings. ({syncError})
              </p>
            </div>
          </div>
          {onSync ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1.5 text-[11px]"
              onClick={onSync}
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
