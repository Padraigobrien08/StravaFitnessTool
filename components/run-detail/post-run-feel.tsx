"use client";

import { useLegFeel } from "@/hooks/use-leg-feel";
import { Eyebrow, Panel } from "@/components/console/console-kit";
import { feelDateKey, type LegFeel } from "@/lib/wellness/types";
import { cn } from "@/lib/utils";

const OPTS: { key: LegFeel; label: string }[] = [
  { key: "fresh", label: "Felt strong" },
  { key: "normal", label: "As expected" },
  { key: "heavy", label: "Rough" },
];

/** Post-run reflection — writes the day's leg-feel with source "post_run". */
export function PostRunFeel({ runDate }: { runDate: string }) {
  const { report, setFeel } = useLegFeel(feelDateKey(new Date(runDate)));
  const selected = report?.legs;

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>How did that run feel?</Eyebrow>
        <div className="flex gap-2" role="group" aria-label="Post-run feel">
          {OPTS.map((o) => {
            const active = selected === o.key;
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFeel(o.key, "post_run")}
                className={cn(
                  "rounded-lg px-3 py-2 font-mono text-xs ring-1 transition",
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
      </div>
      {selected ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          Logged: this is what the model learns your feel against the numbers.
        </p>
      ) : null}
    </Panel>
  );
}
