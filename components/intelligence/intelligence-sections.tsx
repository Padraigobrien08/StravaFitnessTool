"use client";

import Link from "next/link";
import { useState } from "react";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { IntelligenceSignal } from "@/lib/intelligence/athleteState";
import type { StateEvolutionItem } from "@/lib/intelligence/presentation";
import {
  memoryKind,
  primaryActionBullets,
  prioritizeSignals,
} from "@/lib/intelligence/presentation";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import type { RiskOpportunity } from "@/lib/coach/types";
import type { TrainingEcosystemView } from "@/lib/training/ecosystemViewModel";
import { domainCoachLink, signalCoachLink, topicCoachLink } from "@/lib/coach/domainLinks";
import { ChartContainer } from "@/components/charts/chart-container";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart } from "recharts";

const COACH_INVESTIGATIONS: {
  topic: string;
  label: string;
  why: string;
  query: string;
}[] = [
  {
    topic: "readiness-change",
    label: "Why did readiness change?",
    why: "Readiness shifts with taper, volume, and freshness balance.",
    query: "Why did my readiness change this week?",
  },
  {
    topic: "cross-training-interference",
    label: "Is cross-training interfering?",
    why: "Non-run timing can compress recovery before key sessions.",
    query: "Is my gym work helping or hurting my running?",
  },
  {
    topic: "strongest-block",
    label: "Compare to strongest block",
    why: "Current load may mirror your best historical volume phase.",
    query: "Compare this training block to my strongest historical block.",
  },
  {
    topic: "pace-improvement",
    label: "What improves my pace historically?",
    why: "Aerobic efficiency is often the strongest adaptation signal.",
    query: "What training patterns historically improve my pace?",
  },
];

