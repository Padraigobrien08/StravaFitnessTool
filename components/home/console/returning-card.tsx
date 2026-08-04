"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow, Panel, StatItem } from "@/components/console/console-kit";
import { coachUrl } from "@/lib/coach/domainLinks";
import { formatKm } from "@/lib/utils";
import type { ReturnToRunningPlan } from "@/lib/returning/returnToRunning";

/**
 * Shown instead of the usual verdict when the athlete has been away. Load-based
 * advice has nothing recent to reason about after a gap, so this answers the
 * questions that do apply: what did I keep, and what does the first week back
 * look like.
 */
export function ReturningCard({ plan }: { plan: ReturnToRunningPlan }) {
  const first = plan.weeks[0];
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Coming back</Eyebrow>
        <span className="font-mono text-[11px] text-zinc-500">
          {plan.gapDays} days since your last run
        </span>
      </div>

      <p className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground">
        {first ? "Rebuild before you sharpen" : "Ease back in"}
      </p>
      <p className="mt-1.5 max-w-[52ch] text-[13px] leading-snug text-muted-foreground">
        {plan.firstStep}
      </p>

      {/* What survived the gap, and what did not. */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Retained label="Aerobic base" pct={plan.retention.aerobicPct} />
        <Retained label="Top-end sharpness" pct={plan.retention.sharpnessPct} />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">{plan.retention.note}</p>

      {plan.baseline ? (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border-subtle)] pt-3">
          <StatItem label="Your usual week" value={formatKm(plan.baseline.weeklyKm)} />
          <StatItem label="Week 1 target" value={formatKm(first!.targetKm)} hot />
          <StatItem
            label="Back to usual"
            value={`~${plan.weeksToBaseline} wk${plan.weeksToBaseline === 1 ? "" : "s"}`}
          />
        </div>
      ) : null}

      {plan.weeks.length > 0 ? (
        <div className="mt-3">
          <Eyebrow className="mb-2">The ramp</Eyebrow>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {plan.weeks.map((w) => (
              <li key={w.week} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="font-mono text-[11px] text-zinc-500">Wk {w.week}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-300">{w.focus}</span>
                <span className="font-mono text-[12px] tabular-nums text-foreground">
                  {formatKm(w.targetKm)}
                  <span className="ml-1.5 text-[10px] text-zinc-500">
                    {w.runs} runs · long {formatKm(w.longestRunKm)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-snug text-zinc-600">
        Built from your own pre-gap training. Conservative on purpose, and not medical advice: if
        you are coming back from injury or illness, follow whoever is treating you.
      </p>

      <Link
        href={coachUrl({ q: "Build me a safe return-to-running plan from where I am now" })}
        className="mt-2 inline-flex items-center gap-0.5 text-[12px] font-medium text-[var(--home-signal)] hover:underline"
      >
        Plan the comeback in Coach <ArrowRight className="h-3 w-3" />
      </Link>
    </Panel>
  );
}

function Retained({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="rounded-lg bg-[var(--surface-subdued)] p-2.5 ring-1 ring-[var(--border-subtle)]">
      <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">{label} kept</p>
      <p className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-foreground">
        ~{pct}%
      </p>
      <span
        className="mt-1.5 block h-1 rounded-full bg-[var(--surface-elevated)]"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? "var(--home-good)" : "var(--hz-moderate)",
          }}
        />
      </span>
    </div>
  );
}
