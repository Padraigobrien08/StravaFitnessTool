"use client";

import Link from "next/link";
import { ArrowRight, AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { CommandCenterViewModel } from "@/lib/home/commandCenter";
import { coachUrl } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";

export function CommandCenter({
  vm,
  onGeneratePlan,
  planLoading,
}: {
  vm: CommandCenterViewModel;
  onGeneratePlan?: () => void;
  planLoading?: boolean;
}) {
  const primaryPlanHref = "/plan";
  const primaryPlanLabel = vm.hasSavedPlan ? "Open saved plan" : "Generate next week plan";
  return (
    <div className="command-center space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-br from-[#0f1418] via-[#0c0e12] to-[#09090b] px-5 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(45,212,191,0.08),transparent)]" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-accent/80">
              What should I do next?
            </p>
            <h1 className="font-display text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
              {vm.nextAction}
            </h1>
            <p className="max-w-2xl text-[14px] leading-relaxed text-zinc-400">
              <span className="text-zinc-500">Current belief: </span>
              {vm.currentBelief}
            </p>
            {vm.hasSavedPlan && vm.savedPlanSummary ? (
              <p className="text-[12px] text-zinc-600 line-clamp-2">
                Saved plan: {vm.savedPlanSummary}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {vm.hasSavedPlan ? (
                <Link href={primaryPlanHref}>
                  <Button size="sm" className="h-9 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {primaryPlanLabel}
                  </Button>
                </Link>
              ) : onGeneratePlan ? (
                <Button
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={planLoading}
                  onClick={onGeneratePlan}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {planLoading ? "Generating…" : primaryPlanLabel}
                </Button>
              ) : (
                <Link href={primaryPlanHref}>
                  <Button size="sm" className="h-9 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {primaryPlanLabel}
                  </Button>
                </Link>
              )}
              <Link
                href={coachUrl({
                  q: vm.hasSavedPlan ? "Refine my saved next week plan" : "Help me plan next week",
                })}
              >
                <Button size="sm" variant="outline" className="h-9 text-zinc-400">
                  Refine in Coach
                </Button>
              </Link>
              {!vm.hasSavedPlan ? (
                <Link href={primaryPlanHref}>
                  <Button size="sm" variant="ghost" className="h-9 text-zinc-500">
                    Open planner
                  </Button>
                </Link>
              ) : null}
              <Link href={coachUrl()}>
                <Button size="sm" variant="ghost" className="h-9 text-zinc-500">
                  Ask Coach why
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
          <aside className="flex flex-col gap-2 lg:min-w-[200px]">
            <MetaChip label="Focus" value={vm.focusLabel} />
            {vm.raceContext ? <MetaChip label="Race" value={vm.raceContext} accent /> : null}
            <div className="flex items-center gap-2">
              <ConfidenceBadge level={vm.confidence} />
              <span className="text-[11px] text-zinc-600">{vm.planHint}</span>
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {vm.primaryRisk ? (
          <RiskOpportunityCard
            kind="risk"
            label={vm.primaryRisk.label}
            summary={vm.primaryRisk.summary}
            href={coachUrl({
              q: `Explain this risk: ${vm.primaryRisk.label}`,
            })}
          />
        ) : null}
        {vm.primaryOpportunity ? (
          <RiskOpportunityCard
            kind="opportunity"
            label={vm.primaryOpportunity.label}
            summary={vm.primaryOpportunity.summary}
            href={coachUrl({
              q: `How do I use this opportunity: ${vm.primaryOpportunity.label}?`,
            })}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.04] pt-3 text-[12px] text-zinc-600">
        <span>
          Deeper model →{" "}
          <Link href="/intelligence" className="text-zinc-500 hover:text-zinc-300">
            Intelligence
          </Link>
          {" · "}
          Evidence →{" "}
          <Link href="/training" className="text-zinc-500 hover:text-zinc-300">
            Training details
          </Link>
        </span>
      </div>
    </div>
  );
}

function MetaChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2",
        accent ? "bg-accent/10 ring-1 ring-accent/20" : "bg-white/[0.03]",
      )}
    >
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-zinc-300">{value}</p>
    </div>
  );
}

function RiskOpportunityCard({
  kind,
  label,
  summary,
  href,
}: {
  kind: "risk" | "opportunity";
  label: string;
  summary: string;
  href: string;
}) {
  const Icon = kind === "risk" ? AlertTriangle : TrendingUp;
  return (
    <Link
      href={href}
      className="group rounded-lg bg-white/[0.02] px-4 py-3 ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.04]"
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0",
            kind === "risk" ? "text-amber-500/80" : "text-accent/80",
          )}
        />
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-zinc-500">
            {kind === "risk" ? "Primary risk" : "Primary opportunity"}
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-zinc-200">{label}</p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-zinc-500">{summary}</p>
        </div>
        <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}
