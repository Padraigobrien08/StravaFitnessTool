import type { Insight } from "@/lib/insights/types";
import { InsightCard } from "./insight-card";

export function InsightList({
  insights,
  limit,
}: {
  insights: Insight[];
  limit?: number;
}) {
  const shown = limit ? insights.slice(0, limit) : insights;
  if (shown.length === 0) return null;

  return (
    <div className="space-y-3">
      {shown.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
