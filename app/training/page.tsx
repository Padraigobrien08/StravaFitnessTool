"use client";

import { useMemo } from "react";
import { RequireData } from "@/components/require-data";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { buildTrainingPageView } from "@/lib/training/viewModels";
import { TrainingWorkspace } from "@/components/training/training-workspace";
import { TrainingStateHero } from "@/components/training/training-state-hero";
import { LoadIntelligencePanel } from "@/components/training/load-intelligence-panel";
import { CoachingExplainability } from "@/components/training/coaching-explainability";
import { AdaptationSignalsPanel } from "@/components/training/adaptation-signals-panel";
import { PhaseCatalogPanel } from "@/components/training/phase-catalog-panel";
import { SupportingAnalytics } from "@/components/training/supporting-analytics";
import { TrainingEcosystemPanel } from "@/components/training/training-ecosystem-panel";
import { ops } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { dash } from "@/components/home/primitives/tokens";
import { JargonTerm } from "@/components/jargon-term";

function TrainingEvidenceBanner() {
  return (
    <div className="border-b border-white/[0.04] pb-3">
      <p className={dash.labelAccent}>Training · Am I training correctly?</p>
      <p className="mt-0.5 text-xs text-zinc-600">
        <JargonTerm term="load">Load</JargonTerm>, intensity mix,{" "}
        <JargonTerm term="phase">phase</JargonTerm>, and cross-training: how your training is
        structured.
      </p>
    </div>
  );
}

export default function TrainingPage() {
  const { analytics, insights, loading } = useTrainingIntelligence();

  const view = useMemo(() => {
    if (!analytics) return null;
    return buildTrainingPageView(analytics, insights);
  }, [analytics, insights]);

  if (loading && !view) {
    return (
      <div className="dashboard-enter w-full max-w-5xl space-y-4 pb-8">
        <div className="skeleton-shimmer h-10 w-full rounded-lg" />
        <div className="skeleton-shimmer h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <RequireData>
      {view && analytics && (
        <TrainingWorkspace className="max-w-5xl">
          <TrainingEvidenceBanner />
          <TrainingStateHero hero={view.hero} />
          <div className="grid gap-4 lg:grid-cols-2">
            <LoadIntelligencePanel data={view.load} className={cn(ops.intelMain)} />
            <CoachingExplainability data={view.explain} className={cn(ops.intelSide)} />
          </div>
          <AdaptationSignalsPanel data={view.adaptation} />
          <PhaseCatalogPanel phases={analytics.trainingPhases} />
          <TrainingEcosystemPanel data={view.ecosystem} />
          <SupportingAnalytics data={view.supporting} defaultCollapsed />
        </TrainingWorkspace>
      )}
    </RequireData>
  );
}
