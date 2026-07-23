"use client";

import Link from "next/link";
import type { PersonalZScores, SessionZScore } from "@/lib/analytics/personalZScores";
import { signalCoachLink } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";

export function IntelligenceStandoutSessions({ data }: { data: PersonalZScores }) {
  if (!data.available) return null;
  const { best, worst } = data.standouts;
  if (!best && !worst) return null;

  return (
    <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] font-medium text-zinc-500">
        Standout sessions
        <span className="ml-1.5 text-zinc-600">each vs your own distribution for that type</span>
      </p>

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
    </section>
  );
}

function SessionRow({ session, tone }: { session: SessionZScore; tone: "good" | "bad" }) {
  const z = session.primaryZ ?? 0;
  const sigmaColor = tone === "good" ? "text-teal-400/90" : "text-amber-300/90";
  return (
    <div className="flex items-baseline gap-2 text-[12px] leading-snug">
      <span className={cn("w-12 shrink-0 tabular-nums font-medium", sigmaColor)}>
        {z >= 0 ? "+" : "−"}
        {Math.abs(z).toFixed(1)}σ
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
