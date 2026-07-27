"use client";

import { useState } from "react";
import type { GenerateWeeklyPlanResult } from "@/lib/ai-planning";
import type { TrainingCalendarWeek } from "@/lib/training-calendar";
import { cn } from "@/lib/utils";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{title}</p>
      <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-zinc-500">
        {items.slice(0, 6).map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function PlanSidebar({
  week,
  preview,
  showDevIntegrity,
}: {
  week: TrainingCalendarWeek | null;
  preview: GenerateWeeklyPlanResult | null;
  showDevIntegrity?: boolean;
}) {
  const [devOpen, setDevOpen] = useState(false);
  const data = week ?? (preview ? previewToSidebar(preview) : null);
  if (!data) {
    return (
      <aside className="rounded-xl bg-[var(--surface-elevated)] p-4 shadow-[var(--surface-shadow)] ring-1 ring-[var(--border-subtle)]">
        <p className="text-[12px] text-zinc-600">
          Generate or save a plan to see reasoning, constraints, and integrity status.
        </p>
      </aside>
    );
  }

  const integrity = preview?.integrity;
  const passed = week?.integrityPassed ?? integrity?.passed ?? preview?.validation.valid;
  const severity = week?.integritySeverity ?? integrity?.severity ?? "none";

  return (
    <aside className="plan-sidebar space-y-3 rounded-xl bg-[var(--surface-elevated)] p-4 shadow-[var(--surface-shadow)] ring-1 ring-[var(--border-subtle)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Plan reasoning
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">{data.summary}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600">
        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 capitalize">
          {data.confidence.replace("_", " ")} confidence
        </span>
        {data.totalRunDistanceKm != null ? (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5">
            {data.totalRunDistanceKm} km runs
          </span>
        ) : null}
        {data.hardSessionCount != null ? (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5">
            {data.hardSessionCount} hard
          </span>
        ) : null}
      </div>

      <ListBlock title="Evidence used" items={data.evidenceUsed} />
      <ListBlock title="Constraints applied" items={data.constraintsApplied} />
      <ListBlock title="Risks managed" items={data.risksManaged} />
      <ListBlock title="Limitations" items={data.limitations} />

      <div
        className={cn(
          "flex items-start gap-2 rounded-lg px-2.5 py-2",
          passed
            ? "bg-[color-mix(in_srgb,var(--home-good)_8%,transparent)]"
            : "bg-amber-500/[0.06]",
        )}
      >
        {passed ? (
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--home-good)]" />
        ) : (
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/80" />
        )}
        <div>
          <p className="text-[11px] font-medium text-zinc-400">Integrity</p>
          <p className="text-[10px] text-zinc-600">
            {passed
              ? "Checks passed — plan aligned with guardrails"
              : `Review recommended (${severity} severity)`}
          </p>
        </div>
      </div>

      <p className="text-[10px] text-zinc-700">
        {week?.savedAt
          ? `Saved ${formatTs(week.savedAt)}`
          : preview
            ? `Generated ${formatTs(new Date().toISOString())} · unsaved preview`
            : null}
        {week?.generatedAt && week.savedAt !== week.generatedAt
          ? ` · generated ${formatTs(week.generatedAt)}`
          : null}
      </p>

      {showDevIntegrity && preview ? (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
            onClick={() => setDevOpen((v) => !v)}
          >
            <ChevronDown className={cn("h-3 w-3", devOpen && "rotate-180")} />
            Integrity details (dev)
          </button>
          {devOpen ? (
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/40 p-2 text-[9px] text-zinc-600">
              {JSON.stringify(
                {
                  validation: preview.validation.issues,
                  integrity: preview.integrity,
                },
                null,
                2,
              )}
            </pre>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function previewToSidebar(preview: GenerateWeeklyPlanResult) {
  const { plan, guardrails } = preview;
  return {
    summary: plan.summary,
    confidence: plan.confidence,
    totalRunDistanceKm: plan.totalRunDistanceKm,
    hardSessionCount: plan.hardSessionCount,
    evidenceUsed: plan.rationale.evidenceUsed,
    constraintsApplied: guardrails.constraintNotes,
    risksManaged: plan.rationale.risksManaged,
    limitations: plan.limitations,
  };
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
