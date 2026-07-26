"use client";

import { NotableSessionsFeed } from "./notable-sessions-feed";
import { WorkoutPatternAnalysis } from "./workout-pattern-analysis";
import { Eyebrow } from "@/components/console/console-kit";
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
        <Eyebrow className="mb-2">Session intelligence feed · curated</Eyebrow>
        <NotableSessionsFeed sessions={sessions} />
      </section>
      <WorkoutPatternAnalysis patterns={patterns} />
    </div>
  );
}
