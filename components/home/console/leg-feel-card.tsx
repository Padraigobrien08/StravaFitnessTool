"use client";

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
  fresh: "Noted — a touch more room in today's call.",
  normal: "Logged. Today's call stands.",
  heavy: "Adjusted — today's readiness eased. Re-check tomorrow.",
};

export function LegFeelCard() {
  const { legs, setFeel } = useLegFeel();

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
        {legs ? HINT[legs] : "Tell the model what the numbers can't — it tunes today's readiness."}
      </p>
    </Panel>
  );
}
