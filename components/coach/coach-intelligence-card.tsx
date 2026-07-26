"use client";

import { useEffect, useState } from "react";
import type { ParsedCoachResponse } from "@/lib/coach/parseResponse";
import { labelForTool } from "@/lib/coach/toolLabels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Gauge,
  GitCompare,
  Lightbulb,
  AlertTriangle,
  LineChart,
  Sparkles,
} from "lucide-react";

function confidenceTone(c: string | null): string {
  if (!c) return "text-zinc-500";
  const l = c.toLowerCase();
  if (l.includes("high")) return "text-accent/95";
  if (l.includes("medium")) return "text-amber-200/90";
  return "text-zinc-400";
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("coach-card-section", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-accent/70" /> : null}
        <span className={dash.label}>{title}</span>
        {open ? (
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-zinc-600" />
        ) : (
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-zinc-600" />
        )}
      </button>
      {open ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-zinc-300/95">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/50" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Prefer CoachInvestigationNotebook in the reasoning panel */
export function CoachIntelligenceCard({
  parsed,
  toolsUsed,
  onFollowUp,
  animate,
  progressive,
}: {
  parsed: ParsedCoachResponse;
  toolsUsed?: string[];
  onFollowUp: (text: string) => void;
  animate?: boolean;
  /** Stagger section reveal after response arrives */
  progressive?: boolean;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [revealStep, setRevealStep] = useState(progressive ? 0 : 99);

  useEffect(() => {
    if (!progressive) return;
    setRevealStep(0);
    const steps = 6;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRevealStep(i);
      if (i >= steps) clearInterval(id);
    }, 180);
    return () => clearInterval(id);
  }, [progressive, parsed.raw]);

  const showSection = (index: number) => !progressive || revealStep >= index;

  return (
    <article
      className={cn(
        "coach-intel-card rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#0e1015] to-[#0a0b0e] p-4",
        animate && "coach-card-enter",
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
            <Brain className="h-3.5 w-3.5 text-accent/90" />
          </div>
          <span className="font-display text-sm font-semibold text-white">Analysis</span>
        </div>
        {toolsUsed && toolsUsed.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {toolsUsed.map((t) => (
              <span
                key={t}
                className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-zinc-500"
              >
                {labelForTool(t)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {parsed.summary ? (
        <p className="font-display text-base font-semibold leading-snug text-zinc-100 sm:text-lg">
          {parsed.summary}
        </p>
      ) : null}

      <div className="mt-4 space-y-4 border-t border-white/[0.05] pt-4">
        {showSection(1) && parsed.why.length > 0 ? (
          <Section title="Why" icon={Lightbulb}>
            <BulletList items={parsed.why} />
          </Section>
        ) : null}

        {showSection(2) && parsed.recommendation ? (
          <Section title="Recommendation" icon={Sparkles} defaultOpen>
            <p className="text-[13px] leading-relaxed text-accent/85">{parsed.recommendation}</p>
          </Section>
        ) : null}

        {showSection(3) && parsed.confidence ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
            <Gauge className="h-3.5 w-3.5 text-zinc-500" />
            <span className={dash.label}>Confidence</span>
            <span className={cn("text-sm font-medium", confidenceTone(parsed.confidence))}>
              {parsed.confidence}
            </span>
          </div>
        ) : null}

        {showSection(4) && parsed.risks.length > 0 ? (
          <Section title="Risks" icon={AlertTriangle} defaultOpen>
            <BulletList items={parsed.risks} />
          </Section>
        ) : null}

        {showSection(4) && parsed.historicalComparison.length > 0 ? (
          <Section title="Historical comparison" icon={GitCompare} defaultOpen={false}>
            <BulletList items={parsed.historicalComparison} />
          </Section>
        ) : null}

        {showSection(5) && parsed.adaptation.length > 0 ? (
          <Section title="Adaptation" icon={LineChart} defaultOpen={false}>
            <BulletList items={parsed.adaptation} />
          </Section>
        ) : null}

        {showSection(5) && parsed.memoryNotes.length > 0 ? (
          <Section title="Training memory" defaultOpen={false}>
            <BulletList items={parsed.memoryNotes} />
          </Section>
        ) : null}

        {showSection(5) && parsed.evidence.length > 0 ? (
          <Section title="Evidence" defaultOpen={false}>
            <BulletList items={parsed.evidence} />
          </Section>
        ) : null}

        {showSection(5) && parsed.limitations.length > 0 ? (
          <Section title="Limitations" defaultOpen={false}>
            <BulletList items={parsed.limitations} />
          </Section>
        ) : null}
      </div>

      {showSection(6) && parsed.followUps.length > 0 ? (
        <div className="mt-4 border-t border-white/[0.05] pt-4">
          <p className={cn(dash.label, "mb-2")}>Continue exploring</p>
          <div className="flex flex-wrap gap-2">
            {parsed.followUps.slice(0, 4).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onFollowUp(q)}
                className="rounded-lg border border-accent/15 bg-accent/[0.06] px-2.5 py-1.5 text-left text-xs text-accent/80 transition-colors hover:border-accent/30 hover:bg-accent/10"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!parsed.isStructured ? (
        <div className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-400">
          {parsed.raw}
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 text-[10px] text-zinc-600 hover:text-zinc-400"
          onClick={() => setShowRaw((s) => !s)}
        >
          {showRaw ? "Hide" : "View"} full response
        </button>
      )}
      {showRaw && parsed.isStructured ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] text-zinc-500">
          {parsed.raw}
        </pre>
      ) : null}
    </article>
  );
}
