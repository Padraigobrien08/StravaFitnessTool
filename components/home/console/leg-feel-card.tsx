"use client";

import { useState } from "react";
import { useLegFeel } from "@/hooks/use-leg-feel";
import { Eyebrow, Panel } from "@/components/console/console-kit";
import { cn } from "@/lib/utils";
import type { LegFeel } from "@/lib/wellness/types";

const OPTS: { key: LegFeel; label: string }[] = [
  { key: "fresh", label: "Fresh" },
  { key: "normal", label: "Normal" },
  { key: "heavy", label: "Heavy" },
];

const HINT: Record<LegFeel, string> = {
  fresh: "Noted. A touch more room in today's call.",
  normal: "Logged. Today's call stands.",
  heavy: "Adjusted: today's readiness eased. Re-check tomorrow.",
};

const AREAS = ["Knee", "Calf", "Achilles", "Hamstring", "Foot", "Other"];
const SEV: { n: 1 | 2 | 3; label: string }[] = [
  { n: 1, label: "Mild" },
  { n: 2, label: "Moderate" },
  { n: 3, label: "Strong" },
];

export function LegFeelCard() {
  const { legs, report, setFeel } = useLegFeel();
  const [picking, setPicking] = useState(false);
  const niggle = report?.niggle ?? null;

  const flag = (area: string, severity: 1 | 2 | 3) =>
    setFeel(legs ?? "normal", "morning", { niggle: { area, severity } });
  const clearNiggle = () => setFeel(legs ?? "normal", "morning", { niggle: null });

  return (
    <Panel>
      <Eyebrow className="mb-3">How do the legs feel?</Eyebrow>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Leg feel">
        {OPTS.map((o) => {
          const active = legs === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFeel(o.key)}
              className={cn(
                "rounded-lg px-2 py-2.5 font-mono text-xs ring-1 transition",
                active
                  ? "text-[var(--home-signal)] ring-[var(--home-signal-line)]"
                  : "text-zinc-400 ring-[var(--border-subtle)] hover:text-foreground",
              )}
              style={active ? { background: "var(--home-signal-wash)" } : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11px] leading-snug text-zinc-500">
        {legs
          ? HINT[legs]
          : "Tell the model what the numbers can't see. It tunes today's readiness."}
      </p>

      {/* niggle */}
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
        {niggle ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-amber-300/90">
                <span aria-hidden>⚑</span> {niggle.area}
              </span>
              <button
                type="button"
                onClick={clearNiggle}
                className="font-mono text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                clear
              </button>
            </div>
            <div className="flex gap-1.5">
              {SEV.map((s) => (
                <button
                  key={s.n}
                  type="button"
                  aria-pressed={niggle.severity === s.n}
                  onClick={() => flag(niggle.area, s.n)}
                  className={cn(
                    "flex-1 rounded-md px-1 py-1.5 font-mono text-[10px] ring-1 transition",
                    niggle.severity === s.n
                      ? "text-amber-300 ring-amber-500/40"
                      : "text-zinc-500 ring-[var(--border-subtle)] hover:text-zinc-300",
                  )}
                  style={
                    niggle.severity === s.n ? { background: "rgba(217,119,6,0.10)" } : undefined
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : picking ? (
          <div className="flex flex-wrap gap-1.5">
            {AREAS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  flag(a, 2);
                  setPicking(false);
                }}
                className="rounded-md px-2 py-1 font-mono text-[10px] text-zinc-400 ring-1 ring-[var(--border-subtle)] transition hover:text-amber-300 hover:ring-amber-500/40"
              >
                {a}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="font-mono text-[11px] text-zinc-500 transition hover:text-amber-300"
          >
            + Flag a niggle
          </button>
        )}
      </div>
    </Panel>
  );
}
