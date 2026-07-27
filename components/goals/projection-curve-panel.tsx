"use client";

import { useState } from "react";
import { Eyebrow, Panel } from "@/components/console/console-kit";
import { PredictionChart } from "@/components/predictions/prediction-chart";
import type { RaceProjectionView } from "@/lib/performance/viewModels";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function ProjectionCurvePanel({
  projection,
  targetDistanceLabel,
}: {
  projection: RaceProjectionView;
  targetDistanceLabel: string;
}) {
  const [open, setOpen] = useState(true);

  if (projection.analysis.efforts.length === 0) {
    return (
      <Panel>
        <Eyebrow className="mb-2.5">Performance projection curve</Eyebrow>
        <p className="text-sm text-zinc-500">
          Quality efforts between 4–15 km unlock the performance curve and realistic zone shading.
        </p>
      </Panel>
    );
  }

  const primary = projection.primary;

  return (
    <Panel>
      <Eyebrow className="mb-2.5">Performance projection curve</Eyebrow>
      <p className="mb-3 text-xs leading-snug text-zinc-500">
        Your efforts mapped to distance — shaded region is the best-fit corridor for{" "}
        {targetDistanceLabel}. Outliers are recent hard sessions, not necessarily race pace.
      </p>

      {primary ? (
        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-md bg-accent/10 px-2.5 py-1 font-mono tabular-nums text-accent ring-1 ring-inset ring-accent/20">
            Target corridor · {primary.timeDisplay} {primary.spreadDisplay}
          </span>
          <span className="rounded-md bg-[var(--surface-subdued)] px-2.5 py-1 text-zinc-500 ring-1 ring-inset ring-[var(--border-subtle)]">
            <span className="font-mono tabular-nums text-zinc-400">{projection.effortCount}</span>{" "}
            anchor efforts
          </span>
        </div>
      ) : null}

      <button
        type="button"
        className="mb-3 flex w-full items-center justify-between gap-2 rounded-lg bg-[var(--surface-subdued)] px-3 py-2.5 text-left text-xs font-medium text-zinc-500 ring-1 ring-[var(--border-subtle)] hover:text-zinc-300"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Curve & effort scatter
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="overflow-x-auto rounded-lg bg-[var(--surface-subdued)] p-2 ring-1 ring-inset ring-[var(--border-subtle)]">
          <PredictionChart analysis={projection.analysis} />
        </div>
      ) : null}

      <ul className="mt-4 space-y-1 text-xs text-zinc-500">
        {projection.explanation.slice(0, 4).map((line, i) => (
          <li key={i}>· {line}</li>
        ))}
      </ul>
    </Panel>
  );
}
