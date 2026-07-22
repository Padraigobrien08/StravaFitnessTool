"use client";

import { useState } from "react";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { PredictionChart } from "@/components/predictions/prediction-chart";
import type { RaceProjectionView } from "@/lib/performance/viewModels";
import { dash } from "@/components/home/primitives/tokens";
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
      <PanelChrome title="Performance projection curve" subdued>
        <p className="text-sm text-zinc-500">
          Quality efforts between 4–15 km unlock the performance curve and realistic zone shading.
        </p>
      </PanelChrome>
    );
  }

  const primary = projection.primary;

  return (
    <PanelChrome title="Performance projection curve" elevated>
      <p className={`${dash.muted} mb-3`}>
        Your efforts mapped to distance — shaded region is the best-fit corridor for{" "}
        {targetDistanceLabel}. Outliers are recent hard sessions, not necessarily race pace.
      </p>

      {primary ? (
        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-md bg-teal-500/10 px-2.5 py-1 text-teal-300/90 ring-1 ring-inset ring-teal-500/20">
            Target corridor · {primary.timeDisplay} {primary.spreadDisplay}
          </span>
          <span className="rounded-md bg-white/[0.04] px-2.5 py-1 text-zinc-500 ring-1 ring-inset ring-white/[0.06]">
            {projection.effortCount} anchor efforts
          </span>
        </div>
      ) : null}

      <button
        type="button"
        className="mb-3 flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hover:bg-white/[0.04]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Curve & effort scatter
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="rounded-lg bg-white/[0.02] p-2 ring-1 ring-inset ring-white/[0.04]">
          <PredictionChart analysis={projection.analysis} />
        </div>
      ) : null}

      <ul className="mt-4 space-y-1 text-xs text-zinc-600">
        {projection.explanation.slice(0, 4).map((line, i) => (
          <li key={i}>· {line}</li>
        ))}
      </ul>
    </PanelChrome>
  );
}
