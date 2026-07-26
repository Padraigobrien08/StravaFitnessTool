"use client";

import { useMemo } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useGoalStore } from "@/stores/goal-store";
import { buildReportPageView } from "@/lib/report/viewModels";
import { IntelligenceReport } from "@/components/report/intelligence-report";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function ReportPage() {
  const { analytics, insights, quality, dataset, loading } = useTrainingIntelligence();
  const raceGoal = useGoalStore((s) => s.raceGoal);

  const recentRuns = useMemo(() => {
    if (!dataset?.runs.length) return [];
    return [...dataset.runs]
      .reverse()
      .slice(0, 10)
      .map((r) => ({
        date: r.date,
        name: r.name,
        distanceM: r.distanceKm * 1000,
        paceSecPerKm: r.paceSecPerKm,
      }));
  }, [dataset?.runs]);

  const view = useMemo(() => {
    if (!analytics) return null;
    return buildReportPageView(analytics, insights, quality, recentRuns, raceGoal);
  }, [analytics, insights, quality, recentRuns, raceGoal]);

  if (loading && !view) {
    return (
      <div className="report-page-shell dashboard-enter w-full space-y-4 pb-8">
        <div className="skeleton-shimmer h-10 w-full max-w-lg rounded-lg" />
        <div className="skeleton-shimmer h-[480px] w-full max-w-[820px] rounded-xl" />
      </div>
    );
  }

  return (
    <RequireData>
      {view && analytics && (
        <div className="report-page-shell pb-12">
          <div className="no-print mx-auto mb-8 flex max-w-[820px] flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/90">
                Intelligence export
              </p>
              <h1 className="font-display text-2xl font-bold text-white">
                Athlete Intelligence Report
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Coach-ready briefing — optimized for print and PDF
              </p>
            </div>
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
          </div>

          <div className="report-canvas mx-auto max-w-[900px] rounded-2xl border border-white/[0.06] bg-[#f4f3f0] p-4 shadow-2xl shadow-black/20 sm:p-8 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
            <IntelligenceReport view={view} analytics={analytics} />
          </div>
        </div>
      )}
    </RequireData>
  );
}
