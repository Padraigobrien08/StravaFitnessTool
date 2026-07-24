"use client";

import Link from "next/link";
import type { PersonalZScores, SessionZScore } from "@/lib/analytics/personalZScores";
import { signalCoachLink } from "@/lib/coach/domainLinks";
import { JargonTerm } from "@/components/jargon-term";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

export function IntelligenceStandoutSessions({ data }: { data: PersonalZScores }) {
  if (!data.available) return null;
  const { best, worst } = data.standouts;
  if (!best && !worst) return null;

  return (
    <Panel title="Standout sessions" hint="each vs your own distribution for that type">
      <div className="mt-2 space-y-2">
        {best ? <SessionRow session={best} tone="good" /> : null}
        {worst ? <SessionRow session={worst} tone="bad" /> : null}
      </div>

      {data.limitations.length > 0 ? (
        <p className="mt-2 text-[10px] leading-snug text-zinc-700">{data.limitations[0]}</p>
      ) : null}

      <Link
        href={signalCoachLink("How do my recent sessions compare to my own typical for each type?")}
        className="mt-2 inline-block text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        Ask Coach
      </Link>
    </Panel>
  );
}

function SessionRow({ session, tone }: { session: SessionZScore; tone: "good" | "bad" }) {
  const z = session.primaryZ ?? 0;
  const sigmaColor = tone === "good" ? "text-teal-400/90" : "text-amber-300/90";
  return (
    <div className="flex items-baseline gap-2 text-[12px] leading-snug">
      <span className={cn("w-12 shrink-0 tabular-nums font-medium", sigmaColor)}>
        {z >= 0 ? "+" : "−"}
        {Math.abs(z).toFixed(1)}
        <JargonTerm term="sigma">σ</JargonTerm>
      </span>
      <div className="min-w-0">
        <p className="text-zinc-300">
          <span className="text-zinc-500">{session.date.slice(0, 10)}</span> · {session.typeLabel}
        </p>
        <p className="text-[10px] text-zinc-600">
          vs {session.cohortSize} of your {session.typeLabel.toLowerCase()}s · {session.confidence}{" "}
          confidence
        </p>
      </div>
    </div>
  );
}
