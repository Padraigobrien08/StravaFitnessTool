"use client";

import Link from "next/link";
import { IntelligenceStateEvolution } from "@/components/intelligence/intelligence-sections";
import type { StateEvolutionItem } from "@/lib/intelligence/presentation";
import { OsSection } from "./os-section";

export function OsTrajectory({ items }: { items: StateEvolutionItem[] }) {
  if (items.length === 0) return null;

  return (
    <OsSection
      title="Current trajectory"
      action={
        <Link href="/performance" className="text-[10px] text-zinc-600 hover:text-zinc-400">
          Full analysis →
        </Link>
      }
    >
      <IntelligenceStateEvolution items={items} />
    </OsSection>
  );
}
