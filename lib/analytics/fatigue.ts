import type { RunActivity } from "@/lib/strava/types";
import type { LegFeel } from "@/lib/wellness/types";
import { DEFAULT_FEEL_CALIBRATION, type FeelCalibration } from "@/lib/wellness/calibration";
import { parseISO, format, startOfWeek, addWeeks } from "date-fns";

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
  /** Display string. May be Rusty / Detrained / Returning once currency applies. */
  label: string;
  /**
   * The two axes behind `freshness`, so callers can branch on meaning instead of
   * comparing the display string. `balance` is the load reading; `currency` is
   * whether that reading is still about the athlete.
   */
  readiness: {
    balance: "fatigued" | "neutral" | "fresh";
    currency: ReadinessCurrency;
    /** 28-day volume over the 12-week baseline; null when history is too sparse. */
    volumeRatio: number | null;
  };
  restDaysSinceLastRun: number;
  evidence: string[];
  usesProxyLoad: boolean;
  /** The athlete's reported leg-feel for the day, if any — rides the snapshot to every consumer. */
  reportedLegFeel?: LegFeel;
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

  if (map.size === 0) return [];

  // Materialise the weeks with no runs. Only run-containing weeks used to reach
  // the series, so the exponential average never saw a zero-load week: a layoff
  // did not decay CTL or ATL, it was simply absent. Fill from the first run
  // through the current week so a gap that runs up to today still decays.
  const keys = [...map.keys()].sort();
  const out: WeeklyLoadPoint[] = [];
  const lastWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  let cursor = parseISO(keys[0]);
  while (cursor <= lastWeek) {
    const key = format(cursor, "yyyy-MM-dd");
    out.push(map.get(key) ?? { weekStart: key, label: format(cursor, "MMM d"), load: 0 });
    cursor = addWeeks(cursor, 1);
  }
  // Any run dated beyond the current week (clock skew, a future-dated activity)
  // would otherwise be dropped by the walk above.
  for (const key of keys) {
    if (key > format(lastWeek, "yyyy-MM-dd")) out.push(map.get(key)!);
  }
  return out;
}

export function acuteChronicLoad(
  series: WeeklyLoadPoint[],
  ctlTauWeeks = 6,
  // Was 1, which gives alpha = 2/(1+1) = 1.0: ATL became identically "this
  // week's load" with no memory, so acute load could never accumulate across
  // weeks. For a steady load the steady state is unchanged; this only damps the
  // transients it was supposed to be smoothing.
  atlTauWeeks = 2,
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
  restDaysSinceLastRun: number,
  legFeel?: LegFeel,
  calibration: FeelCalibration = DEFAULT_FEEL_CALIBRATION,
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

  // Subjective nudge: bounded, asymmetric, safety-first. Adjusts the day's
  // readiness only — never the CTL/ATL/TSB fitness model. "Heavy" is respected
  // more than "fresh" is rewarded, so it can force a back-off but never unlock a
  // hard day the load balance didn't already sanction.
  if (legFeel === "heavy") {
    freshness = Math.max(0, freshness + calibration.heavyDelta);
    if (label === "Fresh") label = "Neutral";
    if (freshness < 40) label = "Fatigued";
  } else if (legFeel === "fresh") {
    freshness = Math.min(100, freshness + calibration.freshDelta);
  }

  return { freshness: Math.round(freshness), label };
}

/* ------------------------- currency (axis B) ------------------------------ */

/**
 * How current the training is, which is a different question from how loaded
 * the athlete is. Balance alone said "Fresh, freshness 100" to someone who had
 * not run in 11 days, because rest only ever added freshness and TSB has no
 * upper turn. Currency is driven by directly observable facts rather than TSB,
 * which a form ratio could not do: with sporadic training CTL is small, so any
 * positive TSB inflates the ratio and flags real training days as stale.
 *
 * See docs/proposals/readiness-model.md.
 */
export type ReadinessCurrency = "current" | "light-gap" | "rusty" | "detrained" | "returning";

const CURRENCY_CAP: Record<ReadinessCurrency, number> = {
  current: 100,
  "light-gap": 85,
  rusty: 65,
  detrained: 50,
  returning: 40,
};

/** Currency states that must never read as fresh, whatever the load balance says. */
const STALE: ReadinessCurrency[] = ["rusty", "detrained", "returning"];

