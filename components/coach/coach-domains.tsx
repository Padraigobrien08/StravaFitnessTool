"use client";

import type { CoachingDomain } from "@/lib/coach/types";
import { cn } from "@/lib/utils";
import { Activity, Bike, Brain, Gauge, History, Target, TrendingUp, Zap } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  readiness: Gauge,
  performance: TrendingUp,
  fatigue: Zap,
  race: Target,
  ecosystem: Bike,
  patterns: History,
  pacing: Activity,
  recovery: Brain,
  adaptation: TrendingUp,
};

const badgeTone = {
  up: "text-accent/90 bg-accent/10 border-accent/20",
  down: "text-amber-300/90 bg-amber-500/10 border-amber-500/20",
  flat: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
  alert: "text-amber-200/90 bg-amber-500/12 border-amber-500/25",
};

export function CoachDomains({
  domains,
  onExplore,
  disabled,
  collapsed,
}: {
  domains: CoachingDomain[];
  onExplore: (query: string) => void;
  disabled?: boolean;
  collapsed?: boolean;
}) {
  const featured = domains[0];
  const rest = domains.slice(1, collapsed ? 4 : 8);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Coaching domains
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">
            Live context — tap to open a reasoning thread
          </p>
        </div>
      </div>

      {featured ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onExplore(featured.suggestedQuery)}
          className="coach-domain-feature group w-full rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.09] to-transparent p-4 text-left transition-all hover:border-accent/35 disabled:opacity-40 sm:p-5"
        >
          <DomainCardInner domain={featured} featured />
        </button>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((d) => {
          const Icon = ICONS[d.id] ?? Brain;
          return (
            <button
              key={d.id}
              type="button"
              disabled={disabled}
              onClick={() => onExplore(d.suggestedQuery)}
              className="coach-domain-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.04] disabled:opacity-40"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-accent/60" />
                <span className="text-sm font-semibold text-zinc-200">{d.title}</span>
                {d.trendBadge ? (
                  <span
                    className={cn(
                      "ml-auto rounded border px-1.5 py-0.5 text-[9px] font-medium",
                      badgeTone[d.trendBadge.tone],
                    )}
                  >
                    {d.trendBadge.label}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-zinc-600">{d.subtitle}</p>
              <p className="mt-2 text-xs leading-snug text-zinc-400 line-clamp-2">
                {d.liveInsight}
              </p>
              {d.memoryRef ? (
                <p className="mt-2 border-t border-white/[0.04] pt-2 text-[10px] italic text-zinc-600 line-clamp-2">
                  {d.memoryRef}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DomainCardInner({ domain, featured }: { domain: CoachingDomain; featured?: boolean }) {
  const Icon = ICONS[domain.id] ?? Brain;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Icon className={cn("h-4 w-4", featured ? "text-accent/90" : "text-accent/60")} />
        <span className="font-display text-lg font-semibold text-white">{domain.title}</span>
        {domain.trendBadge ? (
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-[10px] font-medium",
              badgeTone[domain.trendBadge.tone],
            )}
          >
            {domain.trendBadge.label}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-zinc-500">{domain.subtitle}</p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">{domain.liveInsight}</p>
      {domain.memoryRef ? (
        <p className="mt-3 text-xs text-zinc-500 border-l-2 border-accent/30 pl-3">
          {domain.memoryRef}
        </p>
      ) : null}
      <p className="mt-4 text-[11px] text-accent/70 group-hover:text-accent/90">
        Explore → {domain.suggestedQuery}
      </p>
    </>
  );
}
