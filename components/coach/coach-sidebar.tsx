"use client";

import type { CoachThread } from "@/lib/coach/threadStorage";
import { dash } from "@/components/home/primitives/tokens";
import { cn } from "@/lib/utils";
import { MessageSquarePlus, PanelLeftClose, PanelLeft, Trash2 } from "lucide-react";

export function CoachSidebar({
  threads,
  activeId,
  collapsed,
  onToggleCollapse,
  onNewThread,
  onSelectThread,
  onDeleteThread,
}: {
  threads: CoachThread[];
  activeId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
}) {
  if (collapsed) {
    return (
      <div className="hidden w-12 shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#0a0b0e]/80 py-3 lg:flex">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
          aria-label="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNewThread}
          className="mt-2 rounded-lg p-2 text-teal-500/80 hover:bg-teal-500/10"
          aria-label="New analysis"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="coach-sidebar hidden w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0b0e]/80 xl:w-[240px] lg:flex">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-3">
        <span className={dash.labelAccent}>Sessions</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded p-1 text-zinc-600 hover:text-zinc-400"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="p-2">
        <button
          type="button"
          onClick={onNewThread}
          className="flex w-full items-center gap-2 rounded-lg border border-teal-500/20 bg-teal-500/[0.08] px-3 py-2 text-xs font-medium text-teal-100/90 transition-colors hover:bg-teal-500/12"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New analysis
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {threads.length === 0 ? (
          <p className="px-2 py-4 text-[11px] text-zinc-600">
            Past coaching sessions appear here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((t) => (
              <li key={t.id}>
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-lg pr-1",
                    activeId === t.id && "bg-white/[0.05]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectThread(t.id)}
                    className="min-w-0 flex-1 px-2.5 py-2 text-left"
                  >
                    <p className="truncate text-xs font-medium text-zinc-300">
                      {t.title}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {new Date(t.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteThread(t.id)}
                    className="rounded p-1 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400/90"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-white/[0.05] p-3">
        <p className={dash.label}>Pinned topics</p>
        <ul className="mt-2 space-y-1 text-[11px] text-zinc-600">
          <li>Readiness & race prep</li>
          <li>Threshold execution</li>
          <li>Long-run fade</li>
        </ul>
      </div>
    </aside>
  );
}
