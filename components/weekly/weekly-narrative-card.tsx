"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import type { WeeklyNarrative } from "@/lib/analytics/narrative";

const severityBorder: Record<WeeklyNarrative["severity"], string> = {
  positive: "border-teal-500/25 bg-teal-500/5",
  neutral: "border-white/10 bg-white/[0.02]",
  warning: "border-amber-500/25 bg-amber-500/5",
};

export function WeeklyNarrativeCard({
  narrative,
  compact = false,
}: {
  narrative: WeeklyNarrative;
  compact?: boolean;
}) {
  return (
    <section className={`rounded-xl border p-5 ${severityBorder[narrative.severity]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">This week</p>
        <ConfidenceBadge level={narrative.confidence} />
      </div>
      <p className="mt-1 text-sm text-zinc-500">{narrative.weekLabel}</p>
      {compact ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          {narrative.paragraphs[0] ?? "No activity this week yet."}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {narrative.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-zinc-300">
              {p}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
