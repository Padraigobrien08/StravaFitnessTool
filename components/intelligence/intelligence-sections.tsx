"use client";

import Link from "next/link";
import { useState } from "react";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { IntelligenceSignal } from "@/lib/intelligence/athleteState";
import type { StateEvolutionItem } from "@/lib/intelligence/presentation";
import { primaryActionBullets, prioritizeSignals } from "@/lib/intelligence/presentation";
import {
  formatTrajectoryDisplay,
  groupMemoryItems,
  signalImplication,
} from "@/lib/intelligence/intelligenceUiHelpers";
import type { AthleteBelief } from "@/lib/athlete-memory/types";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import type { RiskOpportunity } from "@/lib/coach/types";
import type { TrainingEcosystemView } from "@/lib/training/ecosystemViewModel";
import { domainCoachLink, signalCoachLink, topicCoachLink } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const COACH_INVESTIGATIONS: {
  topic: string;
  label: string;
  hypothesis: string;
  query: string;
}[] = [
  {
    topic: "readiness-change",
    label: "Why did readiness change?",
    hypothesis: "Freshness shifted with taper, volume, and load balance.",
    query: "Why did my readiness change this week?",
  },
  {
    topic: "cross-training-interference",
    label: "Is cross-training interfering?",
    hypothesis: "Strength and hard non-run work may compress recovery before key sessions.",
    query: "Is my gym work helping or hurting my running?",
  },
  {
    topic: "strongest-block",
    label: "Compare to strongest block",
    hypothesis: "Current load may mirror your best historical volume phase.",
    query: "Compare this training block to my strongest historical block.",
  },
  {
    topic: "pace-improvement",
    label: "What improves my pace historically?",
    hypothesis: "Aerobic efficiency is often the strongest adaptation signal.",
    query: "What training patterns historically improve my pace?",
  },
  {
    topic: "race-prep",
    label: "Race prep execution",
    hypothesis: "Taper specificity and freshness alignment matter most now.",
    query: "How should I execute race week given my current state?",
  },
];