const CURRENCY_LABEL: Partial<Record<ReadinessCurrency, string>> = {
  rusty: "Rusty",
  detrained: "Detrained",
  returning: "Returning",
};

/**
 * @param restDays days since the last run
 * @param volumeRatio 28-day volume as a fraction of the athlete's 12-week median,
 *   or null when there is not enough history to have a baseline
 */
export function classifyCurrency(restDays: number, volumeRatio: number | null): ReadinessCurrency {
  if (restDays > 28) return "returning";
  if (restDays >= 15) return "detrained";
  if (restDays >= 8) return "rusty";
  // A token run every few days should not mask training having collapsed, so a
  // recent run still reads as rusty when 28-day volume is far below baseline.
  if (volumeRatio != null && volumeRatio < 0.4) return "rusty";
  if (restDays >= 4) return "light-gap";
  return "current";
}

/** 28-day volume over the 12-week median of 28-day volumes; null when too sparse. */
export function volumeCurrencyRatio(runs: RunActivity[], now = new Date()): number | null {
  if (runs.length < 6) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const kmIn = (fromDaysAgo: number, toDaysAgo: number) =>
    runs
      .filter((r) => {
        const age = (now.getTime() - parseISO(r.date).getTime()) / dayMs;
        return age >= toDaysAgo && age < fromDaysAgo;
      })
      .reduce((s, r) => s + r.distanceM / 1000, 0);

  const recent = kmIn(28, 0);
  // Three earlier 28-day windows form the baseline; median resists one odd block.
  const priors = [kmIn(56, 28), kmIn(84, 56)].filter((v) => v > 0);
  if (priors.length === 0) return null;
  const baseline = priors.sort((a, b) => a - b)[Math.floor(priors.length / 2)];
  if (baseline <= 0) return null;
  return recent / baseline;
}

/**
 * Apply currency on top of a balance result: cap the number, and rename the
 * label when the data is too stale for the balance reading to mean anything.
 */
export function applyCurrency(
  balance: { freshness: number; label: string },
  currency: ReadinessCurrency,
): { freshness: number; label: string } {
  const freshness = Math.min(balance.freshness, CURRENCY_CAP[currency]);
  const label = STALE.includes(currency) ? CURRENCY_LABEL[currency]! : balance.label;
  return { freshness, label };
}

export function buildFatigueSnapshot(
  runs: RunActivity[],
  legFeel?: LegFeel,
  calibration: FeelCalibration = DEFAULT_FEEL_CALIBRATION,
): FatigueSnapshot {
  const series = weeklyLoadSeries(runs);
  const withLoad = runs.filter((r) => r.trainingLoad !== null);
  const usesProxyLoad = withLoad.length < runs.length * 0.5;

  const { ctl, atl, tsb, history } = acuteChronicLoad(series);
  const sorted = [...runs].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  const lastRun = sorted[0];
  const restDaysSinceLastRun = lastRun
    ? Math.floor((Date.now() - parseISO(lastRun.date).getTime()) / (1000 * 60 * 60 * 24))
    : 99;

  const balance = freshnessFromTsb(tsb, restDaysSinceLastRun, legFeel, calibration);
  const volumeRatio = volumeCurrencyRatio(runs);
  const currency = classifyCurrency(restDaysSinceLastRun, volumeRatio);
  const { freshness, label } = applyCurrency(balance, currency);

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
      evidence.push("Acute load has risen recently: prioritize recovery if adding intensity.");
    }
  }

  if (legFeel === "heavy") {
    evidence.push("Adjusted down for reported heavy legs: protect the block today.");
  } else if (legFeel === "fresh") {
    evidence.push("Nudged up for reported fresh legs.");
  }
  if (
    legFeel &&
    legFeel !== "normal" &&
    calibration.reliability > 0.5 &&
    calibration.sampleCount >= 4
  ) {
    evidence.push(calibration.basis);
  }

  return {
    ctl,
    atl,
    tsb,
    freshness,
    label,
    readiness: {
      balance:
        balance.label === "Fresh" ? "fresh" : balance.label === "Fatigued" ? "fatigued" : "neutral",
      currency,
      volumeRatio,
    },
    restDaysSinceLastRun,
    evidence,
    usesProxyLoad,
    reportedLegFeel: legFeel,
  };
}
