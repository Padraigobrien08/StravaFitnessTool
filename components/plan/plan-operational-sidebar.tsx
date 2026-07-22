"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { GenerateWeeklyPlanResult } from "@/lib/ai-planning";
import type { TrainingCalendarWeek } from "@/lib/training-calendar";
import { topicCoachLink } from "@/lib/coach/domainLinks";
import { PlanIntegrityPanel } from "./plan-integrity-panel";
import type { PlanIntegrityItem } from "@/lib/plan/planWorkspaceView";
import { PlanCoachRefine } from "./plan-coach-refine";
import { PlanExplainability } from "./plan-explainability";

function SidebarSection({
  title,
  items,
  tone,
  coachQuery,
}: {
  title: string;
  items: string[];
  tone?: "risk" | "neutral";
  coachQuery?: string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p
        className={
          tone === "risk"
            ? "text-[10px] font-semibold uppercase tracking-wide text-amber-400/55"
            : "text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
        }
      >
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.slice(0, 4).map((item) => (
          <li
            key={item}
            className={
              tone === "risk"
                ? "text-[11px] leading-snug text-amber-100/75"
                : "text-[11px] leading-snug text-zinc-400"
            }
          >
            · {item}
          </li>
        ))}
      </ul>
      {coachQuery ? (
        <Link
          href={topicCoachLink("plan", coachQuery)}
          className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          Coach <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      ) : null}
    </div>
  );
}

export function PlanOperationalSidebar({
  week,
  preview,
  integrityItems,
  explainLines,
  onHighlightWorkouts,
}: {
  week: TrainingCalendarWeek | null;
  preview: GenerateWeeklyPlanResult | null;
  integrityItems: PlanIntegrityItem[];
  explainLines: string[];
  onHighlightWorkouts?: (ids: string[]) => void;
}) {
  const data = week ?? (preview ? previewToMeta(preview) : null);
  if (!data) {
    return (
      <aside className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subdued)]/60 p-3">
        <p className="text-[12px] text-zinc-600">
          Generate or save a plan to see week reasoning and validation.
        </p>
      </aside>
    );
  }

  const whyWeek = [data.summary, ...data.evidenceUsed.slice(0, 2)].filter(Boolean);

  const coachNotes = data.limitations
    .slice(0, 3)
    .map((l) => (l.length > 80 ? `${l.slice(0, 77)}…` : l));

  return (
    <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
      <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subdued)]/80 p-3">
        <SidebarSection
          title="Why this week exists"
          items={whyWeek}
          coachQuery="Explain why this week plan is structured this way"
        />
        <SidebarSection title="Constraints applied" items={data.constraintsApplied} />
        <SidebarSection
          title="Risks managed"
          items={data.risksManaged}
          tone="risk"
          coachQuery="What risks remain in this week plan?"
        />
        <PlanIntegrityPanel items={integrityItems} onHighlightWorkouts={onHighlightWorkouts} />
        {coachNotes.length > 0 ? <SidebarSection title="Coach notes" items={coachNotes} /> : null}
      </div>

      <PlanExplainability lines={explainLines} />
      <PlanCoachRefine />
    </aside>
  );
}

function previewToMeta(preview: GenerateWeeklyPlanResult) {
  const { plan, guardrails } = preview;
  return {
    summary: plan.summary,
    evidenceUsed: plan.rationale.evidenceUsed,
    constraintsApplied: guardrails.constraintNotes,
    risksManaged: plan.rationale.risksManaged,
    limitations: plan.limitations,
  };
}
