"use client";

import Link from "next/link";
import type { MemorySnippet } from "@/lib/coach/memorySnippets";
import { groupMemoryItems } from "@/lib/intelligence/intelligenceUiHelpers";
import { signalCoachLink } from "@/lib/coach/domainLinks";
import { cn } from "@/lib/utils";
import { OsSection } from "./os-section";

export function OsMemory({ memory }: { memory: MemorySnippet[] }) {
  if (memory.length === 0) return null;

  const grouped = groupMemoryItems(memory);
  const groups: {
    key: keyof typeof grouped;
    title: string;
    tone: string;
  }[] = [
    { key: "stable", title: "Stable", tone: "text-zinc-500" },
    { key: "emerging", title: "Emerging", tone: "text-accent/70" },
    { key: "watchlist", title: "Watchlist", tone: "text-amber-400/60" },
  ];

  return (
    <OsSection
      title="What the system recently learned"
      action={
        <Link href="/intelligence" className="text-[10px] text-zinc-600 hover:text-zinc-400">
          Full model →
        </Link>
      }
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {groups.map(({ key, title, tone }) => {
          const items = grouped[key].slice(0, 2);
          if (items.length === 0) return null;
          return (
            <div
              key={key}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]/30 px-2.5 py-2"
            >
              <p className={cn("text-[9px] font-semibold uppercase tracking-wide", tone)}>
                {title}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {items.map((m) => (
                  <li key={m.id}>
                    <p className="text-[11px] leading-snug text-zinc-400">{m.text}</p>
                    <Link
                      href={signalCoachLink(`Explain: ${m.text}`)}
                      className="text-[9px] text-zinc-700 hover:text-zinc-500"
                    >
                      Ask Coach
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </OsSection>
  );
}
