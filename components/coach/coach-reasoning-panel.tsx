"use client";

import { useMemo } from "react";
import type { CoachWorkspaceState } from "@/lib/coach/types";
import type { CoachMessage } from "@/lib/coach/types";
import { parseCoachResponse } from "@/lib/coach/parseResponse";
import { CoachConversationTurn, CoachUserTurn } from "./coach-conversation-turn";
import { WeeklyPlanResponse } from "./weekly-plan-response";
import { CoachComposer } from "./coach-composer";
import { CoachAnalysisLoader } from "./coach-analysis-loader";
import { CoachThreadStarter } from "./coach-thread-starter";
import Link from "next/link";
import { RotateCcw, Square } from "lucide-react";
import { intelligenceUrl } from "@/lib/coach/domainLinks";

function pairMessages(messages: CoachMessage[]) {
  const pairs: { user: CoachMessage; assistant?: CoachMessage }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const assistant = messages.slice(i + 1).find((x) => x.role === "assistant");
    pairs.push({ user: m, assistant });
  }
  return pairs;
}

export function CoachReasoningPanel({
  workspace,
  messages,
  input,
  setInput,
  loading,
  error,
  pendingTools,
  scrollRef,
  onSend,
  onStop,
  onRetry,
  disabled,
}: {
  workspace: CoachWorkspaceState;
  analytics: import("@/lib/analytics").DashboardInsights;
  raceGoal: import("@/lib/analytics/readiness").RaceGoal | null;
  messages: CoachMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  error: string | null;
  pendingTools: string[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSend: (text: string) => void;
  onStop?: () => void;
  onRetry?: () => void;
  disabled?: boolean;
}) {
  const hasConversation = messages.length > 0;
  const pairs = useMemo(() => pairMessages(messages), [messages]);
  const lastPair = pairs[pairs.length - 1];

  const composerPlaceholder = useMemo(() => {
    if (loading) return "Waiting for analysis…";
    if (lastPair?.assistant?.parsed?.recommendation) {
      return "Challenge this conclusion, compare sessions, or ask why…";
    }
    if (!hasConversation) {
      return "Ask a follow-up or compare another block…";
    }
    return "Ask a follow-up or compare another block…";
  }, [loading, lastPair, hasConversation]);

  const liveSignal = workspace.observations.find((o) => o.isNew)?.text;

  return (
    <div className="coach-reasoning-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="coach-reasoning-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="px-3 py-5 sm:px-5 sm:py-6">
          <div className="coach-message-column mx-auto w-full">
            {!hasConversation ? (
              <CoachThreadStarter
                state={workspace}
                onSelect={onSend}
                disabled={disabled || loading}
              />
            ) : (
              <>
                {pairs.length > 1 ? (
                  <p className="mb-6 text-[12px] text-zinc-600">
                    {pairs.length} exchanges
                    {workspace.continuityLine ? ` · ${workspace.continuityLine}` : ""}
                  </p>
                ) : null}

                {liveSignal && !loading ? (
                  <p className="mb-5 text-[12px] text-zinc-500">Signal update: {liveSignal}</p>
                ) : null}

                <div className="coach-thread">
                  {pairs.map((pair, i) => (
                    <div
                      key={pair.user.id}
                      className="coach-exchange border-b border-white/[0.03] py-7 last:border-0"
                    >
                      <CoachUserTurn content={pair.user.content} />
                      {pair.assistant ? (
                        <div className="mt-5 space-y-4">
                          <CoachConversationTurn
                            parsed={
                              pair.assistant.parsed ?? parseCoachResponse(pair.assistant.content)
                            }
                            toolsUsed={pair.assistant.toolsUsed}
                            onFollowUp={onSend}
                            showFollowUps={
                              i === pairs.length - 1 && !loading && !pair.assistant.weeklyPlan
                            }
                            animate={i === pairs.length - 1}
                          />
                          {pair.assistant.weeklyPlan ? (
                            <WeeklyPlanResponse result={pair.assistant.weeklyPlan} />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            )}

            {loading ? (
              <div className={hasConversation ? "coach-exchange py-6" : "mt-6 py-2"}>
                <CoachAnalysisLoader activeTools={pendingTools} />
                {onStop ? (
                  <button
                    type="button"
                    onClick={onStop}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-zinc-500 ring-1 ring-[var(--border-subtle)] transition hover:text-zinc-200 hover:ring-[var(--border-default)]"
                  >
                    <Square className="h-3 w-3" /> Stop
                  </button>
                ) : null}
              </div>
            ) : null}

            {error && !loading ? (
              <div
                role="alert"
                className="mt-6 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5"
              >
                <p className="text-[13px] font-medium text-red-200">
                  That investigation didn&apos;t finish
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-red-300/80">
                  Your question is still here, so nothing was lost. ({error})
                </p>
                {onRetry ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-red-200 ring-1 ring-red-500/30 transition hover:bg-red-500/10"
                  >
                    <RotateCcw className="h-3 w-3" /> Ask again
                  </button>
                ) : null}
              </div>
            ) : null}

            <p className="mt-8 pb-2 text-[11px] text-zinc-700">
              <Link href={intelligenceUrl()} className="text-zinc-600 hover:text-zinc-400">
                Intelligence model
              </Link>
            </p>
          </div>
        </div>
      </div>

      <CoachComposer
        value={input}
        onChange={setInput}
        onSubmit={() => onSend(input)}
        loading={loading}
        disabled={disabled}
        placeholder={composerPlaceholder}
      />
    </div>
  );
}
