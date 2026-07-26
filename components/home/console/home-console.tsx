"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { coachUrl, topicCoachLink } from "@/lib/coach/domainLinks";
import type { DashboardInsights } from "@/lib/analytics";
import type { HomeOperatingSystemView } from "@/lib/home/operatingSystemView";
import type {
  CalendarIntensity,
  CalendarWorkout,
  TrainingCalendarWeek,
} from "@/lib/training-calendar";

/* ----------------------------------------------------------------------------
 * Home console — "instrument" direction.
 * Wired to real data only (analytics + operating-system view + saved week).
 * Effort colours mirror CalendarIntensity via the --hz-* tokens in globals.css.
 * -------------------------------------------------------------------------- */

const CONSENSUS_LABEL: Record<string, string> = {
  "5k": "5K",
  "10k": "10K",
  hm: "Half Marathon",
  marathon: "Marathon",
};

const ZONE_COLOR: Record<CalendarIntensity, string> = {
  easy: "var(--hz-easy)",
  recovery: "var(--hz-recovery)",
  moderate: "var(--hz-moderate)",
  hard: "var(--hz-hard)",
  rest: "var(--hz-rest)",
};

const ZONE_LEGEND: { key: CalendarIntensity; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "recovery", label: "Recovery" },
  { key: "moderate", label: "Moderate" },
  { key: "hard", label: "Hard" },
  { key: "rest", label: "Rest" },
];

function verdictTone(label: string): { color: string; wash: string } {
  const l = label.toLowerCase();
  if (l.includes("fresh"))
    return {
      color: "var(--home-good)",
      wash: "color-mix(in srgb, var(--home-good) 12%, transparent)",
    };
  if (l.includes("fatigued"))
    return {
      color: "var(--home-redline)",
      wash: "color-mix(in srgb, var(--home-redline) 12%, transparent)",
    };
  return { color: "var(--home-signal)", wash: "var(--home-signal-wash)" };
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function findTodayWorkout(week: TrainingCalendarWeek | null): CalendarWorkout | null {
  if (!week) return null;
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const dayShort = format(new Date(), "EEE").toLowerCase();
  return (
    week.workouts.find(
      (w) => w.date.slice(0, 10) === todayIso || w.day.toLowerCase().startsWith(dayShort),
    ) ?? null
  );
}

export function HomeConsole({
  vm,
  analytics,
  savedWeek,
  calendarHydrated,
  onGeneratePlan,
  planLoading,
  onSync,
  syncing,
  apiConnected,
  dataSourceLabel,
  pastRace,
}: {
  vm: HomeOperatingSystemView;
  analytics: DashboardInsights;
  savedWeek: TrainingCalendarWeek | null;
  calendarHydrated: boolean;
  onGeneratePlan?: () => void;
  planLoading?: boolean;
  onSync?: () => void;
  syncing?: boolean;
  apiConnected?: boolean;
  dataSourceLabel?: string | null;
  pastRace?: { label: string; date: string } | null;
}) {
  const today = useMemo(() => findTodayWorkout(savedWeek), [savedWeek]);

  return (
    <div className="home-console flex w-full flex-col gap-3 font-sans">
      <StatusBar
        hero={vm.hero}
        onSync={onSync}
        syncing={syncing}
        apiConnected={apiConnected}
        confidence={analytics.dataConfidence}
      />

      <div className="grid gap-3 lg:grid-cols-[1.65fr_1fr]">
        <TheCall
          vm={vm}
          today={today}
          onGeneratePlan={onGeneratePlan}
          planLoading={planLoading}
          hasSavedPlan={vm.hero.hasSavedPlan}
        />
        <Readiness analytics={analytics} hero={vm.hero} />
      </div>

      <WeekStrip
        savedWeek={savedWeek}
        hydrated={calendarHydrated}
        onGeneratePlan={onGeneratePlan}
        planLoading={planLoading}
      />

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Trajectory analytics={analytics} pastRace={pastRace} />
        <ChangeFeed items={vm.changeFeed} />
      </div>

      <DecisionSupport
        risks={vm.risks.map((r) => r.text)}
        opportunities={vm.opportunities.map((o) => o.text)}
        primaryActionBullets={vm.primaryActionBullets}
      />

      <p className="border-t border-[var(--border-subtle)] pt-3 text-[10px] text-zinc-600">
        {dataSourceLabel ? `${dataSourceLabel} · ` : ""}
        Deeper analysis →{" "}
        <Link href="/intelligence" className="text-zinc-500 hover:text-[var(--home-signal)]">
          Intelligence
        </Link>
        {" · "}
        <Link href="/coach" className="text-zinc-500 hover:text-[var(--home-signal)]">
          Coach
        </Link>
      </p>
    </div>
  );
}

/* ---------------------------------- Panel shell --------------------------- */

function Panel({
  children,
  className,
  bare,
}: {
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl bg-[var(--surface-elevated)] shadow-[var(--surface-shadow)] ring-1 ring-[var(--border-subtle)]",
        !bare && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ---------------------------------- Status bar ---------------------------- */

function StatusBar({
  hero,
  onSync,
  syncing,
  apiConnected,
  confidence,
}: {
  hero: HomeOperatingSystemView["hero"];
  onSync?: () => void;
  syncing?: boolean;
  apiConnected?: boolean;
  confidence: "low" | "medium" | "high";
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--surface-shadow-subtle)] ring-1 ring-[var(--border-subtle)]">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[15px] font-bold tracking-tight text-foreground">
          Stride<span className="text-[var(--home-signal)]">IQ</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Console</span>
      </div>

      <div className="flex-1" />

      <StatusItem label="Today" value={format(new Date(), "EEE · d MMM")} />
      {hero.raceName && hero.daysUntilRace != null ? (
        <StatusItem
          label={hero.raceName}
          value={`${hero.daysUntilRace} day${hero.daysUntilRace === 1 ? "" : "s"} out`}
          hot={hero.daysUntilRace <= 21}
        />
      ) : null}
      <StatusItem label="Confidence" value={confidence} />

      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-xs text-zinc-400 ring-1 ring-[var(--border-subtle)] transition hover:text-foreground hover:ring-[var(--border-default)] disabled:opacity-60"
      >
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full", syncing && "animate-pulse")}
          style={{ background: apiConnected ? "var(--home-good)" : "var(--hz-moderate)" }}
        />
        {syncing ? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" /> Syncing
          </>
        ) : (
          <>
            <RefreshCw className="h-3 w-3" /> Sync
          </>
        )}
      </button>
    </div>
  );
}

