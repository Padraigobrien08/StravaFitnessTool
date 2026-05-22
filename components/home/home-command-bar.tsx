"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { InsightConfidence } from "@/lib/insights/types";
import { RefreshCw, FileText, Dumbbell, TrendingUp } from "lucide-react";
import { dash } from "./primitives/tokens";

export function HomeCommandBar({
  apiConnected,
  confidence,
  syncing,
  onSync,
  mobileSummary,
}: {
  apiConnected: boolean;
  confidence: InsightConfidence;
  syncing: boolean;
  onSync?: () => void;
  mobileSummary?: {
    title: string;
    readinessScore: number;
    freshness: number;
  };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
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
            <RefreshCw
              className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            Sync
          </Button>
        ) : null}
      </div>
    </div>
  );
}
