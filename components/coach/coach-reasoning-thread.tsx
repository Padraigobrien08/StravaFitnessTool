"use client";

import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { CoachThread } from "@/lib/coach/threadStorage";
import { CoachOperationalStrip } from "./coach-operational-strip";
import { CoachUserMessage } from "./coach-user-message";
import { CoachIntelligenceCard } from "./coach-intelligence-card";
import { CoachAnalysisLoader } from "./coach-analysis-loader";
import { CoachComposer } from "./coach-composer";
import { CoachInvestigations } from "./coach-investigations";
import { CoachReasoningTrace } from "./coach-reasoning-trace";
import { parseCoachResponse } from "@/lib/coach/parseResponse";
import type { CoachMessage } from "@/lib/coach/types";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  MessageSquarePlus,
  Trash2,
} from "lucide-react";

export function CoachReasoningThread({
  workspace,
  threads,
  activeId,
  messages,
  input,
  setInput,
  loading,
  error,
  pendingTools,
  loadingPhase,
  scrollRef,
  onSend,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  disabled,
  disabledReason,
  composerPlaceholder,
}: {
  workspace: CoachWorkspaceState;
  threads: CoachThread[];
  activeId: string | null;
  messages: CoachMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  error: string | null;
  pendingTools: string[];
  loadingPhase: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSend: (text: string) => void;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  composerPlaceholder: string;
}) {
  const hasConversation = messages.length > 0;

  return (
    <div className="coach-thread-panel flex h-full min-h-0 flex-col border-l border-white/[0.06] bg-[#07080a]">
      <div className="shrink-0 border-b border-white/[0.05] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Reasoning thread
            </p>
            <ThreadPicker
              threads={threads}
              activeId={activeId}
              onSelect={onSelectThread}
              onDelete={onDeleteThread}
            />
          </div>
          <button
            type="button"
            onClick={onNewThread}
            className="shrink-0 rounded-lg border border-teal-500/20 bg-teal-500/[0.08] p-2 text-teal-300/90 hover:bg-teal-500/12"
            aria-label="New investigation"
            title="New investigation"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <CoachOperationalStrip snapshot={workspace.snapshot} />

      {disabled ? (
        <p className="shrink-0 border-b border-amber-500/15 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/85">
          {disabledReason}
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className="coach-thread-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4"
      >
        {!hasConversation ? (
          <div className="space-y-4">
            {workspace.continuityLine ? (
              <p className="text-xs leading-relaxed text-zinc-500 border-l-2 border-teal-500/25 pl-3">
                {workspace.continuityLine}
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-zinc-600">
                Select an investigation from the intelligence model, or ask a
                specific question. Responses are structured evidence — not chat
                bubbles.
              </p>
            )}
            <CoachInvestigations
              investigations={workspace.investigations.slice(0, 5)}
              onSelect={onSend}
              disabled={disabled}
              compact
            />
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m, idx) =>
              m.role === "user" ? (
                <CoachUserMessage key={m.id} content={m.content} index={idx} />
              ) : m.parsed ? (
                <CoachIntelligenceCard
                  key={m.id}
                  parsed={m.parsed}
                  toolsUsed={m.toolsUsed}
                  onFollowUp={onSend}
                  animate
                  progressive
                />
              ) : (
                <CoachIntelligenceCard
                  key={m.id}
                  parsed={parseCoachResponse(m.content)}
                  toolsUsed={m.toolsUsed}
                  onFollowUp={onSend}
                />
              )
            )}
            {loading ? (
              <>
                <CoachReasoningTrace
                  phase={loadingPhase}
                  activeTools={pendingTools}
                />
                <CoachAnalysisLoader activeTools={pendingTools} />
              </>
            ) : null}
          </div>
        )}
        {error ? (
          <p className="mt-4 text-center text-xs text-red-400/90">{error}</p>
        ) : null}
      </div>

      <CoachComposer
        value={input}
        onChange={setInput}
        onSubmit={() => onSend(input)}
        loading={loading}
        disabled={disabled}
        placeholder={composerPlaceholder}
        compact
      />
    </div>
  );
}

function ThreadPicker({
  threads,
  activeId,
  onSelect,
  onDelete,
}: {
  threads: CoachThread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const active = threads.find((t) => t.id === activeId);
  if (threads.length === 0) {
    return (
      <p className="mt-0.5 truncate text-xs text-zinc-500">New investigation</p>
    );
  }

  return (
    <div className="relative mt-0.5 flex items-center gap-1">
      <select
        value={activeId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className={cn(
          "max-w-full flex-1 cursor-pointer truncate rounded-md border-0 bg-transparent",
          "py-0.5 pr-6 text-xs font-medium text-zinc-200",
          "focus:outline-none focus:ring-0"
        )}
      >
        {threads.map((t) => (
          <option key={t.id} value={t.id} className="bg-zinc-900">
            {t.title}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-6 h-3 w-3 text-zinc-600" />
      {active ? (
        <button
          type="button"
          onClick={() => onDelete(active.id)}
          className="rounded p-1 text-zinc-700 hover:text-red-400/90"
          aria-label="Delete session"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