function StatusItem({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      <span
        className={cn(
          "font-mono text-[13px] tabular-nums",
          hot ? "text-[var(--home-signal)]" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ---------------------------------- The Call ------------------------------ */

function TheCall({
  vm,
  today,
  onGeneratePlan,
  planLoading,
  hasSavedPlan,
}: {
  vm: HomeOperatingSystemView;
  today: CalendarWorkout | null;
  onGeneratePlan?: () => void;
  planLoading?: boolean;
  hasSavedPlan: boolean;
}) {
  const tone = verdictTone(vm.hero.freshnessLabel);
  const isRest = today?.modality === "rest" || today?.intensity === "rest";
  const zone: CalendarIntensity = today?.intensity ?? "moderate";

  // Structured readout when a planned session exists; otherwise the heuristic focus.
  const readoutValue = today
    ? isRest
      ? "Rest"
      : today.distanceKm != null
        ? today.distanceKm.toFixed(today.distanceKm % 1 === 0 ? 0 : 1)
        : today.durationMin != null
          ? String(today.durationMin)
          : null
    : null;
  const readoutUnit =
    today && !isRest
      ? today.distanceKm != null
        ? "km"
        : today.durationMin != null
          ? "min"
          : ""
      : "";

  const typeLabel = today
    ? isRest
      ? "Recovery"
      : (today.type || today.intensity).toString()
    : vm.today.fromPlan
      ? "Session"
      : "Focus";
  const sessionTitle = today ? today.title : vm.today.title;
  const why = today ? today.purpose || today.reasoning || vm.today.why : vm.today.why;

  return (
    <Panel bare className="overflow-hidden">
      {/* verdict */}
      <div
        className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5"
        style={{ background: `linear-gradient(180deg, ${tone.wash}, transparent)` }}
      >
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide"
          style={{
            color: tone.color,
            background: tone.wash,
            boxShadow: `inset 0 0 0 1px ${tone.color}`,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.color }} />
          {vm.hero.freshnessLabel}
        </span>
        <span className="text-[13px] text-muted-foreground">{vm.today.stateLine}</span>
      </div>

      {/* session readout */}
      <div className="flex gap-4 px-4 py-5 sm:px-5">
        <span
          className="w-[5px] shrink-0 self-stretch rounded-full"
          style={{ background: ZONE_COLOR[zone] }}
        />
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: isRest ? "var(--muted-subtle)" : "var(--home-signal)" }}
          >
            {typeLabel}
          </p>
          {readoutValue ? (
            <p className="mt-1.5 font-mono text-[clamp(32px,6vw,52px)] font-bold leading-none tracking-tight tabular-nums text-foreground">
              {readoutValue}
              {readoutUnit ? (
                <span className="ml-1 text-[0.4em] font-medium tracking-normal text-zinc-500">
                  {readoutUnit}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-tight text-foreground">
              {sessionTitle}
            </p>
          )}
          {readoutValue ? (
            <p className="mt-1.5 text-sm font-medium text-zinc-300">{sessionTitle}</p>
          ) : null}
          <p className="mt-2.5 max-w-[48ch] text-[13px] leading-snug text-muted-foreground">
            <span className="text-zinc-300">Why this: </span>
            {why}
          </p>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5">
        {hasSavedPlan ? (
          <Link href="/plan">
            <Button
              size="sm"
              className="h-8 gap-1 border-0 text-xs text-[var(--home-signal-ink)]"
              style={{ background: "var(--home-signal)" }}
            >
              Open in plan
            </Button>
          </Link>
        ) : (
          <Button
            size="sm"
            disabled={planLoading}
            onClick={onGeneratePlan}
            className="h-8 gap-1 border-0 text-xs text-[var(--home-signal-ink)]"
            style={{ background: "var(--home-signal)" }}
          >
            <Sparkles className="h-3 w-3" />
            {planLoading ? "Generating…" : "Generate this week"}
          </Button>
        )}
        <Link href={coachUrl({ q: "Refine my session for today" })}>
          <Button size="sm" variant="outline" className="h-8 text-xs">
            Refine in Coach
          </Button>
        </Link>
        <Link href={coachUrl()}>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-zinc-500">
            Ask why <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </Panel>
  );
}

/* ---------------------------------- Readiness ----------------------------- */

function Readiness({
  analytics,
  hero,
}: {
  analytics: DashboardInsights;
  hero: HomeOperatingSystemView["hero"];
}) {
  const { fatigue, summary } = analytics;
  // High freshness = fresh (left, good); low = fatigued (right, redline).
  const needlePct = Math.min(100, Math.max(0, 100 - hero.freshness));
  const activeBand = fatigue.label.toLowerCase();

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>Readiness</Eyebrow>
        <span className="font-mono text-[11px] text-zinc-500">
          TSB {fatigue.tsb > 0 ? "+" : ""}
          {fatigue.tsb}
        </span>
      </div>

      <div className="mb-4">
        <div
          className="relative h-2.5 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--home-good), var(--hz-moderate) 55%, var(--home-redline))",
            opacity: 0.9,
          }}
        >
          <span
            className="absolute -top-1 h-4.5 w-[3px] rounded-sm bg-foreground"
            style={{
              left: `calc(${needlePct}% - 1.5px)`,
              boxShadow: "0 0 0 2px var(--surface-elevated)",
            }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px]">
          {["Fresh", "Neutral", "Fatigued"].map((b) => (
            <span
              key={b}
              className={cn(
                activeBand === b.toLowerCase() ? "font-semibold text-foreground" : "text-zinc-500",
              )}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        <LoadRow k="Freshness" v={String(hero.freshness)} />
        <LoadRow k="Chronic load (CTL)" v={String(fatigue.ctl)} />
        <LoadRow
          k="7-day volume"
          v={`${summary.last7DaysKm.toFixed(0)} km`}
          sub={`${summary.last7DaysRuns} runs`}
        />
        <LoadRow
          k="Rest since last run"
          v={`${fatigue.restDaysSinceLastRun} day${fatigue.restDaysSinceLastRun === 1 ? "" : "s"}`}
        />
      </div>

      {fatigue.evidence[0] ? (
        <p className="mt-3 text-[11px] leading-snug text-zinc-500">{fatigue.evidence[0]}</p>
      ) : null}
    </Panel>
  );
}

function LoadRow({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-[13px] text-muted-foreground">{k}</span>
      <span className="font-mono text-[15px] tabular-nums text-foreground">
        {v}
        {sub ? <span className="ml-1.5 text-[11px] text-zinc-500">{sub}</span> : null}
      </span>
    </div>
  );
}

/* ---------------------------------- Week strip ---------------------------- */

function WeekStrip({
  savedWeek,
  hydrated,
  onGeneratePlan,
  planLoading,
}: {
  savedWeek: TrainingCalendarWeek | null;
  hydrated: boolean;
  onGeneratePlan?: () => void;
  planLoading?: boolean;
}) {
  const workouts = useMemo(
    () => (savedWeek ? [...savedWeek.workouts].sort((a, b) => a.date.localeCompare(b.date)) : []),
    [savedWeek],
  );
  const todayIso = format(new Date(), "yyyy-MM-dd");

  if (hydrated && !savedWeek) {
    return (
      <Panel>
        <Eyebrow className="mb-2">This week</Eyebrow>
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            No plan saved for this week yet. Generate one to see the week laid out by effort.
          </p>
          <Button
            size="sm"
            disabled={planLoading}
            onClick={onGeneratePlan}
            className="h-8 gap-1 border-0 text-xs text-[var(--home-signal-ink)]"
            style={{ background: "var(--home-signal)" }}
          >
            <Sparkles className="h-3 w-3" />
            {planLoading ? "Generating…" : "Generate this week"}
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Eyebrow>
          This week
          {savedWeek?.totalRunDistanceKm != null ? (
            <span className="ml-2 font-mono text-zinc-400">
              {savedWeek.totalRunDistanceKm.toFixed(0)} km
            </span>
          ) : null}
        </Eyebrow>
        <Link
          href="/plan"
          className="inline-flex items-center gap-0.5 font-mono text-[11px] text-zinc-500 hover:text-[var(--home-signal)]"
        >
          Open plan <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {workouts.map((w) => {
          const isToday = w.date.slice(0, 10) === todayIso;
          const isRest = w.modality === "rest" || w.intensity === "rest";
          return (
            <div
              key={w.id}
              className={cn(
                "relative flex min-h-[104px] flex-col gap-1.5 rounded-lg bg-[var(--surface-subdued)] p-2.5 ring-1",
                isToday ? "ring-[var(--home-signal-line)]" : "ring-[var(--border-subtle)]",
              )}
              style={isToday ? { background: "var(--home-signal-wash)" } : undefined}
            >
              {w.status === "completed" ? (
                <span
                  className="absolute right-2 top-2 font-mono text-[9px]"
                  style={{ color: "var(--home-good)" }}
                >
                  done
                </span>
              ) : null}
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-wide",
                  isToday ? "text-[var(--home-signal)]" : "text-zinc-500",
                )}
              >
                {w.day.slice(0, 3)}
                {isToday ? " · today" : ""}
              </span>
              <span
                className={cn(
                  "text-[12px] font-semibold leading-tight",
                  isRest ? "text-zinc-500" : "text-foreground",
                )}
              >
                {isRest ? "Rest" : w.type || w.title}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {isRest
                  ? "—"
                  : w.distanceKm != null
                    ? `${w.distanceKm.toFixed(0)} km`
                    : w.durationMin != null
                      ? `${w.durationMin} min`
                      : ""}
              </span>
              <span
                className="mt-auto h-1 rounded-full"
                style={{ background: ZONE_COLOR[w.intensity] }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {ZONE_LEGEND.map((z) => (
          <span
            key={z.key}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] text-zinc-500"
          >
            <span className="h-1 w-4 rounded-full" style={{ background: ZONE_COLOR[z.key] }} />
            {z.label}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/* ---------------------------------- Trajectory ---------------------------- */

function Trajectory({
  analytics,
  pastRace,
}: {
  analytics: DashboardInsights;
  pastRace?: { label: string; date: string } | null;
}) {
  const rr = analytics.raceReadiness;
  const projectedSec = rr
    ? (analytics.racePredictionAnalysis.consensus.find(
        (c) => c.label === CONSENSUS_LABEL[rr.distance],
      )?.timeSec ?? null)
    : null;
  const targetSec = rr?.targetTimeSec ?? null;
  const deltaSec = projectedSec != null && targetSec != null ? targetSec - projectedSec : null;
  const confPct =
    analytics.racePredictionAnalysis.confidence === "high"
      ? 90
      : analytics.racePredictionAnalysis.confidence === "medium"
        ? 68
        : 42;

  // Real fitness (CTL) trend sparkline from load history.
  const ctlSeries = analytics.loadHistory.slice(-16).map((p) => p.ctl);

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>{rr ? `Projected finish · ${rr.distanceLabel}` : "Fitness trajectory"}</Eyebrow>
        <Link
          href="/goals"
          className="inline-flex items-center gap-0.5 font-mono text-[11px] text-zinc-500 hover:text-[var(--home-signal)]"
        >
          {rr ? "Race view" : "Set a race"} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {rr && projectedSec != null ? (
        <div className="flex items-end gap-4">
          <span className="font-mono text-[clamp(28px,5vw,44px)] font-bold leading-none tracking-tight tabular-nums text-foreground">
            {formatDuration(projectedSec)}
          </span>
          {deltaSec != null ? (
            <span
              className="mb-1.5 font-mono text-[13px]"
              style={{ color: deltaSec >= 0 ? "var(--home-good)" : "var(--home-redline)" }}
            >
              {deltaSec >= 0 ? "−" : "+"}
              {formatDuration(Math.abs(deltaSec))} vs goal
            </span>
          ) : (
            <span className="mb-1.5 font-mono text-[12px] text-zinc-500">{rr.probabilityBand}</span>
          )}
        </div>
      ) : pastRace ? (
        <div
          className="rounded-lg p-3"
          style={{
            background: "var(--home-signal-wash)",
            boxShadow: "inset 0 0 0 1px var(--home-signal-line)",
          }}
        >
          <p className="text-[13px] text-foreground">
            Your {pastRace.label.toLowerCase()} on{" "}
            <span className="font-mono">{format(parseISO(pastRace.date), "d MMM")}</span> has
            passed.
          </p>
          <Link
            href="/goals"
            className="mt-1 inline-flex items-center gap-0.5 text-[12px] font-medium text-[var(--home-signal)] hover:underline"
          >
            Set your next goal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Set a race goal to see a projected finish. Fitness trend shown below.
        </p>
      )}

      {ctlSeries.length > 1 ? (
        <div className="mt-4">
          <Sparkline values={ctlSeries} />
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
            Fitness (CTL) · last {ctlSeries.length} wk
          </p>
        </div>
      ) : null}

      {rr && projectedSec != null ? (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            Confidence
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-subdued)] ring-1 ring-[var(--border-subtle)]">
            <span
              className="block h-full rounded-full"
              style={{ width: `${confPct}%`, background: "var(--home-signal)" }}
            />
          </span>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {confPct}%
          </span>
        </div>
      ) : null}
    </Panel>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 300;
  const h = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ctlFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--home-signal)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--home-signal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ctlFade)" />
      <path
        d={line}
        fill="none"
        stroke="var(--home-signal)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ---------------------------------- Change feed --------------------------- */

function ChangeFeed({ items }: { items: HomeOperatingSystemView["changeFeed"] }) {
  const toneColor = (t: string) =>
    t === "positive"
      ? "var(--home-good)"
      : t === "warning"
        ? "var(--hz-moderate)"
        : "var(--hz-easy)";
  return (
    <Panel>
      <Eyebrow className="mb-3">What changed recently</Eyebrow>
      {items.length === 0 ? (
        <p className="text-[13px] text-zinc-500">No notable changes this block.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
          {items.slice(0, 6).map((it) => (
            <li key={it.id} className="flex items-start gap-2.5 py-2">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: toneColor(it.tone) }}
              />
              <span className="text-[13px] leading-snug text-zinc-200">{it.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------------- Decision support ---------------------- */

function DecisionSupport({
  risks,
  opportunities,
  primaryActionBullets,
}: {
  risks: string[];
  opportunities: string[];
  primaryActionBullets: string[];
}) {
  return (
    <Panel>
      <Eyebrow className="mb-3">Decision support</Eyebrow>
      <div className="grid gap-2.5 lg:grid-cols-3">
        <DecisionCol
          title="Risks"
          items={risks}
          color="var(--hz-moderate)"
          href={topicCoachLink(
            "intensity-stacking",
            "What risks should I address in my current training?",
          )}
        />
        <DecisionCol
          title="Opportunities"
          items={opportunities}
          color="var(--home-good)"
          href={topicCoachLink("opportunities", "Which opportunities should I act on this week?")}
        />
        <DecisionCol
          title="Primary action"
          items={primaryActionBullets}
          color="var(--home-signal)"
          href={topicCoachLink("recommendation", primaryActionBullets[0] ?? "")}
        />
      </div>
    </Panel>
  );
}

function DecisionCol({
  title,
  items,
  color,
  href,
}: {
  title: string;
  items: string[];
  color: string;
  href: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--surface-subdued)] p-3 ring-1 ring-[var(--border-subtle)]">
      <p
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 ? (
          <li className="text-[11px] text-zinc-600">None flagged</li>
        ) : (
          items.slice(0, 4).map((t) => (
            <li key={t} className="flex gap-1.5 text-[12px] leading-snug text-zinc-300">
              <span className="text-zinc-600">–</span>
              <span>{t}</span>
            </li>
          ))
        )}
      </ul>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-0.5 text-[10px] text-zinc-600 hover:text-zinc-300"
      >
        Coach <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
