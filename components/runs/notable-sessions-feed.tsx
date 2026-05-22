"use client";

import Link from "next/link";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import type { NotableSessionView } from "@/lib/runs/viewModels";
import { dash } from "@/components/home/primitives/tokens";
import { ArrowRight } from "lucide-react";

export function NotableSessionsFeed({
  sessions,
}: {
  sessions: NotableSessionView[];
}) {
  return (
    <PanelChrome title="Recent notable sessions" accent>
      <p className={`${dash.muted} mb-4`}>
        Interpreted highlights — why each session mattered for your trajectory.
      </p>
      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">No notable sessions identified yet.</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              className="group rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 transition-colors hover:border-teal-500/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-500/80">
                  {s.signal}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-400/80" />
              </div>
              <h3 className="mt-1 font-display text-sm font-semibold text-zinc-100">
                {s.title}
              </h3>
              <p className="mt-0.5 text-xs tabular-nums text-zinc-500">{s.meta}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{s.why}</p>
            </Link>
          ))}
        </div>
      )}
    </PanelChrome>
  );
}
