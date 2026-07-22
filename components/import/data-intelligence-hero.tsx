"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import { Sparkline } from "@/components/home/primitives/sparkline";
import type { ImportHeroView } from "@/lib/import/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

function DataQualityRing({ score }: { score: number }) {
  const color = score >= 72 ? "#2dd4bf" : score >= 45 ? "#fbbf24" : "#f87171";
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative mx-auto flex h-[108px] w-[108px] items-center justify-center">
      <svg width={108} height={108} className="-rotate-90">
        <circle cx={54} cy={54} r={r} fill="none" stroke="var(--chart-grid)" strokeWidth={8} />
        <circle
          cx={54}
          cy={54}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-bold tabular-nums text-white">{score}</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
          quality
        </span>
      </div>
    </div>
  );
}

export function DataIntelligenceHero({ hero }: { hero: ImportHeroView }) {
  const borderTone = hero.hasData
    ? hero.overallConfidence === "high"
      ? "border-l-teal-500/50"
      : "border-l-amber-500/40"
    : "border-l-zinc-500/35";

  const streamBars = Array.from({ length: 8 }, (_, i) => {
    const threshold = ((i + 1) / 8) * 100;
    return hero.streamCoveragePct >= threshold;
  });

  return (
    <DashboardPanel
      variant="hero"
      padding="hero"
      elevated
      hover={false}
      className={cn(
        "border-l-[3px]",
        borderTone,
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,rgba(45,212,191,0.07),transparent_55%)]",
      )}
    >
      <div className="relative grid gap-6 lg:grid-cols-[1fr_minmax(220px,280px)] lg:gap-8">
        <div className="min-w-0 space-y-3">
          <span className={dash.labelAccent}>Data connection & integrity</span>
          <div>
            <h1 className={dash.h1}>{hero.title}</h1>
            {hero.hasData ? (
              <p className="mt-1 text-sm text-zinc-400">{hero.subtitle}</p>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">{hero.subtitle}</p>
            )}
          </div>

          <p className={cn(dash.lead, "text-zinc-300/90")}>{hero.ingestionSummary}</p>

          <div className="space-y-1.5 text-sm text-zinc-400">
            <p>
              <span className="font-medium text-zinc-300">Ingestion · </span>
              {hero.qualityNarrative}
            </p>
            <p>{hero.fitNarrative}</p>
          </div>

          <p className="text-sm text-teal-300/85">{hero.recommendation}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className={dash.label}>Capabilities unlocked</p>
              <ul className="mt-2 space-y-1">
                {hero.unlockedCapabilities.length > 0 ? (
                  hero.unlockedCapabilities.slice(0, 5).map((c) => (
                    <li key={c} className="flex items-center gap-2 text-xs text-zinc-400">
                      <Check className="h-3 w-3 shrink-0 text-teal-500/80" />
                      {c}
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-600">Connect data to unlock</li>
                )}
              </ul>
            </div>
            <div>
              <p className={dash.label}>Still limited</p>
              <ul className="mt-2 space-y-1">
                {hero.missingCapabilities.slice(0, 4).map((c) => (
                  <li key={c} className="flex items-center gap-2 text-xs text-zinc-600">
                    <Minus className="h-3 w-3 shrink-0 text-zinc-600" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <aside className="space-y-4 rounded-xl bg-white/[0.03] p-4">
          <DataQualityRing score={hero.confidenceScore} />
          <div className="flex items-center justify-center gap-2">
            <ConfidenceBadge level={hero.overallConfidence} />
          </div>
          <p className="text-center text-xs text-zinc-500">{hero.confidenceLabel}</p>

          <div>
            <p className={cn(dash.label, "mb-2 text-center")}>FIT stream coverage</p>
            <div className="flex justify-center gap-1">
              {streamBars.map((on, i) => (
                <div
                  key={i}
                  className={cn("h-6 w-2 rounded-sm", on ? "bg-teal-500/55" : "bg-white/[0.06]")}
                />
              ))}
            </div>
            <p className="mt-1.5 text-center text-[11px] tabular-nums text-zinc-600">
              {hero.streamCoveragePct}% parsed
            </p>
          </div>

          <div>
            <p className={cn(dash.label, "mb-1")}>Ingestion rhythm</p>
            <Sparkline
              data={
                hero.hasData
                  ? [40, 45, 42, 55, 58, hero.streamCoveragePct || 20, 62, 65]
                  : [10, 12, 15, 14, 18]
              }
              fullWidth
              height={28}
              positive={hero.hasData}
            />
          </div>
        </aside>
      </div>
    </DashboardPanel>
  );
}
