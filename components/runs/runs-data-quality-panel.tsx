"use client";

import Link from "next/link";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DashboardPanel } from "@/components/home/primitives/dashboard-panel";
import type { RunsDataQualityView } from "@/lib/runs/viewModels";
import { dash } from "@/components/home/primitives/tokens";

export function RunsDataQualityPanel({ data }: { data: RunsDataQualityView }) {
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className={dash.labelAccent}>Data quality & coverage</span>
        <ConfidenceBadge
          level={
            data.hrCoveragePct >= 70
              ? "high"
              : data.hrCoveragePct >= 45
                ? "medium"
                : "low"
          }
        />
      </div>
      <DashboardPanel padding="compact" subdued>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className={dash.label}>HR coverage</p>
            <p className="mt-1 text-lg font-semibold text-zinc-200">
              {data.hrCoveragePct}%
            </p>
          </div>
          <div>
            <p className={dash.label}>FIT streams</p>
            <p className="mt-1 text-lg font-semibold text-zinc-200">
              {data.fitCount} runs
            </p>
          </div>
          <div>
            <p className={dash.label}>Classification</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {data.classificationNote}
            </p>
          </div>
        </div>

        {data.confidenceByType.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.confidenceByType.map((c) => (
              <span
                key={c.type}
                className="rounded-md bg-white/[0.03] px-2.5 py-1 text-[10px] ring-1 ring-inset ring-white/[0.06]"
              >
                <span className="text-zinc-500">{c.type}</span>
                <span className="ml-1.5 font-medium text-zinc-400">
                  {c.level}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        {data.warnings.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-amber-400/85">
            {data.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        ) : null}

        <p className="mt-3 text-xs text-zinc-600">
          <Link href="/import" className="text-teal-400/90 hover:text-teal-300">
            Improve coverage via import →
          </Link>
        </p>
      </DashboardPanel>
    </section>
  );
}
