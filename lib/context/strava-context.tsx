"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { computeInsights, type DashboardInsights } from "@/lib/analytics";
import {
  buildDataSourceLabel,
  enrichImportWithFitDetails,
  mergeStravaImports,
  type DataSources,
} from "@/lib/data/mergeImport";
import { importFromFiles } from "@/lib/strava/importExport";
import { importFitFilesOnly } from "@/lib/strava/importFit";
import type { StravaImport } from "@/lib/strava/types";
import { StravaImportSchema } from "@/lib/strava/types";
import { clearImport, loadImport, saveImport } from "@/lib/storage/local";
import {
  clearFitDetails,
  countStaleFitDetails,
  getAllFitDetails,
  mergeFitDetails,
} from "@/lib/storage/fit-db";
import { FitRunDetailSchema } from "@/lib/strava/fitTypes";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { useSettingsStore } from "@/stores/settings-store";
import { useGoalStore } from "@/stores/goal-store";

interface FitImportStatus {
  parsing: boolean;
  done: number;
  total: number;
  parsed: number;
  available: number;
}

interface StravaContextValue {
  importData: StravaImport | null;
  /** Runs + streams from export, API, and IndexedDB combined */
  fitRunIds: string[];
  dataSources: DataSources;
  dataSourceLabel: string | null;
  apiConnected: boolean;
  insights: DashboardInsights | null;
  loading: boolean;
  error: string | null;
  fitError: string | null;
  fitSuccess: string | null;
  fitStatus: FitImportStatus;
  importFiles: (files: File[], label?: string) => Promise<void>;
  importFitFiles: (files: File[]) => Promise<void>;
  clearData: () => Promise<void>;
  refreshFromStravaApi: () => Promise<void>;
  getRunById: (id: string) => import("@/lib/strava/types").RunActivity | undefined;
  getFitDetailForRun: (id: string) => FitRunDetail | undefined;
}

const StravaContext = createContext<StravaContextValue | null>(null);

const idleFitStatus: FitImportStatus = {
  parsing: false,
  done: 0,
  total: 0,
  parsed: 0,
  available: 0,
};

