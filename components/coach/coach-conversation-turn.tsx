"use client";

import { useState } from "react";
import type { ParsedCoachResponse } from "@/lib/coach/parseResponse";
import { formatCoachText } from "@/lib/coach/formatText";
import { CoachResponseMeta } from "./coach-response-meta";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

/** Conversation-first analytical response */
export function CoachConversationTurn({
  parsed,
  onFollowUp,
  showFollowUps = true,
  animate,
  toolsUsed,
}: {
  parsed: ParsedCoachResponse;
  onFollowUp: (text: string) => void;
  showFollowUps?: boolean;
  animate?: boolean;
  toolsUsed?: string[];
}) {
  const [deeperOpen, setDeeperOpen] = useState(false);

  const implications = [...parsed.why, ...parsed.risks].filter(Boolean);
  const deeperBullets = [
    ...parsed.historicalComparison,
    ...parsed.adaptation,
    ...parsed.memoryNotes,
    ...parsed.limitations.slice(1),
  ].filter(Boolean);

  const topEvidence = parsed.evidence.slice(0, 3);
  const moreEvidence = parsed.evidence.slice(3);

  return (
    <article
      className={cn(
        "coach-conversation-turn",
        animate && "coach-turn-enter"
      )}
    >
      <div className="space-y-3.5">
        {parsed.summary ? (
          <p className="text-[15px] leading-[1.62] text-zinc-200">
            {formatCoachText(parsed.summary)}
          </p>
        ) : !parsed.isStructured ? (
          <p className="whitespace-pre-wrap text-[15px] leading-[1.62] text-zinc-300">
            {formatCoachText(parsed.raw)}
          </p>
        ) : null}

        {parsed.recommendation ? (
          <div className="rounded-lg bg-white/[0.035] px-3.5 py-3">
            <p className="text-[14px] leading-[1.55] text-zinc-200">
              {formatCoachText(parsed.recommendation)}
            </p>
          </div>
        ) : null}

        {topEvidence.length > 0 ? (
          <ul className="space-y-1 text-[13px] leading-[1.5] text-zinc-500">
            {topEvidence.map((item, i) => (
              <li key={i} className="flex gap-2 pl-0.5">
                <span className="mt-[0.55rem] h-px w-2 shrink-0 bg-zinc-600/80" />
                <span>{formatCoachText(item)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {implications.length > 0 ? (
          <p className="text-[13px] leading-[1.55] text-zinc-500">
            {implications.map(formatCoachText).join(" ")}
          </p>
        ) : null}
      </div>

      <CoachResponseMeta parsed={parsed} toolsUsed={toolsUsed} />

      {deeperBullets.length > 0 || moreEvidence.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setDeeperOpen((o) => !o)}
            className="flex items-center gap-1 text-[12px] text-zinc-600 transition-colors hover:text-zinc-400"
          >
            {deeperOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {deeperOpen ? "Hide supporting detail" : "Supporting detail"}
          </button>
          {deeperOpen ? (
            <ul className="mt-2.5 space-y-1.5 text-[12px] leading-[1.5] text-zinc-600">
              {moreEvidence.map((item, i) => (
                <li key={`ev-${i}`}>{formatCoachText(item)}</li>
              ))}
              {deeperBullets.map((item, i) => (
                <li key={`deep-${i}`}>{formatCoachText(item)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showFollowUps && parsed.followUps.length > 0 ? (
        <div className="mt-5 border-t border-white/[0.04] pt-4">
          <div className="flex flex-col gap-2">
            {parsed.followUps.slice(0, 3).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onFollowUp(q)}
                className="text-left text-[13px] text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {formatCoachText(q)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function CoachUserTurn({
  content,
  isOpening,
}: {
  content: string;
  isOpening?: boolean;
}) {
  if (isOpening) return null;

  return (
    <div className={cn("coach-user-turn flex justify-end coach-turn-enter")}>
      <div className="max-w-[min(100%,28rem)] rounded-xl bg-white/[0.05] px-3.5 py-2.5">
        <p className="text-[14px] leading-[1.45] text-zinc-200">
          {formatCoachText(content)}
        </p>
      </div>
    </div>
  );
}
