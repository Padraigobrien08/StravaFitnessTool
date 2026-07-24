"use client";

import type { ElevationSegment, OverlaySegment } from "@/lib/route-intelligence/types";
import { dash } from "@/components/home/primitives/tokens";

const KIND_LABELS: Record<string, string> = {
  interval: "Work",
  recovery: "Recovery",
  fade: "Fade zone",
  pause: "Pause",
  pace_spike: "Pace surge",
  climb: "Climb",
  descent: "Descent",
};

const KIND_DOT: Record<string, string> = {
  interval: "bg-teal-400",
  recovery: "bg-zinc-500",
  fade: "bg-amber-400",
  pause: "bg-zinc-600",
  pace_spike: "bg-violet-400",
  climb: "bg-teal-400",
  descent: "bg-blue-400",
};

export function RouteOverlayLegend({
  overlays,
  elevationSegments,
}: {
  overlays: OverlaySegment[];
  elevationSegments: ElevationSegment[];
}) {
  const kinds = [...new Set(overlays.map((o) => o.kind))];

  if (kinds.length === 0 && elevationSegments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-4 px-4 py-2 text-[11px] text-zinc-500">
      {kinds.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${KIND_DOT[k] ?? "bg-zinc-600"}`} />
          {KIND_LABELS[k] ?? k}
        </span>
      ))}
      {elevationSegments.length > 0 ? (
        <span className={dash.label}>Terrain segments in elevation chart</span>
      ) : null}
    </div>
  );
}
