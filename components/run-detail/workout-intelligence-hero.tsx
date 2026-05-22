"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import { ReadinessRing } from "@/components/home/primitives/readiness-ring";
import { WorkoutTypeBadge } from "@/components/workout/workout-type-badge";
import type { WorkoutHeroView } from "@/lib/runs/workoutDetailViewModels";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";

const gradeBorder = {
  strong: "border-l-teal-500/50",
  steady: "border-l-teal-500/35",
  mixed: "border-l-amber-500/45",
  limited: "border-l-zinc-500/35",
};

export function WorkoutIntelligenceHero({ hero }: { hero: WorkoutHeroView }) {
  return (
    <DashboardPanel
      variant="hero"
      padding="hero"
      elevated
      hover={false}
      className={cn(
        "border-l-[3px]",
        gradeBorder[hero.executionGrade],
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_70%_55%_at_100%_0%,rgba(45,212,191,0.06),transparent_55%)]"
      )}
    >
      <div className="relative grid gap-5 lg:grid-cols-[1fr_minmax(220px,280px)] lg:gap-8">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={dash.labelAccent}>Session intelligence</span>
            <WorkoutTypeBadge
              type={hero.workoutType}
              confidence={hero.confidence}
            />
            <ConfidenceBadge level={hero.confidence} />
          </div>

          <div>
            <h1 className={dash.h1}>{hero.sessionTitle}</h1>
            <p className="mt-1 text-xs text-zinc-500">{hero.dateDisplay}</p>
          </div>

          {hero.formattedTitle.isStructured ? (
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
              <p className={dash.label}>Workout structure</p>
              <ul className="mt-2 space-y-2">
                {hero.formattedTitle.segments.map((seg, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-24 shrink-0 text-xs font-medium text-zinc-500">
                      {seg.label}
                    </span>
                    <span className="text-zinc-200">{seg.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-300">{hero.formattedTitle.primary}</p>
          )}

          <p className={cn(dash.lead, "text-zinc-300/90")}>{hero.summary}</p>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400 ring-1 ring-inset ring-white/[0.06]">
              Execution ·{" "}
              <strong className="text-zinc-200">{hero.executionLabel}</strong>
            </span>
            <span className="rounded-md bg-teal-500/[0.08] px-2.5 py-1 text-xs text-teal-300/90 ring-1 ring-inset ring-teal-500/20">
              {hero.primaryAdaptation}
            </span>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            {hero.characteristics.map((c, i) => (
              <li key={i}>· {c}</li>
            ))}
          </ul>

          <p className="text-sm text-zinc-500">
            <span className="font-medium text-zinc-400">Coach note · </span>
            {hero.recommendation}
          </p>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.05] pt-3">
            {hero.inlineMetrics.map((m) => (
              <div key={m.label}>
                <dt className={dash.label}>{m.label}</dt>
                <dd className={dash.metricSm}>{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="space-y-4 rounded-xl bg-white/[0.03] p-4">
          <div className="flex items-center gap-4">
            <ReadinessRing score={hero.effortScore} size={80} showGlow />
            <div className="text-xs text-zinc-500">
              <p className="font-medium text-zinc-300">Effort</p>
              <p className="mt-0.5">Fatigue · {hero.fatigueImpact}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className={dash.label}>Efficiency</dt>
              <dd className="mt-0.5 font-semibold text-zinc-200">
                {hero.efficiencyScore != null
                  ? hero.efficiencyScore.toFixed(3)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className={dash.label}>Readiness</dt>
              <dd className="mt-0.5 text-zinc-400">{hero.readinessImpact}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </DashboardPanel>
  );
}
