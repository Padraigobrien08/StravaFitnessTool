"use client";

import type { ChangeFeedItem } from "@/lib/home/operatingSystemView";
import { cn } from "@/lib/utils";
import { OsSection } from "./os-section";

export function OsChangeFeed({ items }: { items: ChangeFeedItem[] }) {
  if (items.length === 0) return null;

  return (
    <OsSection title="What changed recently">
      <ul className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]/40">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2.5 px-3 py-2 first:rounded-t-lg last:rounded-b-lg"
          >
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                item.tone === "positive" && "bg-teal-400/80",
                item.tone === "warning" && "bg-amber-400/80",
                item.tone === "neutral" && "bg-zinc-500/60"
              )}
              aria-hidden
            />
            <p className="text-[12px] leading-snug text-zinc-400">{item.text}</p>
          </li>
        ))}
      </ul>
    </OsSection>
  );
}
