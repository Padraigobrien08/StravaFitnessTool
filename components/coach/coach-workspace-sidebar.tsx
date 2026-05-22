"use client";

import Link from "next/link";
import type { CoachThread } from "@/lib/coach/threadStorage";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import { intelligenceUrl } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import { Brain, MessageSquarePlus, Pin, Trash2 } from "lucide-react";

function SidebarSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-3", className)}>
      <p className="mb-1.5 px-1 text-[11px] font-medium text-zinc-500">
        {title}
      </p>
      {children}
    </div>
  );
}

export function CoachWorkspaceSidebar({
  threads,
  activeId,
  state,
  activeDomainId,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onDomainSelect,
  disabled,
  className,
}: {
  threads: CoachThread[];
  activeId: string | null;
  state: CoachWorkspaceState;
  activeDomainId: string | null;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onDomainSelect: (domain: CoachWorkspaceState["domains"][0]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const pinned = state.pinnedFromThread;

  return (
    <aside
      className={cn(
        "coach-sidebar flex h-full min-h-0 w-[260px] shrink-0 flex-col overflow-hidden bg-[#0a0b0e]/60 lg:bg-[#0a0b0e]/40",
        className
      )}
    >
      <div className="shrink-0 px-3 pt-3 pb-2">
        <Link
          href={intelligenceUrl()}
          className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <Brain className="h-3.5 w-3.5 opacity-70" />
          Intelligence
        </Link>
      </div>

      <SidebarSection title="New investigation">
        <button
          type="button"
          onClick={onNewThread}
          className="flex w-full items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2 text-left text-[12px] text-zinc-300 transition-colors hover:bg-white/[0.06]"
        >
          <MessageSquarePlus className="h-3.5 w-3.5 text-zinc-500" />
          Start fresh
        </button>
      </SidebarSection>

      <nav className="min-h-0 flex-1 overflow-y-auto py-2">
        <SidebarSection title="Recent">
          {threads.length > 0 ? (
            <ul className="space-y-0.5">
              {threads.slice(0, 10).map((t) => (
                <li key={t.id} className="group flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectThread(t.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-[12px] leading-snug transition-colors",
                      activeId === t.id
                        ? "bg-white/[0.06] text-zinc-200"
                        : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-400"
                    )}
                  >
                    {t.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteThread(t.id)}
                    className="shrink-0 rounded p-1 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-400"
                    aria-label="Delete thread"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-1 text-[12px] text-zinc-600">No investigations yet</p>
          )}
        </SidebarSection>

        {pinned.length > 0 ? (
          <SidebarSection title="Pinned" className="mt-4">
            <ul className="space-y-1">
              {pinned.slice(0, 3).map((p) => (
                <li
                  key={p.id}
                  className="flex gap-1.5 rounded-md px-2 py-1.5 text-[11px] leading-snug text-zinc-500"
                >
                  <Pin className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />
                  <span className="line-clamp-2">{p.title}</span>
                </li>
              ))}
            </ul>
          </SidebarSection>
        ) : null}
      </nav>

      <div className="shrink-0 border-t border-white/[0.04] py-3">
        <SidebarSection title="Domains">
          <ul className="space-y-0.5">
            {state.domains.slice(0, 7).map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onDomainSelect(d)}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-[12px] transition-colors disabled:opacity-40",
                    activeDomainId === d.id
                      ? "bg-white/[0.06] text-zinc-300"
                      : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-400"
                  )}
                >
                  {d.title}
                </button>
              </li>
            ))}
          </ul>
        </SidebarSection>
      </div>
    </aside>
  );
}