export function IntelligenceStateEvolution({
  items,
}: {
  items: StateEvolutionItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="intelligence-evolution rounded-xl bg-white/[0.02] px-3 py-3 sm:px-4">
      <p className="mb-2.5 text-[11px] font-medium text-zinc-600">
        How your state is moving
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {items.map((item) => (
          <div
            key={item.id}
            className="min-w-[148px] shrink-0 rounded-lg bg-white/[0.03] px-2.5 py-2 sm:min-w-[160px]"
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] text-zinc-500">{item.label}</p>
              <TrendGlyph trend={item.trend} />
            </div>
            <p className="mt-0.5 text-[13px] font-medium leading-snug text-zinc-200">
              {item.direction}
            </p>
            <p className="text-[11px] text-zinc-500">{item.interpretation}</p>
            {item.values.length >= 2 ? (
              <ChartContainer height={28} className="mt-1.5 w-full">
                {({ width, height }) => (
                  <AreaChart width={width} height={height} data={item.values}>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="rgba(113,113,122,0.55)"
                      strokeWidth={1}
                      fill="rgba(255,255,255,0.03)"
                      dot={false}
                    />
                  </AreaChart>
                )}
              </ChartContainer>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendGlyph({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-zinc-500" />;
  if (trend === "down")
    return <TrendingDown className="h-3 w-3 text-zinc-500" />;
  return <span className="text-[10px] text-zinc-600">→</span>;
}

export function IntelligenceSignalBoard({
  signals,
}: {
  signals: IntelligenceSignal[];
}) {
  const { primary, secondary, watchlist } = prioritizeSignals(signals);
  if (!primary && secondary.length === 0 && watchlist.length === 0) return null;

  return (
    <Section title="Prioritized signals">
      <div className="space-y-3">
        {primary ? (
          <div className="group rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06]">
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400/70" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-600">{primary.type}</p>
                <p className="mt-1 text-[16px] font-medium leading-snug text-zinc-100">
                  {primary.headline}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                  {primary.text}
                </p>
                <SignalMeta signal={primary} className="mt-3" />
                <Link
                  href={signalCoachLink(`Explain: ${primary.text}`)}
                  className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-300"
                >
                  Ask Coach <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {(secondary.length > 0 || watchlist.length > 0) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {secondary.map((s) => (
              <CompactSignalCard key={s.id} signal={s} />
            ))}
            {watchlist.map((s) => (
              <CompactSignalCard key={s.id} signal={s} watch />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function CompactSignalCard({
  signal,
  watch,
}: {
  signal: IntelligenceSignal;
  watch?: boolean;
}) {
  const Icon = watch ? AlertTriangle : Check;
  return (
    <div
      className={cn(
        "group rounded-lg px-3 py-2.5",
        watch ? "bg-amber-500/[0.05]" : "bg-white/[0.025]"
      )}
    >
      <div className="flex gap-2">
        <Icon
          className={cn(
            "mt-0.5 h-3 w-3 shrink-0",
            watch ? "text-amber-400/70" : "text-zinc-500"
          )}
        />
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-zinc-300">{signal.headline}</p>
          <SignalMeta signal={signal} className="mt-1.5" compact />
        </div>
      </div>
    </div>
  );
}

function SignalMeta({
  signal,
  className,
  compact,
}: {
  signal: IntelligenceSignal;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-600",
        className
      )}
    >
      {!compact ? (
        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-zinc-500">
          {signal.evidence}
        </span>
      ) : null}
      <span className="capitalize">{signal.confidence} confidence</span>
    </div>
  );
}

export function IntelligenceDecisionSupport({
  risks,
  opportunities,
  recommendation,
}: {
  risks: RiskOpportunity[];
  opportunities: RiskOpportunity[];
  recommendation: string;
}) {
  const actionBullets = primaryActionBullets(recommendation);

  return (
    <Section title="Decision support">
      <div className="grid gap-3 lg:grid-cols-3">
        <DecisionColumn
          title="Risks"
          items={risks.map((r) => r.text)}
          tone="risk"
          topic="intensity-stacking"
          query="What risks should I address in my current training?"
        />
        <DecisionColumn
          title="Opportunities"
          items={opportunities.map((o) => o.text)}
          tone="opp"
          topic="opportunities"
          query="Which opportunities should I act on this week?"
        />
        <div className="rounded-xl bg-zinc-100/[0.06] p-3.5 ring-1 ring-white/[0.08]">
          <p className="text-[11px] font-medium text-zinc-400">Primary action</p>
          <ul className="mt-2.5 space-y-2">
            {actionBullets.map((line) => (
              <li
                key={line}
                className="flex gap-2 text-[13px] leading-snug text-zinc-100"
              >
                <span className="text-zinc-600">–</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Link
            href={topicCoachLink("recommendation", recommendation)}
            className="mt-3 inline-flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Investigate with Coach <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </Section>
  );
}

function DecisionColumn({
  title,
  items,
  tone,
  topic,
  query,
}: {
  title: string;
  items: string[];
  tone: "risk" | "opp";
  topic: string;
  query: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-3.5",
        tone === "risk" ? "bg-amber-500/[0.05]" : "bg-teal-500/[0.05]"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-medium",
          tone === "risk" ? "text-amber-200/55" : "text-teal-400/55"
        )}
      >
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 ? (
          <li className="text-[12px] text-zinc-600">None flagged</li>
        ) : (
          items.slice(0, 4).map((t) => (
            <li
              key={t}
              className={cn(
                "text-[12px] leading-snug",
                tone === "risk" ? "text-amber-100/80" : "text-teal-100/85"
              )}
            >
              {t}
            </li>
          ))
        )}
      </ul>
      <Link
        href={topicCoachLink(topic, query)}
        className="mt-2.5 inline-flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-zinc-300"
      >
        Investigate with Coach <ArrowRight className="h-3 w-3" />
      </Link>
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
    <Section title="Athlete memory" className="h-full">
      <div className="grid gap-2 sm:grid-cols-2">
        {memory.slice(0, 6).map((m) => (
          <div
            key={m.id}
            className="group rounded-lg bg-white/[0.025] px-3 py-2.5"
          >
            <p className="text-[11px] font-medium text-zinc-500">{m.label}</p>
            <p className="mt-0.5 text-[10px] text-zinc-700">{memoryKind(m.label)}</p>
            <p className="mt-1.5 text-[12px] leading-snug text-zinc-400 line-clamp-3">
              {memoryOneLine(m.text, 100)}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] capitalize text-zinc-700">
                {m.confidence} confidence
              </span>
              <Link
                href={signalCoachLink(`Explain my ${m.label.toLowerCase()}: ${m.text}`)}
                className="text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-400"
              >
                Ask Coach
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function IntelligenceEcosystemCompact({
  ecosystem,
  embedded,
}: {
  ecosystem: TrainingEcosystemView;
  embedded?: boolean;
}) {
  const [flagsOpen, setFlagsOpen] = useState(false);
  const load = ecosystem.crossTrainingLoad;

  const topSignals = [
    ...ecosystem.supportCards.slice(0, 2).map((c) => ({
      warn: c.trend === "warning",
      text:
        c.trend === "positive"
          ? `${c.title} consistent`
          : c.trend === "warning"
            ? `${c.title} low`
            : `${c.title} — ${c.detail}`,
    })),
    ...ecosystem.interferenceWarnings.slice(0, 1).map((w) => ({
      warn: true,
      text: w.message,
    })),
  ].slice(0, 3);

  const allFlags = ecosystem.interferenceWarnings;

  const body = (
    <>
      <p className="text-[13px] leading-relaxed text-zinc-400">
        <span className="text-zinc-300">{ecosystem.archetypeLabel}</span> profile.
        Running drives race performance; non-run work shapes fatigue, durability, and
        recovery context.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
        Non-run work informs fatigue and support context; it does not directly improve
        race predictions unless calibrated with key runs.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <EcoMetric label="Run volume" value={load.runKm} />
        <EcoMetric label="Strength" value={`${load.strengthSessions}`} />
        <EcoMetric label="Mobility" value={`${load.mobilitySessions}`} />
        <EcoMetric label="Cross-train" value={`${load.crossTrainingMinutes}m`} />
        <EcoMetric label="HIIT / sport" value={`${load.hiitSessions}`} />
        <EcoMetric
          label="Flags"
          value={allFlags.length > 0 ? String(allFlags.length) : "0"}
          warn={allFlags.length > 0}
        />
      </div>

      {topSignals.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {topSignals.map((s, i) => (
            <li
              key={i}
              className={cn(
                "text-[12px] leading-snug",
                s.warn ? "text-amber-200/65" : "text-zinc-500"
              )}
            >
              {s.text}
            </li>
          ))}
        </ul>
      ) : null}

      {allFlags.length > 0 ? (
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
            Show interference details
          </button>
          {flagsOpen ? (
            <ul className="mt-1.5 space-y-1 border-l border-white/[0.06] pl-3">
              {allFlags.map((w) => (
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
        className="mt-3 inline-flex items-center gap-0.5 text-[11px] text-zinc-600 hover:text-zinc-400"
      >
        Investigate with Coach <ArrowRight className="h-3 w-3" />
      </Link>
    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full flex-col">
        <h2 className="mb-3 text-[12px] font-medium text-zinc-500">
          Training ecosystem · fatigue & support
        </h2>
        {body}
      </div>
    );
  }

  return (
    <Section title="Training ecosystem · fatigue & support">{body}</Section>
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
    <div className="rounded-md bg-white/[0.025] px-2 py-1.5 text-center">
      <p className="text-[9px] text-zinc-600">{label}</p>
      <p
        className={cn(
          "text-[11px] font-medium tabular-nums text-zinc-400",
          warn && "text-amber-200/75"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function IntelligenceCoachEntries({
  domains,
}: {
  domains: CoachWorkspaceState["domains"];
}) {
  return (
    <Section title="Investigate with Coach">
      <div className="grid gap-2 sm:grid-cols-2">
        {COACH_INVESTIGATIONS.map((item) => (
          <Link
            key={item.topic}
            href={topicCoachLink(item.topic, item.query)}
            className="group rounded-xl bg-white/[0.025] px-3.5 py-3 transition-colors hover:bg-white/[0.04]"
          >
            <p className="text-[13px] font-medium text-zinc-300 group-hover:text-zinc-100">
              {item.label}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-zinc-600">{item.why}</p>
            <span className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-zinc-600 group-hover:text-zinc-400">
              Open in Coach <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
        {domains.slice(0, 2).map((d) => (
          <Link
            key={d.id}
            href={domainCoachLink(d)}
            className="group rounded-xl bg-white/[0.02] px-3.5 py-3 hover:bg-white/[0.035]"
          >
            <p className="text-[13px] font-medium text-zinc-400 group-hover:text-zinc-200">
              {d.title}
            </p>
            <p className="mt-1 text-[12px] text-zinc-600 line-clamp-2">
              {d.liveInsight}
            </p>
            <span className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-zinc-700 group-hover:text-zinc-500">
              Investigate <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("intelligence-block", className)}>
      <h2 className="mb-2.5 text-[12px] font-medium text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

function memoryOneLine(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export const IntelligenceSynthesis = IntelligenceDecisionSupport;

export function IntelligenceTrajectoryStrip() {
  return null;
}

export function IntelligenceSignals(props: { signals: IntelligenceSignal[] }) {
  return <IntelligenceSignalBoard {...props} />;
}

export function IntelligenceRisksOpportunities({
  items,
  recommendation,
}: {
  items: RiskOpportunity[];
  recommendation?: string;
}) {
  return (
    <IntelligenceDecisionSupport
      risks={items.filter((i) => i.kind === "risk")}
      opportunities={items.filter((i) => i.kind === "opportunity")}
      recommendation={recommendation ?? ""}
    />
  );
}

export const IntelligenceMemory = IntelligenceMemoryTiles;
export const IntelligenceEcosystem = IntelligenceEcosystemCompact;
export const IntelligenceTrajectory = IntelligenceTrajectoryStrip;
export const IntelligenceDomains = IntelligenceCoachEntries;

export function IntelligenceCoachingState() {
  return null;
}