export function IntelligenceStateEvolution({ items }: { items: StateEvolutionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="intelligence-evolution rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5">
      <p className="mb-2 text-[11px] font-medium text-zinc-500">How your state is moving</p>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {items.map((item) => {
          const display = formatTrajectoryDisplay(item);
          return (
            <div
              key={item.id}
              className="min-w-[132px] shrink-0 rounded-md bg-white/[0.03] px-2 py-1.5 sm:min-w-[140px]"
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] text-zinc-600">{item.label}</p>
                <TrendGlyph trend={item.trend} />
              </div>
              <p className="mt-0.5 text-[12px] font-medium leading-tight text-zinc-200">
                {display.headline}
              </p>
              {display.sub ? <p className="text-[10px] text-zinc-600">{display.sub}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrendGlyph({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-zinc-500" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-zinc-500" />;
  return <span className="text-[10px] text-zinc-600">→</span>;
}

function SignalStatusIcon({ severity }: { severity: IntelligenceSignal["severity"] }) {
  if (severity === "positive") return <span className="text-teal-400/80">↑</span>;
  if (severity === "warning") return <span className="text-amber-400/80">!</span>;
  if (severity === "opportunity") return <span className="text-teal-300/70">◇</span>;
  return <span className="text-zinc-500">~</span>;
}

function IntelligenceSignalFeed({ signals }: { signals: IntelligenceSignal[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (signals.length === 0) return null;

  return (
    <Section title="Signals shaping the current recommendation">
      <div className="overflow-x-auto rounded-lg border border-white/[0.04]">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/[0.04] text-[10px] text-zinc-600">
              <th className="w-8 px-2 py-1.5 font-medium" />
              <th className="px-2 py-1.5 font-medium">Signal</th>
              <th className="hidden px-2 py-1.5 font-medium sm:table-cell">Implication</th>
              <th className="w-20 px-2 py-1.5 font-medium">Confidence</th>
              <th className="w-16 px-2 py-1.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => {
              const open = expandedId === s.id;
              return (
                <tr
                  key={s.id}
                  className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-2 py-2 align-top text-center text-[12px]">
                    <SignalStatusIcon severity={s.severity} />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <p className="text-[12px] text-zinc-300">{s.headline}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-600 sm:hidden">
                      {signalImplication(s)}
                    </p>
                    {open ? (
                      <p className="mt-1 text-[10px] leading-snug text-zinc-600">
                        {s.evidence || s.text}
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden px-2 py-2 align-top text-[11px] text-zinc-500 sm:table-cell">
                    {signalImplication(s)}
                  </td>
                  <td className="px-2 py-2 align-top text-[10px] capitalize text-zinc-600">
                    {s.confidence}
                  </td>
                  <td className="px-2 py-2 align-top text-right">
                    {s.severity === "warning" ? (
                      <Link
                        href={signalCoachLink(s.text)}
                        className="text-[10px] text-amber-200/60 hover:text-amber-100"
                      >
                        Investigate
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="text-[10px] text-zinc-600 hover:text-zinc-400"
                        onClick={() => setExpandedId(open ? null : s.id)}
                      >
                        Why
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function IntelligenceSignalBoard({
  signals,
  compact = false,
}: {
  signals: IntelligenceSignal[];
  compact?: boolean;
}) {
  const { primary, secondary, watchlist } = prioritizeSignals(signals);
  if (!primary && secondary.length === 0 && watchlist.length === 0) return null;

  const all = [...(primary ? [primary] : []), ...secondary, ...watchlist].slice(
    0,
    compact ? 5 : undefined,
  );

  if (compact) {
    return <IntelligenceSignalFeed signals={all} />;
  }

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
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{primary.text}</p>
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

function CompactSignalCard({ signal, watch }: { signal: IntelligenceSignal; watch?: boolean }) {
  const Icon = watch ? AlertTriangle : Check;
  return (
    <div
      className={cn(
        "group rounded-lg px-3 py-2.5",
        watch ? "bg-amber-500/[0.05]" : "bg-white/[0.025]",
      )}
    >
      <div className="flex gap-2">
        <Icon
          className={cn("mt-0.5 h-3 w-3 shrink-0", watch ? "text-amber-400/70" : "text-zinc-500")}
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
        className,
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
    <Section title="Decision support" subtitle="What should I do with this intelligence?">
      <div className="grid gap-2.5 lg:grid-cols-3">
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
              <li key={line} className="flex gap-2 text-[13px] leading-snug text-zinc-100">
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
        tone === "risk" ? "bg-amber-500/[0.05]" : "bg-teal-500/[0.05]",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-medium",
          tone === "risk" ? "text-amber-200/55" : "text-teal-400/55",
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
                tone === "risk" ? "text-amber-100/80" : "text-teal-100/85",
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
  beliefsById,
}: {
  memory: MemorySnippet[];
  beliefsById?: Map<string, AthleteBelief>;
}) {
  return <IntelligenceMemoryGrouped memory={memory} beliefsById={beliefsById} />;
}

export function IntelligenceMemoryGrouped({
  memory,
  beliefsById,
}: {
  memory: MemorySnippet[];
  beliefsById?: Map<string, AthleteBelief>;
}) {
  const [showAll, setShowAll] = useState(false);
  if (memory.length === 0) return null;

  const grouped = groupMemoryItems(memory);
  const groups: {
    key: keyof typeof grouped;
    title: string;
    tone: string;
  }[] = [
    { key: "stable", title: "Stable patterns", tone: "text-zinc-500" },
    { key: "emerging", title: "Emerging patterns", tone: "text-teal-500/60" },
    { key: "watchlist", title: "Watchlist", tone: "text-amber-400/55" },
  ];

  const limit = showAll ? 99 : 2;

  return (
    <Section title="Athlete memory">
      <div className="grid gap-3 md:grid-cols-3">
        {groups.map(({ key, title, tone }) => {
          const items = grouped[key].slice(0, limit);
          if (items.length === 0) return null;
          return (
            <div key={key} className="min-w-0">
              <p className={cn("text-[10px] font-medium uppercase tracking-wide", tone)}>{title}</p>
              <ul className="mt-1.5 space-y-2">
                {items.map((m) => (
                  <MemoryBeliefRow
                    key={m.id}
                    belief={m}
                    evidence={beliefsById?.get(m.id)?.evidence[0] ?? memoryEvidenceFallback(m)}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {memory.length > 6 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          <ChevronDown className={cn("h-3 w-3", showAll && "rotate-180")} />
          {showAll ? "Show fewer beliefs" : "Show full memory list"}
        </button>
      ) : null}
    </Section>
  );
}

function MemoryBeliefRow({ belief, evidence }: { belief: MemorySnippet; evidence: string }) {
  return (
    <li className="group rounded-md bg-white/[0.02] px-2 py-2">
      <p className="text-[12px] leading-snug text-zinc-400">{belief.text}</p>
      <p className="mt-1 text-[10px] text-zinc-600">
        Confidence: <span className="capitalize text-zinc-500">{belief.confidence}</span>
      </p>
      {evidence ? (
        <p className="mt-0.5 text-[10px] leading-snug text-zinc-700">
          Evidence: {memoryOneLine(evidence, 90)}
        </p>
      ) : null}
      <Link
        href={signalCoachLink(`Explain this belief about me: ${belief.text}`)}
        className="mt-1 inline-block text-[10px] text-zinc-700 hover:text-zinc-400"
      >
        Ask Coach
      </Link>
    </li>
  );
}

function memoryEvidenceFallback(m: MemorySnippet): string {
  if (m.stability === "stable") {
    return "Repeated across recent blocks and session history.";
  }
  if (m.stability === "emerging") {
    return "Limited observations — still forming.";
  }
  return "Mixed or inconsistent recent evidence.";
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
        <span className="text-zinc-300">{ecosystem.archetypeLabel}</span> profile. Running drives
        race performance; non-run work shapes fatigue, durability, and recovery context.
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
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
                s.warn ? "text-amber-200/65" : "text-zinc-500",
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
            {flagsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
          "Is my cross-training helping or hurting my running?",
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
    <Section title="Training ecosystem · how non-run work affects fatigue and support">
      {body}
    </Section>
  );
}

function EcoMetric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md bg-white/[0.025] px-2 py-1.5 text-center">
      <p className="text-[9px] text-zinc-600">{label}</p>
      <p
        className={cn(
          "text-[11px] font-medium tabular-nums text-zinc-400",
          warn && "text-amber-200/75",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function IntelligenceCoachEntries({ domains }: { domains: CoachWorkspaceState["domains"] }) {
  const [showMore, setShowMore] = useState(false);
  const domainCards = domains.slice(0, 2).map((d) => ({
    key: d.id,
    label: d.title,
    hypothesis: d.liveInsight,
    href: domainCoachLink(d),
  }));
  const all = [
    ...COACH_INVESTIGATIONS.map((item) => ({
      key: item.topic,
      label: item.label,
      hypothesis: item.hypothesis,
      href: topicCoachLink(item.topic, item.query),
    })),
    ...domainCards,
  ];
  const visible = showMore ? all : all.slice(0, 4);
  const hidden = all.length - visible.length;

  return (
    <Section title="Investigate with Coach">
      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="group rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.035]"
          >
            <p className="text-[12px] font-medium text-zinc-300 group-hover:text-zinc-100">
              {item.label}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">{item.hypothesis}</p>
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] text-zinc-600 group-hover:text-zinc-400">
              Open in Coach <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
      {hidden > 0 || all.length > 4 ? (
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          <ChevronDown className={cn("h-3 w-3", showMore && "rotate-180")} />
          {showMore ? "Show fewer investigations" : "Show more investigations"}
        </button>
      ) : null}
    </Section>
  );
}

function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("intelligence-block", className)}>
      <div className="mb-2">
        <h2 className="text-[12px] font-medium text-zinc-500">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[10px] text-zinc-700">{subtitle}</p> : null}
      </div>
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
