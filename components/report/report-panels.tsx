"use client";

import type {
  CoachingRecommendationView,
  ConfidenceBriefView,
  PerformanceMetricCluster,
  RaceReadinessBriefingView,
  SynthesizedSignalView,
} from "@/lib/report/viewModels";
import type { ReportEcosystemView } from "@/lib/training/ecosystemViewModel";
import type { WeeklyNarrative } from "@/lib/analytics/narrative";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { cn } from "@/lib/utils";

const toneBorder = {
  positive: "border-l-accent/60",
  neutral: "border-l-zinc-400",
  warning: "border-l-amber-600/70",
};

export function ReportTrainingState({
  classification,
  narrative,
  currentWeek,
  previousWeek,
  consistency,
  intensity,
}: {
  classification: string;
  narrative: WeeklyNarrative;
  currentWeek: string;
  previousWeek: string | null;
  consistency: string;
  intensity: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-zinc-800">
        Current state · <span className="text-accent">{classification}</span>
      </p>
      {narrative.paragraphs.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-zinc-700">
          {p}
        </p>
      ))}
      {narrative.bullets.length > 0 ? (
        <ul className="space-y-1.5 text-sm text-zinc-600">
          {narrative.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent">·</span>
              {b}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <MetricChip label="This week" value={currentWeek} />
        {previousWeek ? <MetricChip label="Prior week" value={previousWeek} /> : null}
        <MetricChip label="Consistency" value={consistency} />
        <MetricChip label="Intensity" value={intensity} />
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5 ring-1 ring-inset ring-zinc-200/80 print:bg-zinc-50">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-800">{value}</p>
    </div>
  );
}

export function ReportKeySignals({ signals }: { signals: SynthesizedSignalView[] }) {
  return (
    <ul className="space-y-3">
      {signals.map((s, i) => (
        <li
          key={i}
          className={cn(
            "rounded-lg border border-zinc-200/80 border-l-[3px] bg-white px-4 py-3.5 print:break-inside-avoid",
            toneBorder[s.tone],
          )}
        >
          <p className="text-sm font-medium text-zinc-900">{s.text}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">{s.significance}</p>
        </li>
      ))}
    </ul>
  );
}

export function ReportAdaptation({
  headline,
  interpretation,
  bullets,
  progressionNote,
}: {
  headline: string;
  interpretation: string;
  bullets: string[];
  progressionNote: string | null;
}) {
  return (
    <div className="space-y-4">
      <p className="font-display text-lg font-semibold text-zinc-900">{headline}</p>
      <p className="text-sm leading-relaxed text-zinc-700">{interpretation}</p>
      <ul className="space-y-1 text-sm text-zinc-600">
        {bullets.map((b, i) => (
          <li key={i}>· {b}</li>
        ))}
      </ul>
      {progressionNote ? (
        <p className="rounded-lg bg-accent/80 px-3 py-2.5 text-xs text-accent ring-1 ring-inset ring-accent/60">
          {progressionNote}
        </p>
      ) : null}
    </div>
  );
}

export function ReportRaceBriefing({ data }: { data: RaceReadinessBriefingView }) {
  return (
    <div className="report-race-briefing grid gap-5 print:break-inside-avoid sm:grid-cols-2">
      <div className="space-y-3">
        <p className="font-display text-3xl font-bold tabular-nums text-zinc-900">
          {data.score}
          <span className="text-lg font-normal text-zinc-500"> / 100</span>
        </p>
        <p className="text-sm text-zinc-600">
          {data.distanceLabel} · {data.label}
        </p>
        <ConfidenceBadge level={data.confidence} />
        {data.probabilityBand ? (
          <p className="text-xs text-zinc-600">{data.probabilityBand}</p>
        ) : null}
        {data.daysUntilRace != null ? (
          <p className="text-xs text-zinc-500">
            {data.daysUntilRace === 0 ? "Race day" : `${data.daysUntilRace} days remaining`}
          </p>
        ) : null}
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Strongest signal
          </dt>
          <dd className="mt-1 text-zinc-800">{data.strongestSignal}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Largest risk
          </dt>
          <dd className="mt-1 text-zinc-800">{data.largestRisk}</dd>
        </div>
        {data.projectedRange ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Projected finish
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-zinc-900">{data.projectedRange}</dd>
          </div>
        ) : null}
        {data.pacingGuidance ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Pacing guidance
            </dt>
            <dd className="mt-1 text-zinc-700">{data.pacingGuidance}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function ReportCoaching({ data }: { data: CoachingRecommendationView }) {
  return (
    <div className="space-y-5 print:break-inside-avoid">
      <div className="rounded-xl border border-accent/80 bg-accent/50 px-5 py-4 print:border-accent print:bg-accent">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          Primary focus
        </p>
        <p className="mt-2 text-base font-medium leading-snug text-zinc-900">{data.primaryFocus}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Week plan
          </p>
          <p className="mt-1 text-sm text-zinc-800">
            {data.weekLabel} · {data.volumeRange}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">Template: {data.focusArea}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Recommendation confidence
          </p>
          <p className="mt-1 flex items-center gap-2">
            <ConfidenceBadge level={data.confidence} />
            <span className="text-sm text-zinc-700">{data.confidenceLabel}</span>
          </p>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Rationale
        </p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-700">
          {data.rationale.map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-zinc-700">
        <span className="font-medium text-zinc-900">Expected adaptation · </span>
        {data.expectedAdaptation}
      </p>
    </div>
  );
}

export function ReportMetrics({ clusters }: { clusters: PerformanceMetricCluster[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {clusters.map((m) => (
        <div
          key={m.label}
          className="rounded-lg bg-zinc-50 px-3 py-3 ring-1 ring-inset ring-zinc-200/80 print:break-inside-avoid"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {m.label}
          </p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-zinc-900">
            {m.value}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">{m.context}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportHistory({
  recentRuns,
  prHighlights,
  bestBlock,
}: {
  recentRuns: { date: string; name: string; distance: string; pace: string | null }[];
  prHighlights: { label: string; value: string }[];
  bestBlock: string | null;
}) {
  return (
    <div className="space-y-6">
      {bestBlock ? (
        <p className="text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Best block · </span>
          {bestBlock}
        </p>
      ) : null}
      {prHighlights.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Record highlights
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {prHighlights.map((pr) => (
              <li
                key={pr.label}
                className="rounded-lg border border-zinc-200/80 px-3 py-2 text-sm print:break-inside-avoid"
              >
                <span className="font-medium text-zinc-800">{pr.label}</span>
                <span className="mt-0.5 block text-xs text-zinc-600">{pr.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Recent runs
        </p>
        <table className="w-full text-sm text-zinc-800">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="pb-2 pr-3 font-semibold">Date</th>
              <th className="pb-2 pr-3 font-semibold">Activity</th>
              <th className="pb-2 pr-3 font-semibold">Dist</th>
              <th className="pb-2 font-semibold">Pace</th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.map((r, i) => (
              <tr key={i} className="border-b border-zinc-200/80">
                <td className="py-2 pr-3 tabular-nums">{r.date}</td>
                <td className="py-2 pr-3">{r.name}</td>
                <td className="py-2 pr-3 tabular-nums">{r.distance}</td>
                <td className="py-2 tabular-nums">{r.pace ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportConfidence({ data }: { data: ConfidenceBriefView }) {
  return (
    <div className="space-y-5 print:break-inside-avoid">
      <div className="flex items-center gap-3">
        <p className="text-sm text-zinc-700">
          Overall data confidence ·{" "}
          <span className="font-semibold text-zinc-900">{data.overallLabel}</span>
        </p>
        <ConfidenceBadge level={data.overall} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            Strong evidence
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {data.strongEvidence.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Missing / weak
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600">
            {data.missing.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span>○</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {data.fieldCoverage.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Field coverage
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.fieldCoverage.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 text-zinc-600">{f.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-accent/70 print:bg-zinc-700"
                    style={{ width: `${f.pct}%` }}
                  />
                </div>
                <span className="w-8 tabular-nums text-zinc-700">{f.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <ul className="space-y-1 text-xs text-zinc-600">
        {data.limitations.map((line, i) => (
          <li key={i}>· {line}</li>
        ))}
      </ul>
    </div>
  );
}

export function ReportTrainingEcosystem({ data }: { data: ReportEcosystemView }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-700">
        Athlete profile: <span className="font-medium">{data.archetypeLabel}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricChip label="Run volume (28d)" value={data.runVolumeKm} />
        <MetricChip label="Bike (28d)" value={data.bikeHours} />
        <MetricChip label="Swim (28d)" value={data.swimHours} />
        <MetricChip label="Other cross-train" value={data.crossTrainingHours} />
        <MetricChip label="Strength sessions" value={String(data.strengthSessions)} />
        <MetricChip label="Mobility sessions" value={String(data.mobilitySessions)} />
      </div>
      {data.interferenceCount > 0 ? (
        <p className="text-sm text-amber-800">
          {data.interferenceCount} interference flag(s): hard non-run sessions within 24–48h of
          quality runs.
        </p>
      ) : (
        <p className="text-sm text-zinc-700">
          No high-severity interference flags in the current window.
        </p>
      )}
      {data.supportHighlights.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Support signals
          </p>
          <ul className="space-y-1 text-sm text-zinc-700">
            {data.supportHighlights.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">·</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.sportMix.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Sport mix (28d)
          </p>
          <div className="flex flex-wrap gap-2">
            {data.sportMix.map((s) => (
              <span
                key={s.label}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700"
              >
                {s.label} ×{s.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <ul className="space-y-1 text-xs text-zinc-600">
        {data.limitations.map((line, i) => (
          <li key={i}>· {line}</li>
        ))}
      </ul>
    </div>
  );
}
