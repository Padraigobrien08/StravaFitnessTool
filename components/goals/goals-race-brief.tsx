"use client";

import type { GoalsRaceBriefView } from "@/lib/goals/goalsRaceBrief";
import { GoalsCoachPrompts } from "@/components/goals/goals-coach-prompts";
import { Eyebrow, Panel, Readout } from "@/components/console/console-kit";
import { cn } from "@/lib/utils";

export function GoalsRaceBrief({ brief }: { brief: GoalsRaceBriefView }) {
  return (
    <Panel bare className="overflow-hidden">
      <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_minmax(180px,220px)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div>
            <Eyebrow>Race forecast{brief.distanceLabel ? ` · ${brief.distanceLabel}` : ""}</Eyebrow>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {brief.headline}
            </h2>
            {brief.targetTimeDisplay ? (
              <p className="mt-1 text-sm text-zinc-500">
                Goal ·{" "}
                <span className="font-medium tabular-nums text-zinc-300">
                  {brief.targetTimeDisplay}
                </span>
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-[11px] font-medium text-zinc-600">Current belief</p>
            <p className="mt-1.5 max-w-2xl text-[15px] leading-[1.62] text-zinc-300">
              {brief.belief}
            </p>
          </div>

          <div
            className="rounded-lg px-3.5 py-3"
            style={{
              background: "var(--home-signal-wash)",
              boxShadow: "inset 0 0 0 1px var(--home-signal-line)",
            }}
          >
            <p className="text-[11px] font-medium" style={{ color: "var(--home-signal)" }}>
              Primary action
            </p>
            <p className="mt-1.5 text-[14px] leading-[1.55] text-foreground">
              {brief.primaryAction}
            </p>
          </div>

          {brief.evidenceBullets.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium text-zinc-600">Evidence</p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-[1.5] text-zinc-500">
                {brief.evidenceBullets.map((item, i) => (
                  <li key={i} className="flex gap-2 pl-0.5">
                    <span className="mt-[0.55rem] h-px w-2 shrink-0 bg-zinc-600/80" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[13px] leading-relaxed text-zinc-500">
            <span className="font-medium text-zinc-400">Confidence · </span>
            {brief.confidenceLine}
          </p>

          {brief.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-amber-500/15 bg-amber-500/[0.05] px-3 py-2.5 text-[12px] text-amber-200/80">
              {brief.warnings.map((w, i) => (
                <li key={`${i}-${w}`}>· {w}</li>
              ))}
            </ul>
          ) : null}

          <GoalsCoachPrompts prompts={brief.coachPrompts} />
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg bg-[var(--surface-subdued)] p-3.5 ring-1 ring-[var(--border-subtle)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Most likely
            </p>
            <Readout value={brief.mostLikely} className="mt-1 text-[clamp(26px,4vw,36px)]" />
            {brief.distanceLabel ? (
              <p className="mt-1 font-mono text-[11px] text-zinc-500">{brief.distanceLabel}</p>
            ) : null}
          </div>
          <BriefMetric label="Range" value={brief.rangeDisplay} sub="likely range" />
          {brief.readinessScore != null ? (
            <BriefMetric
              label="Readiness"
              value={String(brief.readinessScore)}
              sub={brief.readinessLabel ?? undefined}
            />
          ) : null}
        </aside>
      </div>
    </Panel>
  );
}

function BriefMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-subdued)] px-3 py-2.5 ring-1 ring-[var(--border-subtle)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono font-semibold tabular-nums text-foreground",
          value.length > 12 ? "text-base" : "text-lg",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p> : null}
    </div>
  );
}
