"use client";

import Link from "next/link";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { IntelligenceSignal, TrajectorySeries } from "@/lib/intelligence/athleteState";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import type { RiskOpportunity } from "@/lib/coach/types";
import type { TrainingEcosystemView } from "@/lib/training/ecosystemViewModel";
import { domainCoachLink, signalCoachLink } from "@/lib/coach/domainLinks";
import { TrainingEcosystemPanel } from "@/components/training/training-ecosystem-panel";
import { ChartContainer } from "@/components/charts/chart-container";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Area, AreaChart } from "recharts";

const toneIcon = {
  positive: Check,
  neutral: TrendingUp,
  warning: AlertTriangle,
  opportunity: Sparkles,
};

export function IntelligenceCoachingState({
  state,
  bullets,
}: {
  state: CoachWorkspaceState;
  bullets: string[];
}) {
  return (
    <Section title="Current coaching state">
      <p className="font-display text-lg font-semibold text-zinc-100">
        {state.currentFocus}
      </p>
      {bullets.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {bullets.map((b) => (
            <li
              key={b}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-xs text-zinc-400"
            >
              {b}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

export function IntelligenceSignals({ signals }: { signals: IntelligenceSignal[] }) {
  if (signals.length === 0) return null;
  return (
    <Section title="Active signals">
      <ul className="space-y-2">
        {signals.map((s) => {
          const Icon = toneIcon[s.severity];
          return (
            <li
              key={s.id}
              className="group rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 transition-colors hover:border-white/[0.08]"
            >
              <div className="flex gap-2">
                <Icon
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    s.severity === "positive"
                      ? "text-teal-400/80"
                      : s.severity === "warning"
                        ? "text-amber-400/80"
                        : "text-zinc-500"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                      {s.type}
                    </span>
                    <span className="text-[10px] capitalize text-zinc-700">
                      {s.confidence} confidence
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-300">{s.text}</p>
                  <Link
                    href={signalCoachLink(`Explain: ${s.text}`)}
                    className="mt-1.5 inline-block text-[11px] text-teal-400/70 opacity-0 transition-opacity group-hover:opacity-100 hover:underline"
                  >
                    Investigate →
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function IntelligenceRisksOpportunities({
  items,
}: {
  items: RiskOpportunity[];
}) {
  const risks = items.filter((i) => i.kind === "risk");
  const opps = items.filter((i) => i.kind === "opportunity");
  if (items.length === 0) return null;

  return (
    <Section title="Risks & opportunities">
      <div className="grid gap-4 sm:grid-cols-2">
        <Column title="Risks" items={risks} tone="risk" />
        <Column title="Opportunities" items={opps} tone="opp" />
      </div>
    </Section>
  );
}

function Column({
  title,
  items,
  tone,
}: {
  title: string;
  items: RiskOpportunity[];
  tone: "risk" | "opp";
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-2 text-[10px] uppercase tracking-wider",
          tone === "risk" ? "text-amber-500/70" : "text-teal-500/70"
        )}
      >
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.length === 0 ? (
          <li className="text-xs text-zinc-700">None flagged</li>
        ) : (
          items.map((r) => (
            <li
              key={r.id}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs leading-snug",
                tone === "risk"
                  ? "border-amber-500/15 bg-amber-500/[0.04] text-amber-100/80"
                  : "border-teal-500/15 bg-teal-500/[0.04] text-teal-100/85"
              )}
            >
              {r.text}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function IntelligenceMemory({ memory }: { memory: MemorySnippet[] }) {
  const [open, setOpen] = useState(false);
  if (memory.length === 0) return null;
  const shown = open ? memory : memory.slice(0, 4);

  return (
    <Section title="Longitudinal memory">
      <ul className="space-y-2">
        {shown.map((m) => (
          <li key={m.id} className="text-sm">
            <span className="text-zinc-500">{m.label}: </span>
            <span className="text-zinc-400">{compactLine(m.text)}</span>
          </li>
        ))}
      </ul>
      {memory.length > 4 ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400"
        >
          {open ? (
            <>
              Show less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show {memory.length - 4} more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      ) : null}
    </Section>
  );
}

export function IntelligenceEcosystem({
  ecosystem,
}: {
  ecosystem: TrainingEcosystemView;
}) {
  return (
    <Section title="Training ecosystem">
      <TrainingEcosystemPanel data={ecosystem} />
    </Section>
  );
}

export function IntelligenceTrajectory({
  series,
}: {
  series: TrajectorySeries[];
}) {
  if (series.every((s) => s.values.length < 2)) return null;

  return (
    <Section title="Current trajectory">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {series.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">
              {s.label}
            </p>
            <ChartContainer height={56} className="mt-2 w-full">
              {({ width, height }) => (
                <AreaChart width={width} height={height} data={s.values}>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="rgb(45,212,191)"
                    strokeWidth={1.5}
                    fill="rgba(16,185,129,0.12)"
                    dot={false}
                  />
                </AreaChart>
              )}
            </ChartContainer>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function IntelligenceDomains({
  domains,
}: {
  domains: CoachWorkspaceState["domains"];
}) {
  return (
    <Section title="Coaching domains">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {domains.slice(0, 7).map((d) => (
          <Link
            key={d.id}
            href={domainCoachLink(d)}
            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-colors hover:border-teal-500/20 hover:bg-teal-500/[0.04]"
          >
            <p className="text-sm font-semibold text-zinc-200 group-hover:text-white">
              {d.title}
            </p>
            <p className="mt-1 text-[11px] text-zinc-600 line-clamp-2">
              {d.liveInsight}
            </p>
            <p className="mt-2 text-[11px] text-teal-400/70 group-hover:text-teal-300/90">
              {d.suggestedQuery}
            </p>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.05] bg-[#0a0b0d]/80 p-4 sm:p-5">
      <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function compactLine(text: string, max = 100): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
