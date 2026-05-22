"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConsistencyScore } from "@/lib/analytics/consistency";

export function ConsistencyCard({ score }: { score: ConsistencyScore }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500">
          Consistency
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-3xl font-bold text-white tabular-nums">
          {score.overall}
          <span className="text-lg text-zinc-500"> / 100</span>
        </p>
        <p className="mt-1 text-sm text-emerald-400/90">{score.label}</p>
        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
          <li>Frequency: {score.frequency}/100</li>
          <li>Volume stability: {score.volumeStability}/100</li>
          <li>Streak: {score.streakWeeks} week{score.streakWeeks === 1 ? "" : "s"}</li>
        </ul>
      </CardContent>
    </Card>
  );
}
