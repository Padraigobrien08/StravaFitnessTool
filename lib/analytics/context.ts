import type { ActivitySummary } from "@/lib/strava/types";

export interface ActivityTypeMix {
  type: string;
  count: number;
  pct: number;
}

export function activityTypeMix(activities: ActivitySummary[]): ActivityTypeMix[] {
  const counts = new Map<string, number>();
  for (const a of activities) {
    counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  }
  const total = activities.length;
  return [...counts.entries()]
    .map(([type, count]) => ({
      type,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}
