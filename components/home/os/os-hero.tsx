"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { HomeHeroView } from "@/lib/home/operatingSystemView";
import { coachUrl } from "@/lib/coach/domainLinks";
import {
  TypographyEyebrow,
  TypographyMuted,
  TypographyPageTitle,
} from "@/components/ui/typography";
import { type } from "@/lib/typography";
import { cn } from "@/lib/utils";

export function OsHero({
  hero,
  onGeneratePlan,
  planLoading,
}: {
  hero: HomeHeroView;
  onGeneratePlan?: () => void;
  planLoading?: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-teal-500/15 bg-gradient-to-br from-[var(--surface-elevated)] via-[var(--surface-subdued)] to-[var(--background)] px-4 py-4 sm:px-5 sm:py-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_100%_0%,rgba(45,212,191,0.07),transparent)]" />
      <div className="relative grid gap-4 lg:grid-cols-[1fr_200px] lg:items-start">
        <div className="min-w-0 space-y-2.5">
          <TypographyEyebrow>{hero.focusTitle}</TypographyEyebrow>
          <TypographyPageTitle className="text-lg sm:text-xl">
            {hero.primaryAction}
          </TypographyPageTitle>
          <div>
            <p className={cn(type.sectionLabel, "normal-case tracking-normal text-zinc-500")}>
              Current belief
            </p>
            <TypographyMuted className="mt-1">{hero.currentBelief}</TypographyMuted>
          </div>
          {hero.whyBullets.length > 0 ? (
            <div>
              <p className={cn(type.sectionLabel, "normal-case tracking-normal text-zinc-600")}>
                Why
              </p>
              <ul className="mt-1.5 space-y-1">
                {hero.whyBullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-1.5 text-[0.875rem] leading-snug text-muted-foreground"
                  >
                    <span className="text-zinc-700">–</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {hero.planState ? (
            <p className="text-[11px] text-zinc-600">
              <span className="text-zinc-500">Saved plan: </span>
              {hero.planState}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-0.5">
            {hero.hasSavedPlan ? (
              <Link href="/plan">
                <Button size="sm" className="h-8 gap-1 text-xs">
                  Open plan
                </Button>
              </Link>
            ) : onGeneratePlan ? (
              <Button
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={planLoading}
                onClick={onGeneratePlan}
              >
                <Sparkles className="h-3 w-3" />
                {planLoading ? "Generating…" : "Generate next week"}
              </Button>
            ) : (
              <Link href="/plan">
                <Button size="sm" className="h-8 gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  Generate next week
                </Button>
              </Link>
            )}
            <Link href={coachUrl({ q: "Refine my training focus this week" })}>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                Refine in Coach
              </Button>
            </Link>
            {hero.hasSavedPlan ? (
              <Link href="/plan">
                <Button size="sm" variant="ghost" className="h-8 text-xs text-zinc-500">
                  Regenerate
                </Button>
              </Link>
            ) : null}
            <Link href={coachUrl()}>
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-zinc-500">
                Ask why
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
        <aside className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          {hero.raceName ? <StateChip label="Race" value={hero.raceName} accent /> : null}
          {hero.daysUntilRace != null ? (
            <StateChip
              label="Countdown"
              value={`${hero.daysUntilRace} day${hero.daysUntilRace === 1 ? "" : "s"}`}
            />
          ) : null}
          <StateChip label="Readiness" value={String(hero.readinessScore)} />
          <StateChip label="Freshness" value={String(hero.freshness)} />
          <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-2 lg:col-span-1">
            <ConfidenceBadge level={hero.confidence} />
            {hero.taperActive ? (
              <span className="text-[10px] text-teal-500/80">Taper active</span>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function StateChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg px-2.5 py-2",
        accent
          ? "bg-teal-500/10 ring-1 ring-teal-500/20"
          : "bg-[var(--surface)] ring-1 ring-[var(--border-subtle)]",
      )}
    >
      <p className="text-[9px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-0.5 font-display text-sm font-semibold tabular-nums text-zinc-200">
        {value}
      </p>
    </div>
  );
}
