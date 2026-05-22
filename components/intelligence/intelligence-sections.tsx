"use client";

import Link from "next/link";
import { useState } from "react";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { IntelligenceSignal, TrajectorySeries } from "@/lib/intelligence/athleteState";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import type { RiskOpportunity } from "@/lib/coach/types";
import type { TrainingEcosystemView } from "@/lib/training/ecosystemViewModel";
import {
  domainCoachLink,
  signalCoachLink,
  topicCoachLink,
} from "@/lib/coach/domainLinks";
import { ChartContainer } from "@/components/charts/chart-container";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart } from "recharts";

const toneIcon = {
  positive: Check,
  neutral: TrendingUp,
  warning: AlertTriangle,
  opportunity: Sparkles,
};

const COACH_INVESTIGATIONS = [
  {
    topic: "readiness-change",
    label: "Why did readiness change?",
    query: "Why did my readiness change this week?",
  },
  {
    topic: "cross-training-interference",
    label: "Is cross-training interfering?",
    query: "Is my gym work helping or hurting my running?",
  },
  {
    topic: "block-compare",
    label: "Compare to my strongest block",
    query: "Compare this training block to my strongest historical block.",
  },
  {
    topic: "race-priority",
    label: "Prioritize before race day",
    query: "What should I prioritize before race day?",
  },
  {
    topic: "pace-history",
    label: "What improves my pace historically?",
    query: "What training patterns historically improve my pace?",
  },
];

