"use client";

import { NotableSessionsFeed } from "./notable-sessions-feed";
import { WorkoutPatternAnalysis } from "./workout-pattern-analysis";
import type { NotableSessionView, PatternInsightView } from "@/lib/runs/viewModels";

export function SessionIntelligencePanel({
  sessions,
  patterns,
}: {
  sessions: NotableSessionView[];
  patterns: PatternInsightView[];
}) {
  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 text-[11px] font-medium text-zinc-500">
          Session intelligence feed · curated
        </p>
        <NotableSessionsFeed sessions={sessions} />
      </section>
      <WorkoutPatternAnalysis patterns={patterns} />
    </div>
  );
}
