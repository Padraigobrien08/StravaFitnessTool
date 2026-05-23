"use client";

import { IntelligenceStateEvolution } from "@/components/intelligence/intelligence-sections";
import type { StateEvolutionItem } from "@/lib/intelligence/presentation";
import { OsSection } from "./os-section";

export function OsTrajectory({ items }: { items: StateEvolutionItem[] }) {
  if (items.length === 0) return null;

  return (
    <OsSection title="Current trajectory">
      <IntelligenceStateEvolution items={items} />
    </OsSection>
  );
}
