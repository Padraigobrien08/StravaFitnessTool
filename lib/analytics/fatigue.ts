import type { RunActivity } from "@/lib/strava/types";
import { parseISO, format, startOfWeek } from "date-fns";

export interface WeeklyLoadPoint {
  weekStart: string;
  label: string;
  load: number;
}

export interface AcuteChronicLoad {
  ctl: number;
  atl: number;
  tsb: number;
  history: { weekStart: string; label: string; ctl: number; atl: number }[];
}

export interface FatigueSnapshot {
  ctl: number;
  atl: number;
  tsb: number;
  freshness: number;
  label: string;
  restDaysSinceLastRun: number;
  evidence: string[];
  usesProxyLoad: boolean;
}

export function weeklyLoadSeries(runs: RunActivity[]): WeeklyLoadPoint[] {
  const withLoad = runs.filter((r) => r.trainingLoad !== null);
  const useProxy = withLoad.length < runs.length * 0.5;

  const map = new Map<string, WeeklyLoadPoint>();

  for (const run of runs) {
    const d = parseISO(run.date);
    const key = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const existing = map.get(key) ?? {
      weekStart: key,
      label: format(parseISO(key), "MMM d"),
      load: 0,
    };
    const load = useProxy
      ? (run.distanceM / 1000) * 10
      : (run.trainingLoad ?? (run.distanceM / 1000) * 10);
    existing.load += load;
    map.set(key, existing);
  }

  return [...map.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart)
  );
}

export function acuteChronicLoad(
  series: WeeklyLoadPoint[],
  ctlTauWeeks = 6,
  atlTauWeeks = 1
): AcuteChronicLoad {
  const alphaCtl = 2 / (ctlTauWeeks + 1);
  const alphaAtl = 2 / (atlTauWeeks + 1);
  let ctl = 0;
  let atl = 0;
  const history: AcuteChronicLoad["history"] = [];

  for (const w of series) {
    ctl = alphaCtl * w.load + (1 - alphaCtl) * ctl;
    atl = alphaAtl * w.load + (1 - alphaAtl) * atl;
    history.push({
      weekStart: w.weekStart,
      label: w.label,
      ctl: Math.round(ctl),
      atl: Math.round(atl),
    });
  }

  return {
    ctl: Math.round(ctl),
    atl: Math.round(atl),
    tsb: Math.round(ctl - atl),
    history,
  };
}

export function freshnessFromTsb(
  tsb: number,
  restDaysSinceLastRun: number
): { freshness: number; label: string } {
  let freshness: number;
  let label: string;

  if (tsb > 10) {
    freshness = Math.min(100, 75 + Math.min(25, tsb));
    label = "Fresh";
  } else if (tsb >= -10) {
    freshness = 40 + Math.round(((tsb + 10) / 20) * 34);
    label = "Neutral";
  } else {
    freshness = Math.max(0, 39 + Math.round(tsb));
    label = "Fatigued";
  }

  if (restDaysSinceLastRun >= 2 && label === "Fatigued") {
    freshness = Math.min(100, freshness + 10);
  } else if (restDaysSinceLastRun >= 2 && label === "Neutral") {
    freshness = Math.min(100, freshness + 5);
  }

  return { freshness: Math.round(freshness), label };
}

export function buildFatigueSnapshot(runs: RunActivity[]): FatigueSnapshot {
  const series = weeklyLoadSeries(runs);
  const withLoad = runs.filter((r) => r.trainingLoad !== null);
  const usesProxyLoad = withLoad.length < runs.length * 0.5;

  const { ctl, atl, tsb, history } = acuteChronicLoad(series);
  const sorted = [...runs].sort(
    (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
  );
  const lastRun = sorted[0];
  const restDaysSinceLastRun = lastRun
    ? Math.floor(
        (Date.now() - parseISO(lastRun.date).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 99;

  const { freshness, label } = freshnessFromTsb(tsb, restDaysSinceLastRun);

  const evidence = [
    `Chronic load (CTL): ${ctl} · Acute load (ATL): ${atl} · Balance (TSB): ${tsb > 0 ? "+" : ""}${tsb}.`,
    `Rest days since last run: ${restDaysSinceLastRun}.`,
    usesProxyLoad
      ? "Load estimated from distance (training load missing on many runs)."
      : "Based on Strava training load from your export.",
  ];

  if (history.length >= 2) {
    const prev = history.at(-2);
    if (prev && atl > prev.atl) {
      evidence.push("Acute load has risen recently — prioritize recovery if adding intensity.");
    }
  }

  return {
    ctl,
    atl,
    tsb,
    freshness,
    label,
    restDaysSinceLastRun,
    evidence,
    usesProxyLoad,
  };
}
