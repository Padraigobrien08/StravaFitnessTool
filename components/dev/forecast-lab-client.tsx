"use client";

import { useMemo, useState } from "react";
import {
  FORECAST_FIXTURES,
  evaluateForecastFixture,
  type ForecastEvaluationReport,
  type ForecastFixtureProfile,
} from "@/lib/forecasting-v2/evaluation";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

function formatSec(sec: number): string {
  return formatDuration(sec);
}

function RuleRow({
  rule,
}: {
  rule: ForecastEvaluationReport["rules"][number];
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2 text-[12px]",
        rule.passed
          ? "border-white/[0.04] bg-white/[0.02] text-zinc-500"
          : rule.severity === "error"
            ? "border-red-500/25 bg-red-500/[0.06] text-red-200/90"
            : "border-amber-500/20 bg-amber-500/[0.06] text-amber-100/90"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-zinc-600">{rule.ruleId}</span>
        <span className="text-[10px] uppercase tracking-wide text-zinc-600">
          {rule.passed ? "pass" : rule.severity}
        </span>
      </div>
      <p className="mt-1 leading-snug">{rule.message}</p>
    </div>
  );
}

export function ForecastLabClient() {
  const [fixtureId, setFixtureId] = useState<string>(FORECAST_FIXTURES[0]!.id);

  const profile = useMemo(
    () => FORECAST_FIXTURES.find((f) => f.id === fixtureId) ?? FORECAST_FIXTURES[0]!,
    [fixtureId]
  );

  const report = useMemo(
    () => evaluateForecastFixture(profile),
    [profile]
  );

  const { forecast: f, observability: obs } = report;
  const failed = report.rules.filter((r) => !r.passed);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2 border-b border-white/[0.06] pb-6">
        <p className="text-[11px] font-medium uppercase tracking-wider text-amber-400/80">
          Internal · Forecast integrity lab
        </p>
        <h1 className="font-display text-2xl font-bold text-white">
          Forecast V2 evaluation workbench
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Audit harness for coherence, stability, and recommendation alignment.
          Fixtures are synthetic profiles—not your Strava data. For your real
          forecast, use Goals → Forecast V2. Try &quot;Near-race evidence
          (20.5k + 10 mi)&quot; to mirror a 1:53 long run and 1:22 ten-miler.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[240px] flex-1">
          <span className="mb-1.5 block text-[11px] text-zinc-500">Fixture athlete</span>
          <select
            value={fixtureId}
            onChange={(e) => setFixtureId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200"
          >
            {FORECAST_FIXTURES.map((fx) => (
              <option key={fx.id} value={fx.id}>
                {fx.label}
              </option>
            ))}
          </select>
        </label>
        <StatusBadge report={report} profile={profile} />
      </div>

      <p className="text-sm text-zinc-500">{profile.description}</p>

      {report.fixtureExpectation && !report.fixtureExpectation.met ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100/90">
          <p className="font-medium">Fixture expectations not met</p>
          <ul className="mt-2 list-inside list-disc text-[13px] text-amber-200/80">
            {report.fixtureExpectation.failures.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Forecast summary">
          <dl className="grid gap-3 text-sm">
            <Row label="Distance" value={f.distanceLabel} />
            <Row label="Most likely" value={formatSec(f.mostLikelyTimeSec)} />
            <Row
              label="Interval p10–p90"
              value={`${formatSec(f.predictionIntervalSec.p10)} – ${formatSec(f.predictionIntervalSec.p90)}`}
            />
            <Row label="Conservative" value={formatSec(f.conservativeTimeSec)} />
            <Row label="Optimistic" value={formatSec(f.optimisticTimeSec)} />
            <Row label="Confidence" value={`${f.confidence} (${f.confidenceScore})`} />
            <Row label="Model agreement" value={f.modelAgreement.label} />
          </dl>
        </Panel>

        <Panel title="Component scores">
          <dl className="grid gap-2 text-sm">
            {Object.entries(f.componentScores).map(([k, v]) => (
              <Row key={k} label={k} value={String(v)} />
            ))}
          </dl>
        </Panel>

        <Panel title="Validation summary">
          <dl className="grid gap-2 text-sm">
            <Row label="Errors" value={String(report.errorCount)} />
            <Row label="Warnings" value={String(report.warningCount)} />
            <Row label="Rules passed" value={String(obs.passedRules.length)} />
            <Row label="Rules failed" value={String(obs.failedRules.length)} />
            <Row
              label="Production gate"
              value={report.passed && (report.fixtureExpectation?.met ?? true) ? "pass" : "fail"}
            />
          </dl>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Model estimates">
          <div className="space-y-2">
            {f.modelEstimates.map((m) => (
              <div
                key={m.modelName}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-white/[0.03] px-3 py-2 text-[13px]"
              >
                <span className="text-zinc-300">{m.modelName}</span>
                <span className="tabular-nums text-zinc-400">
                  {formatSec(m.predictedTimeSec)} · w={(m.weight * 100).toFixed(0)}% · c=
                  {m.confidence}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Model weights (observability)">
          <div className="space-y-2">
            {obs.modelWeights.map((m) => (
              <div key={m.modelName} className="rounded-md bg-white/[0.03] px-3 py-2 text-[12px]">
                <p className="text-zinc-300">
                  {m.modelName}{" "}
                  <span className="text-zinc-600">({(m.weight * 100).toFixed(0)}%)</span>
                </p>
                <p className="mt-0.5 text-zinc-500">{m.reason}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Contributors">
          <ContributorList title="Positive" items={f.contributors.positive} />
          <ContributorList title="Negative" items={f.contributors.negative} className="mt-3" />
        </Panel>

        <Panel title="Uncertainty drivers">
          <ul className="space-y-2 text-[13px] text-zinc-400">
            {f.uncertaintyDrivers.map((d) => (
              <li key={d.label} className="rounded-md bg-white/[0.03] px-3 py-2">
                <span className="text-zinc-300">{d.label}</span>
                <span className="text-zinc-600"> · {d.impact}</span>
                <p className="mt-0.5 text-zinc-500">{d.explanation}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Recommendation & basis">
        <p className="text-sm leading-relaxed text-zinc-300">{f.recommendation}</p>
        <ul className="mt-3 space-y-1 text-[12px] text-zinc-500">
          {obs.recommendationBasis.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Failed checks (${failed.length})`}>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {failed.length === 0 ? (
              <p className="text-sm text-zinc-600">All validation rules passed.</p>
            ) : (
              failed.map((r) => <RuleRow key={r.ruleId} rule={r} />)
            )}
          </div>
        </Panel>

        <Panel title={`Passed checks (${obs.passedRules.length})`}>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {obs.passedRules.map((r) => (
              <RuleRow key={r.ruleId} rule={r} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Evidence chain & engine warnings">
        <ul className="list-inside list-disc text-[13px] text-zinc-500">
          {obs.evidenceChain.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        {obs.warnings.length > 0 ? (
          <ul className="mt-3 list-inside list-disc text-[13px] text-amber-200/70">
            {obs.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  );
}

function StatusBadge({
  report,
  profile,
}: {
  report: ForecastEvaluationReport;
  profile: ForecastFixtureProfile;
}) {
  const ok = report.errorCount === 0 && (report.fixtureExpectation?.met ?? true);
  return (
    <div
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-medium",
        ok ? "bg-teal-500/15 text-teal-300" : "bg-amber-500/15 text-amber-200"
      )}
    >
      {ok ? "Fixture OK" : "Needs review"} · {profile.id}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-zinc-200">{value}</dd>
    </div>
  );
}

function ContributorList({
  title,
  items,
  className,
}: {
  title: string;
  items: ForecastEvaluationReport["forecast"]["contributors"]["positive"];
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-[11px] text-zinc-600">{title}</p>
      <ul className="space-y-2 text-[12px] text-zinc-400">
        {items.map((c) => (
          <li key={c.label + c.evidence} className="rounded-md bg-white/[0.03] px-2 py-1.5">
            <span className="text-zinc-300">{c.label}</span> — {c.evidence}
          </li>
        ))}
      </ul>
    </div>
  );
}
