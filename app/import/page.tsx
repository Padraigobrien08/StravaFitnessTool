"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStrava } from "@/lib/context/strava-context";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useStravaConnection } from "@/hooks/use-strava-connection";
import { assessImportQuality } from "@/lib/quality/assessImport";
import { buildImportPageView } from "@/lib/import/viewModels";
import { ImportWorkspace, ImportIntelRow } from "@/components/import/import-workspace";
import { DataIntelligenceHero } from "@/components/import/data-intelligence-hero";
import { ConnectedSourcesPanel } from "@/components/import/connected-sources-panel";
import {
  DataConfidencePanel,
  HistoricalImportPanel,
  FitIntelligencePanel,
  ProcessingTrustPanel,
  MissingDataGuidancePanel,
  CapabilitiesMatrixPanel,
  ModalityCoveragePanel,
} from "@/components/import/import-panels";
import { dash } from "@/components/home/primitives/tokens";
import { ArrowLeft } from "lucide-react";

function DemoCallout() {
  const { loadDemo } = useStrava();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-teal-400/25 bg-teal-400/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-teal-200">No Strava export handy? Try the demo.</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Loads a full 12-month sample athlete so you can explore every insight instantly — no
          account, database, or API key required.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          loadDemo();
          router.push("/home");
        }}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-teal-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-teal-300"
      >
        Try the demo
      </button>
    </div>
  );
}

function ImportBriefingBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
      <div>
        <p className={dash.labelAccent}>Data connection & integrity</p>
        <p className="mt-0.5 text-xs text-zinc-600">
          Sources · coverage · FIT intelligence · trust
        </p>
      </div>
      <Link
        href="/home"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Home
      </Link>
    </div>
  );
}

function ImportPageContent() {
  const searchParams = useSearchParams();
  const stravaQuery = searchParams.get("strava");
  const {
    importData,
    loading,
    error,
    fitError,
    fitSuccess,
    importFiles,
    importFitFiles,
    fitStatus,
    refreshFromStravaApi,
    fitRunIds,
    dataSourceLabel,
    apiConnected,
    dataSources,
  } = useStrava();
  const { quality: intelQuality } = useTrainingIntelligence();
  const connection = useStravaConnection(stravaQuery, refreshFromStravaApi);

  const report = useMemo(() => {
    if (intelQuality) return intelQuality;
    if (importData) return assessImportQuality(importData);
    return null;
  }, [intelQuality, importData]);

  const view = useMemo(() => {
    return buildImportPageView(report, {
      apiConnected: connection.status?.connected ?? apiConnected,
      dataSources,
      dataSourceLabel,
      fitParsed: report?.fitParsed ?? fitRunIds.length,
      streamsFromApi: connection.status?.streams,
      runsMissingStreams: connection.status?.runsMissingStreams,
      parsing: fitStatus.parsing,
      loading,
      lastImport: report?.lastImport,
      importData: importData ?? null,
    });
  }, [
    report,
    apiConnected,
    connection.status,
    dataSources,
    dataSourceLabel,
    fitRunIds.length,
    fitStatus.parsing,
    loading,
  ]);

  const fitProgress =
    fitStatus.parsing && fitStatus.total > 0
      ? { done: fitStatus.done, total: fitStatus.total, parsing: true }
      : undefined;

  return (
    <ImportWorkspace>
      <ImportBriefingBar />
      {!importData ? <DemoCallout /> : null}
      <DataIntelligenceHero hero={view.hero} />

      {(view.processingMessage || loading) && (
        <ProcessingTrustPanel
          steps={view.processingSteps}
          message={view.processingMessage}
          topics={[]}
        />
      )}

      <ConnectedSourcesPanel sources={view.sources} connection={connection} />

      {view.modalityCoverage.length > 0 ? (
        <ModalityCoveragePanel rows={view.modalityCoverage} />
      ) : null}

      <ImportIntelRow>
        <div className="lg:col-span-7">
          <DataConfidencePanel coverage={view.coverage} warnings={report?.warnings ?? []} />
        </div>
        <div className="lg:col-span-5">
          <CapabilitiesMatrixPanel capabilities={view.capabilities} />
        </div>
      </ImportIntelRow>

      <ImportIntelRow>
        <div className="lg:col-span-7">
          <HistoricalImportPanel
            onFiles={(files) => void importFiles(files)}
            loading={loading && !importData}
            error={error}
            fitProgress={fitProgress}
          />
        </div>
        <div className="lg:col-span-5">
          <FitIntelligencePanel
            comparison={view.fitComparison}
            onFiles={(files) => void importFitFiles(files)}
            loading={loading}
            error={fitError}
            success={fitSuccess}
            fitProgress={
              fitStatus.parsing ? { done: fitStatus.done, total: fitStatus.total } : undefined
            }
            runsWithFit={fitRunIds.length}
            totalRuns={importData?.runs.length ?? 0}
          />
        </div>
      </ImportIntelRow>

      <MissingDataGuidancePanel items={view.missingGuidance} />

      <ProcessingTrustPanel steps={view.processingSteps} message={null} topics={view.trustTopics} />
    </ImportWorkspace>
  );
}

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="dashboard-enter space-y-4 pb-8">
          <div className="skeleton-shimmer h-10 w-full rounded-lg" />
          <div className="skeleton-shimmer h-48 w-full rounded-xl" />
        </div>
      }
    >
      <ImportPageContent />
    </Suspense>
  );
}