export function IntelligenceSignalBoard({
  signals,
}: {
  signals: IntelligenceSignal[];
}) {
  if (signals.length === 0) return null;

  return (
    <IntelligenceBlock title="Signal board">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {signals.map((s) => {
          const Icon = toneIcon[s.severity];
          const critical = s.severity === "warning";
          return (
            <div
              key={s.id}
              className={cn(
                "group rounded-lg bg-white/[0.025] p-3 transition-colors hover:bg-white/[0.04]",
                critical && "sm:col-span-2 xl:col-span-1"
              )}
            >
              <div className="flex items-start gap-2">
                <Icon
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    s.severity === "positive"
                      ? "text-teal-400/70"
                      : s.severity === "warning"
                        ? "text-amber-400/75"
                        : "text-zinc-500"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-zinc-600">{s.type}</p>
                  <p className="mt-0.5 text-[13px] font-medium leading-snug text-zinc-200">
                    {s.headline}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500">
                      {s.evidence}
                    </span>
                    <span className="text-[10px] capitalize text-zinc-600">
                      {s.confidence}
                    </span>
                  </div>
                  <Link
                    href={signalCoachLink(`Explain: ${s.text}`)}
                    className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-300"
                  >
                    Ask Coach <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </IntelligenceBlock>
  );
}

export function IntelligenceSynthesis({
  risks,
  opportunities,
  recommendation,
}: {
  risks: RiskOpportunity[];
  opportunities: RiskOpportunity[];
  recommendation: string;
}) {
  if (
    risks.length === 0 &&
    opportunities.length === 0 &&
    !recommendation
  ) {
    return null;
  }

  return (
    <IntelligenceBlock title="Risks, opportunities & action">
      <div className="grid gap-3 md:grid-cols-3">
        <SynthesisColumn
          title="Risks"
          items={risks.map((r) => r.text)}
          tone="risk"
          investigateTopic="intensity-stacking"
          investigateQuery="What risks should I address in my current training?"
        />
        <SynthesisColumn
          title="Opportunities"
          items={opportunities.map((o) => o.text)}
          tone="opp"
          investigateTopic="opportunities"
          investigateQuery="Which opportunities should I act on this week?"
        />
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-[11px] font-medium text-zinc-500">
            Recommended action
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-200">
            {recommendation}
          </p>
          <Link
            href={topicCoachLink("recommendation", recommendation)}
            className="mt-3 inline-flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Investigate <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </IntelligenceBlock>
  );
}

function SynthesisColumn({
  title,
  items,
  tone,
  investigateTopic,
  investigateQuery,
}: {
  title: string;
  items: string[];
  tone: "risk" | "opp";
  investigateTopic: string;
  investigateQuery: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3",
        tone === "risk"
          ? "bg-amber-500/[0.04]"
          : "bg-teal-500/[0.04]"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-medium",
          tone === "risk" ? "text-amber-200/50" : "text-teal-400/60"
        )}
      >
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 ? (
          <li className="text-[12px] text-zinc-600">None flagged</li>
        ) : (
          items.slice(0, 3).map((t) => (
            <li
              key={t}
              className={cn(
                "text-[12px] leading-snug",
                tone === "risk" ? "text-amber-100/75" : "text-teal-100/80"
              )}
            >
              {t}
            </li>
          ))
        )}
      </ul>
      {items.length > 0 ? (
        <Link
          href={topicCoachLink(investigateTopic, investigateQuery)}
          className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          Investigate <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

export function IntelligenceMemoryTiles({
  memory,
}: {
  memory: MemorySnippet[];
}) {
  if (memory.length === 0) return null;

  return (
    <IntelligenceBlock title="Athlete memory">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {memory.slice(0, 6).map((m) => (
          <div
            key={m.id}
            className="rounded-lg bg-white/[0.025] px-3 py-2.5"
          >
            <p className="text-[11px] text-zinc-600">{m.label}</p>
            <p className="mt-1 text-[12px] leading-snug text-zinc-400 line-clamp-3">
              {memoryOneLine(m.text)}
            </p>
            <p className="mt-1.5 text-[10px] capitalize text-zinc-700">
              {m.confidence} confidence
            </p>
          </div>
        ))}
      </div>
    </IntelligenceBlock>
  );
}

export function IntelligenceEcosystemCompact({
  ecosystem,
}: {
  ecosystem: TrainingEcosystemView;
}) {
  const [flagsOpen, setFlagsOpen] = useState(false);
  const load = ecosystem.crossTrainingLoad;
  const topSignals = [
    ...ecosystem.supportCards
      .filter((c) => c.trend !== "warning")
      .slice(0, 2)
      .map((c) => ({ kind: "support" as const, text: `${c.title} — ${c.detail}` })),
    ...ecosystem.interferenceWarnings.slice(0, 2).map((w) => ({
      kind: "flag" as const,
      text: w.message,
    })),
  ].slice(0, 3);

  const extraFlags = ecosystem.interferenceWarnings.slice(2);

  return (
    <IntelligenceBlock title="Training ecosystem · fatigue & support context">
      <p className="text-[14px] leading-relaxed text-zinc-400">
        {ecosystem.archetypeLabel}. Running drives race performance; non-run work
        shapes fatigue, durability, and recovery context.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
        Non-run sessions modify readiness context — they do not directly shift race
        prediction unless volume and timing are calibrated with key runs.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <EcoMetric label="Run volume" value={load.runKm} />
        <EcoMetric label="Strength" value={`${load.strengthSessions} sess`} />
        <EcoMetric label="Mobility" value={`${load.mobilitySessions} sess`} />
        <EcoMetric
          label="Cross-train"
          value={`${load.crossTrainingMinutes}m`}
        />
        <EcoMetric label="HIIT / sport" value={`${load.hiitSessions} sess`} />
        <EcoMetric
          label="Interference"
          value={
            ecosystem.interferenceWarnings.length > 0
              ? `${ecosystem.interferenceWarnings.length} flagged`
              : "Clear"
          }
          warn={ecosystem.interferenceWarnings.length > 0}
        />
      </div>

      {topSignals.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {topSignals.map((s, i) => (
            <li
              key={i}
              className={cn(
                "text-[12px] leading-snug",
                s.kind === "flag" ? "text-amber-200/70" : "text-zinc-400"
              )}
            >
              {s.text}
            </li>
          ))}
        </ul>
      ) : null}

      {extraFlags.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setFlagsOpen((o) => !o)}
            className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400"
          >
            {flagsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {extraFlags.length} more interference flags
          </button>
          {flagsOpen ? (
            <ul className="mt-1.5 space-y-1 pl-4">
              {extraFlags.map((w) => (
                <li key={w.id} className="text-[11px] text-zinc-500">
                  {w.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Link
        href={topicCoachLink(
          "cross-training-interference",
          "Is my cross-training helping or hurting my running?"
        )}
        className="mt-3 inline-flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-zinc-300"
      >
        Ask Coach about ecosystem <ArrowRight className="h-3 w-3" />
      </Link>
    </IntelligenceBlock>
  );
}

function EcoMetric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-white/[0.025] px-2.5 py-2">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[12px] font-medium tabular-nums text-zinc-300",
          warn && "text-amber-200/80"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function IntelligenceTrajectoryStrip({
  series,
}: {
  series: TrajectorySeries[];
}) {
  const usable = series.filter((s) => s.values.length >= 2);
  if (usable.length === 0) return null;

  return (
    <IntelligenceBlock title="Current trajectory">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {usable.map((s) => (
          <div key={s.id} className="rounded-lg bg-white/[0.025] px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] text-zinc-600">{s.label}</p>
              <TrendBadge trend={s.trend} />
            </div>
            <ChartContainer height={44} className="mt-1.5 w-full">
              {({ width, height }) => (
                <AreaChart width={width} height={height} data={s.values}>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="rgba(161,161,170,0.5)"
                    strokeWidth={1}
                    fill="rgba(255,255,255,0.04)"
                    dot={false}
                  />
                </AreaChart>
              )}
            </ChartContainer>
            <p className="mt-1.5 text-[11px] text-zinc-500">{s.interpretation}</p>
          </div>
        ))}
      </div>
    </IntelligenceBlock>
  );
}

function TrendBadge({ trend }: { trend: "up" | "down" | "flat" }) {
  const label =
    trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  return (
    <span className="text-[10px] tabular-nums text-zinc-600">{label}</span>
  );
}

export function IntelligenceCoachEntries({
  domains,
}: {
  domains: CoachWorkspaceState["domains"];
}) {
  const domainRows = domains.slice(0, 3);

  return (
    <IntelligenceBlock title="Investigate with Coach">
      <ul className="divide-y divide-white/[0.04]">
        {COACH_INVESTIGATIONS.map((item) => (
          <li key={item.topic}>
            <Link
              href={topicCoachLink(item.topic, item.query)}
              className="group flex items-center justify-between gap-3 py-2.5 text-[13px] text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <span>{item.label}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
            </Link>
          </li>
        ))}
        {domainRows.map((d) => (
          <li key={d.id}>
            <Link
              href={domainCoachLink(d)}
              className="group flex items-center justify-between gap-3 py-2.5 text-[13px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <span>{d.title}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </Link>
          </li>
        ))}
      </ul>
    </IntelligenceBlock>
  );
}

function IntelligenceBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="intelligence-block">
      <h2 className="mb-3 text-[12px] font-medium text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

function memoryOneLine(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** @deprecated Use IntelligenceSignalBoard */
export function IntelligenceSignals(props: {
  signals: IntelligenceSignal[];
}) {
  return <IntelligenceSignalBoard {...props} />;
}

/** @deprecated Use IntelligenceSynthesis */
export function IntelligenceRisksOpportunities({
  items,
  recommendation,
}: {
  items: RiskOpportunity[];
  recommendation?: string;
}) {
  return (
    <IntelligenceSynthesis
      risks={items.filter((i) => i.kind === "risk")}
      opportunities={items.filter((i) => i.kind === "opportunity")}
      recommendation={recommendation ?? ""}
    />
  );
}

/** @deprecated */
export function IntelligenceMemory(props: { memory: MemorySnippet[] }) {
  return <IntelligenceMemoryTiles {...props} />;
}

/** @deprecated */
export function IntelligenceEcosystem(props: {
  ecosystem: TrainingEcosystemView;
}) {
  return <IntelligenceEcosystemCompact {...props} />;
}

/** @deprecated */
export function IntelligenceTrajectory(props: {
  series: TrajectorySeries[];
}) {
  return <IntelligenceTrajectoryStrip {...props} />;
}

/** @deprecated */
export function IntelligenceDomains(props: {
  domains: CoachWorkspaceState["domains"];
}) {
  return <IntelligenceCoachEntries {...props} />;
}

/** @deprecated */
export function IntelligenceCoachingState() {
  return null;
}