export function StravaProvider({ children }: { children: React.ReactNode }) {
  const [importData, setImportData] = useState<StravaImport | null>(null);
  const [dataSources, setDataSources] = useState<DataSources>({
    localExport: false,
    stravaApi: false,
  });
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  const [fitSuccess, setFitSuccess] = useState<string | null>(null);
  const [fitStatus, setFitStatus] = useState<FitImportStatus>(idleFitStatus);
  const [fitDetails, setFitDetails] = useState<FitRunDetail[]>([]);

  const commitImport = useCallback(
    (data: StravaImport | null, sourcePatch?: Partial<DataSources>) => {
      setImportData(data);
      if (data) saveImport(data);
      if (sourcePatch) {
        setDataSources((prev) => ({ ...prev, ...sourcePatch }));
      }
    },
    []
  );

  const refreshFitDetails = useCallback(async () => {
    const details = await getAllFitDetails();
    setFitDetails(details);
    setFitStatus((s) => ({
      ...s,
      parsed: details.length,
      available: details.length,
    }));
    return details;
  }, []);

  const loadApiFitDetails = useCallback(async () => {
    const fitRes = await fetch("/api/me/fit-details");
    if (!fitRes.ok) return [];
    const raw = (await fitRes.json()) as unknown[];
    const details = raw
      .map((item) => {
        try {
          return FitRunDetailSchema.parse(item);
        } catch {
          return null;
        }
      })
      .filter((x): x is FitRunDetail => x !== null);
    if (details.length > 0) {
      await mergeFitDetails(details);
    }
    return details;
  }, []);

  const loadFromStravaApi = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch("/api/me/status");
      const status = (await statusRes.json()) as {
        connected?: boolean;
      };
      setApiConnected(Boolean(status.connected));
      if (!status.connected) return;

      const res = await fetch("/api/me/import");
      if (!res.ok) return;
      const apiData = StravaImportSchema.parse(await res.json());

      const base = importData ?? loadImport();
      const merged = mergeStravaImports(base, apiData);
      commitImport(merged, { stravaApi: true });

      await loadApiFitDetails();
      await refreshFitDetails();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load Strava API data"
      );
    } finally {
      setLoading(false);
    }
  }, [importData, commitImport, loadApiFitDetails, refreshFitDetails]);

  useEffect(() => {
    const stored = loadImport();
    if (stored) {
      const label = stored.exportLabel ?? "";
      commitImport(stored, {
        localExport: label !== "Strava API" && label.length > 0,
        stravaApi: label.includes("Strava API"),
      });
    }
    void refreshFitDetails();
    void (async () => {
      const statusRes = await fetch("/api/me/status");
      const status = (await statusRes.json()) as { connected?: boolean };
      setApiConnected(Boolean(status.connected));
      if (status.connected) {
        await loadFromStravaApi();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  const effectiveImport = useMemo(
    () =>
      importData ? enrichImportWithFitDetails(importData, fitDetails) : null,
    [importData, fitDetails]
  );

  const fitRunIds = effectiveImport?.fitRunIds ?? [];

  const dataSourceLabel = buildDataSourceLabel(dataSources);

  const defaultWeeklyRuns = useSettingsStore((s) => s.defaultWeeklyRuns);
  const maxWeeklyKm = useSettingsStore((s) => s.maxWeeklyKm);
  const raceGoal = useGoalStore((s) => s.raceGoal);

  const insights = useMemo(
    () =>
      effectiveImport
        ? computeInsights(
            effectiveImport,
            fitDetails,
            defaultWeeklyRuns,
            raceGoal,
            maxWeeklyKm > 0 ? maxWeeklyKm : undefined
          )
        : null,
    [
      effectiveImport,
      fitDetails,
      defaultWeeklyRuns,
      raceGoal,
      maxWeeklyKm,
    ]
  );

  const importFitFiles = useCallback(
    async (files: File[]) => {
      if (!importData) {
        setFitError("Import activities.csv first, then add FIT files.");
        return;
      }
      setLoading(true);
      setFitError(null);
      setFitSuccess(null);
      setFitStatus((s) => ({ ...s, parsing: true, done: 0, total: 0 }));
      try {
        const result = await importFitFilesOnly(
          files,
          importData,
          (done, total) => {
            setFitStatus((s) => ({
              ...s,
              parsing: true,
              done,
              total,
            }));
          }
        );
        const details = await refreshFitDetails();
        const updated = enrichImportWithFitDetails(
          { ...importData, fitRunIds: result.fitRunIds },
          details
        );
        commitImport(updated, { localExport: true });
        setFitStatus({
          parsing: false,
          done: result.matched,
          total: result.matched,
          parsed: result.parsed,
          available: result.matched + result.unmatched,
        });
        setFitSuccess(
          `Parsed ${result.parsed} runs from FIT files` +
            (result.unmatched > 0
              ? ` (${result.unmatched} files had no matching run).`
              : ". Open Runs to view stream charts.")
        );
      } catch (e) {
        setFitError(e instanceof Error ? e.message : "FIT import failed");
      } finally {
        setLoading(false);
        setFitStatus((s) => ({ ...s, parsing: false }));
      }
    },
    [importData, commitImport, refreshFitDetails]
  );

  const importFiles = useCallback(
    async (files: File[], label?: string) => {
      setLoading(true);
      setError(null);
      setFitError(null);
      setFitSuccess(null);
      setFitStatus({ ...idleFitStatus, parsing: true });
      try {
        const folderName =
          label ??
          (files[0] as File & { webkitRelativePath?: string })
            .webkitRelativePath?.split("/")[0];
        const { data: exportData, fitParsed, fitAvailable } =
          await importFromFiles(files, folderName, (done, total) => {
            setFitStatus((s) => ({ ...s, parsing: true, done, total }));
          });

        const merged = mergeStravaImports(importData, exportData);
        commitImport(merged, { localExport: true });

        await refreshFitDetails();
        const stale = await countStaleFitDetails();
        setFitStatus({
          parsing: false,
          done: fitAvailable,
          total: fitAvailable,
          parsed: fitParsed,
          available: fitAvailable,
        });
        if (fitParsed > 0 && stale === fitParsed) {
          setFitError(
            "FIT files imported but contained no stream data. Try Step 2 again with the activities folder."
          );
        } else if (fitParsed > 0) {
          setFitSuccess(
            `Parsed ${fitParsed} runs with stream data. Records now include best efforts inside longer runs.`
          );
        }

        if (apiConnected) {
          await loadFromStravaApi();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
        setFitStatus(idleFitStatus);
      } finally {
        setLoading(false);
      }
    },
    [
      importData,
      apiConnected,
      commitImport,
      refreshFitDetails,
      loadFromStravaApi,
    ]
  );

  const clearData = useCallback(async () => {
    clearImport();
    await clearFitDetails();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setImportData(null);
    setDataSources({ localExport: false, stravaApi: false });
    setApiConnected(false);
    setError(null);
    setFitError(null);
    setFitSuccess(null);
    setFitStatus(idleFitStatus);
    setFitDetails([]);
  }, []);

  const getRunById = useCallback(
    (id: string) => importData?.runs.find((r) => r.id === id),
    [importData]
  );

  const getFitDetailForRun = useCallback(
    (id: string) => fitDetails.find((f) => f.activityId === id),
    [fitDetails]
  );

  return (
    <StravaContext.Provider
      value={{
        importData: effectiveImport,
        fitRunIds,
        dataSources,
        dataSourceLabel,
        apiConnected,
        insights,
        loading,
        error,
        fitError,
        fitSuccess,
        fitStatus,
        importFiles,
        importFitFiles,
        clearData,
        refreshFromStravaApi: loadFromStravaApi,
        getRunById,
        getFitDetailForRun,
      }}
    >
      {children}
    </StravaContext.Provider>
  );
}

export function useStrava() {
  const ctx = useContext(StravaContext);
  if (!ctx) throw new Error("useStrava must be used within StravaProvider");
  return ctx;
}
