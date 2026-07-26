"use client";

import type { GenerateWeeklyPlanResult, PlanToolObservability } from "@/lib/ai-planning";
import { cn } from "@/lib/utils";

const intensityDot: Record<string, string> = {
  easy: "bg-accent/80",
  moderate: "bg-amber-400/80",
  hard: "bg-orange-400/80",
  recovery: "bg-zinc-500",
  rest: "bg-zinc-600",
};

export function WeeklyPlanResponse({
  result,
  devMode,
  className,
}: {
  result: GenerateWeeklyPlanResult & {
    observability?: Partial<PlanToolObservability>;
    explanationOnly?: string;
  };
  devMode?: boolean;
  className?: string;
}) {
  const { plan, guardrails, source, validation, integrity } = result;

  return (
    <article
      className={cn(
        "weekly-plan-response rounded-xl border border-white/[0.06] bg-[#0c0d10]/80",
        className,
      )}
    >
      <header className="border-b border-white/[0.04] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-accent">
            Weekly plan
          </span>
          <span className="text-[10px] text-zinc-600">·</span>
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
            {plan.planType.replace("_", " ")}
          </span>
          <span className="text-[10px] text-zinc-600">·</span>
          <span className="text-[10px] text-zinc-500">w/c {plan.weekStart}</span>
          <span className="ml-auto flex items-center gap-2 text-[10px] text-zinc-600">
            <span>{plan.confidence.replace("_", " ")} confidence</span>
            {integrity && integrity.severity !== "none" && !devMode ? (
              <span className="text-zinc-700" title="Integrity-checked">
                · checked
              </span>
            ) : null}
          </span>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-200">{plan.summary}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-500">
          {plan.totalRunDistanceKm != null ? <span>{plan.totalRunDistanceKm} km runs</span> : null}
          <span>{plan.hardSessionCount} hard</span>
          <span>via {source}</span>
        </div>
      </header>

      {result.explanationOnly ? (
        <div className="border-b border-white/[0.04] px-4 py-3">
          <p className="text-[13px] leading-relaxed text-zinc-400 whitespace-pre-wrap">
            {result.explanationOnly}
          </p>
        </div>
      ) : null}

      <div className="px-4 py-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Schedule
        </p>
        <ul className="space-y-1.5">
          {plan.workouts.map((w, i) => (
            <li
              key={`${w.day}-${i}`}
              className="flex gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.02]"
            >
              <span className="w-8 shrink-0 text-[12px] font-medium text-zinc-500">
                {w.day.slice(0, 3)}
              </span>
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  intensityDot[w.intensity] ?? "bg-zinc-600",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-zinc-200">{w.title}</p>
                <p className="text-[11px] text-zinc-600">
                  {w.modality}
                  {w.distanceKm != null ? ` · ${w.distanceKm} km` : ""}
                  {w.durationMin != null ? ` · ${w.durationMin} min` : ""}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{w.purpose}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 border-t border-white/[0.04] px-4 py-3 sm:grid-cols-2">
        <ObservabilityBlock title="Evidence used" items={plan.rationale.evidenceUsed} />
        <ObservabilityBlock title="Constraints applied" items={guardrails?.constraintNotes ?? []} />
        <ObservabilityBlock title="Risks managed" items={plan.rationale.risksManaged} />
        <ObservabilityBlock title="Limitations" items={plan.limitations} />
      </div>

      {plan.alternatives && plan.alternatives.length > 0 ? (
        <div className="border-t border-white/[0.04] px-4 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Alternatives
          </p>
          {plan.alternatives.map((alt) => (
            <div key={alt.name} className="mb-2 text-[12px] text-zinc-500">
              <span className="text-zinc-400">{alt.name}:</span> {alt.summary}
            </div>
          ))}
        </div>
      ) : null}

      {!validation.valid || (integrity && !integrity.passed && source !== "fallback") ? (
        <p className="border-t border-white/[0.04] px-4 py-2 text-[11px] text-amber-500/80">
          Plan adjusted to match your current load and data
          {source === "fallback" ? " (conservative template)" : ""}.
        </p>
      ) : null}

      {devMode === true && (result.observability || integrity) ? (
        <div className="border-t border-white/[0.04] px-4 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Integrity (dev)
          </p>
          <pre className="max-h-48 overflow-auto text-[10px] text-zinc-600">
            {JSON.stringify(
              {
                contextHash: result.observability?.contextHash,
                repairsApplied: result.observability?.repairsApplied,
                validation: validation.issues,
                integrity: integrity ?? result.observability?.dev?.integrityReport,
              },
              null,
              2,
            )}
          </pre>
        </div>
      ) : null}
    </article>
  );
}

function ObservabilityBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">{title}</p>
      <ul className="space-y-0.5 text-[11px] leading-snug text-zinc-500">
        {items.slice(0, 5).map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}
