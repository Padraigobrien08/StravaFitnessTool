"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type {
  GenerateWeeklyPlanResult,
  PlannedWorkout,
  WeeklyTrainingPlan,
} from "@/lib/ai-planning";
import { dash } from "@/components/home/primitives/tokens";
import { ZONE_COLOR } from "@/components/console/console-kit";
import type { CalendarIntensity } from "@/lib/training-calendar";
import { cn } from "@/lib/utils";

const ZONE_INTENSITIES: CalendarIntensity[] = ["easy", "recovery", "moderate", "hard", "rest"];

function intensityColor(intensity: string): string {
  return ZONE_INTENSITIES.includes(intensity as CalendarIntensity)
    ? ZONE_COLOR[intensity as CalendarIntensity]
    : "var(--muted-subtle)";
}

function WorkoutRow({ w }: { w: PlannedWorkout }) {
  return (
    <li className="rounded-lg bg-[var(--surface-subdued)] px-3 py-2.5 ring-1 ring-[var(--border-subtle)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-zinc-200">
          {w.day} · {w.title}
        </span>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide"
          style={{ color: intensityColor(w.intensity) }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: intensityColor(w.intensity) }}
          />
          {w.intensity}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-zinc-500">
        {w.modality}
        {w.distanceKm != null ? ` · ${w.distanceKm} km` : ""}
        {w.durationMin != null ? ` · ${w.durationMin} min` : ""}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">{w.purpose}</p>
      {w.constraintsApplied.length > 0 ? (
        <p className="mt-1 text-[10px] text-zinc-600">
          Constraints: {w.constraintsApplied.join("; ")}
        </p>
      ) : null}
    </li>
  );
}

export function AiWeeklyPlanPanel({
  plan,
  guardrails,
  source,
  validation,
  className,
}: {
  plan: WeeklyTrainingPlan;
  guardrails?: GenerateWeeklyPlanResult["guardrails"];
  source?: GenerateWeeklyPlanResult["source"];
  validation?: GenerateWeeklyPlanResult["validation"];
  className?: string;
}) {
  return (
    <PanelChrome title="AI weekly plan" className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={dash.labelAccent}>Next week plan</p>
          <p className="mt-1 font-display text-lg font-semibold text-zinc-100">
            {plan.planType.replace("_", " ")} · w/c {plan.weekStart}
          </p>
        </div>
        <ConfidenceBadge
          level={
            plan.confidence === "medium_high"
              ? "medium"
              : plan.confidence === "high"
                ? "high"
                : plan.confidence
          }
        />
      </div>

      <p className="text-[14px] leading-relaxed text-zinc-300">{plan.summary}</p>

      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
        {plan.totalRunDistanceKm != null ? <span>~{plan.totalRunDistanceKm} km runs</span> : null}
        <span>{plan.hardSessionCount} hard session(s)</span>
        {source ? <span>Source: {source}</span> : null}
      </div>

      <ul className="space-y-2">
        {plan.workouts.map((w, i) => (
          <WorkoutRow key={`${w.day}-${w.title}-${i}`} w={w} />
        ))}
      </ul>

      <section className="space-y-2 border-t border-white/[0.04] pt-4">
        <p className={dash.labelAccent}>Rationale</p>
        <p className="text-[13px] text-zinc-400">{plan.rationale.primaryGoal}</p>
        {plan.rationale.evidenceUsed.length > 0 ? (
          <div>
            <p className="text-[11px] text-zinc-600">Evidence used</p>
            <ul className="mt-1 space-y-1 text-[12px] text-zinc-500">
              {plan.rationale.evidenceUsed.map((e) => (
                <li key={e} className="flex gap-2">
                  <span className="text-zinc-700">·</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {plan.rationale.risksManaged.length > 0 ? (
          <div>
            <p className="text-[11px] text-zinc-600">Risks managed</p>
            <ul className="mt-1 space-y-1 text-[12px] text-zinc-500">
              {plan.rationale.risksManaged.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {plan.rationale.tradeoffs.length > 0 ? (
          <div>
            <p className="text-[11px] text-zinc-600">Tradeoffs</p>
            <ul className="mt-1 space-y-1 text-[12px] text-zinc-500">
              {plan.rationale.tradeoffs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {guardrails ? (
        <section className="space-y-1">
          <p className={dash.labelAccent}>Constraints applied</p>
          <ul className="space-y-1 text-[12px] text-zinc-500">
            {guardrails.constraintNotes.slice(0, 6).map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.alternatives && plan.alternatives.length > 0 ? (
        <section className="space-y-2">
          <p className={dash.labelAccent}>Alternatives</p>
          {plan.alternatives.map((alt) => (
            <div
              key={alt.name}
              className="rounded-lg bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-500"
            >
              <p className="font-medium text-zinc-400">{alt.name}</p>
              <p className="mt-0.5">{alt.summary}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section>
        <p className={dash.labelAccent}>Limitations</p>
        <ul className="mt-1 space-y-1 text-[12px] text-zinc-600">
          {plan.limitations.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      </section>

      {validation && !validation.valid ? (
        <p className="text-[11px] text-amber-500/80">
          Plan was adjusted after validation ({validation.issues.length} issue(s)).
        </p>
      ) : null}
    </PanelChrome>
  );
}
