"use client";

import type { DashboardInsights } from "@/lib/analytics";
import type { ReportPageView } from "@/lib/report/viewModels";
import { ReportSection } from "./report-section";
import { ReportExecutiveSummary } from "./report-executive-summary";
import { ReportHero } from "./report-hero";
import {
  ReportTrainingState,
  ReportKeySignals,
  ReportAdaptation,
  ReportRaceBriefing,
  ReportCoaching,
  ReportMetrics,
  ReportHistory,
  ReportConfidence,
  ReportTrainingEcosystem,
} from "./report-panels";
import { ReportChartsGrid } from "./report-charts";

export function IntelligenceReport({
  view,
  analytics,
}: {
  view: ReportPageView;
  analytics: DashboardInsights;
}) {
  return (
    <article className="report-document mx-auto max-w-[820px]">
      <header className="report-masthead mb-10 border-b border-zinc-300 pb-8 print:mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">
              StrideIQ
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-zinc-900 print:text-black sm:text-4xl">
              Athlete Intelligence Report
            </h1>
            <p className="mt-2 text-sm text-zinc-600">Generated {view.meta.generatedAt}</p>
          </div>
          <div className="text-right text-xs text-zinc-600">
            <p>
              {view.meta.runCount} runs · {view.meta.totalDistanceKm} total
            </p>
            {view.meta.dateRangeLabel ? <p>{view.meta.dateRangeLabel}</p> : null}
            {view.meta.exportLabel ? (
              <p className="mt-1 text-zinc-500">{view.meta.exportLabel}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mb-12 space-y-10">
        <ReportExecutiveSummary data={view.executive} />
        <ReportHero hero={view.hero} />
      </div>

      <div className="report-body space-y-14 print:space-y-10">
        <ReportSection
          number={1}
          title="Current training state"
          subtitle="What happened recently and how the block is landing."
        >
          <ReportTrainingState {...view.trainingState} />
        </ReportSection>

        <ReportSection
          number={2}
          title="Key signals & insights"
          subtitle="Synthesized intelligence, not a metrics dump."
        >
          <ReportKeySignals signals={view.signals} />
        </ReportSection>

        <ReportSection
          number={3}
          title="Adaptation & progression"
          subtitle="What is improving and what trends matter."
          breakBefore
        >
          <ReportAdaptation {...view.adaptation} />
          {view.charts.length > 0 ? (
            <div className="mt-8">
              <ReportChartsGrid specs={view.charts} analytics={analytics} />
            </div>
          ) : null}
        </ReportSection>

        {view.ecosystem ? (
          <ReportSection
            number={4}
            title="Training ecosystem"
            subtitle="Run volume, cross-training, durability support, and interference; running stays primary for race performance."
          >
            <ReportTrainingEcosystem data={view.ecosystem} />
          </ReportSection>
        ) : null}

        <ReportSection
          number={view.ecosystem ? 5 : 4}
          title="Race readiness briefing"
          subtitle="Strategic readiness: score, risks, and projected corridor."
        >
          <ReportRaceBriefing data={view.raceBriefing} />
        </ReportSection>

        <ReportSection
          number={view.ecosystem ? 6 : 5}
          title="Coaching recommendations"
          subtitle="Actionable focus for the next training week."
          breakBefore
        >
          <ReportCoaching data={view.coaching} />
        </ReportSection>

        <ReportSection
          number={view.ecosystem ? 7 : 6}
          title="Performance metrics"
          subtitle="Curated clusters: only what supports the briefing."
        >
          <ReportMetrics clusters={view.metrics} />
        </ReportSection>

        <ReportSection
          number={view.ecosystem ? 8 : 7}
          title="Training history snapshot"
          subtitle="Recent activity and record context."
        >
          <ReportHistory {...view.history} />
        </ReportSection>

        <ReportSection
          number={view.ecosystem ? 9 : 8}
          title="Confidence & data quality"
          subtitle="Evidence, gaps, and limitations behind every recommendation."
        >
          <ReportConfidence data={view.confidence} />
        </ReportSection>
      </div>

      <footer className="report-footer mt-14 border-t border-zinc-300 pt-6 text-xs text-zinc-500 print:mt-10">
        StrideIQ: endurance intelligence from your training export. Not medical advice. Predictions
        are estimates; race-day execution, weather, and fueling can shift outcomes.
      </footer>
    </article>
  );
}
