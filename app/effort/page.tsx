"use client";

import { RequireData } from "@/components/require-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ZoneBarChart } from "@/components/charts";
import { WorkoutTypeChart } from "@/components/workout/workout-type-chart";
import { IntensityAdvisorPanel } from "@/components/effort/intensity-advisor-panel";
import { InsightList } from "@/components/insights/insight-list";
import { useStrava } from "@/lib/context/strava-context";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";

export default function EffortPage() {
  const { insights } = useStrava();
  const { insights: generated } = useTrainingIntelligence();
  const trainingInsights = generated.filter((i) => i.question === "training");

  return (
    <RequireData>
      {insights && (
        <div className="space-y-8">
          <h1 className="font-display text-2xl font-bold text-white">Effort & HR</h1>
          <p className="text-sm text-zinc-500">
            Zones based on average HR per run vs max HR ({insights.athleteMaxHr} bpm from your
            Strava settings).
          </p>

          <InsightList insights={trainingInsights} limit={2} />

          <IntensityAdvisorPanel advice={insights.intensityAdvice} />

          <Card>
            <CardHeader>
              <CardTitle>Workout types (last 8 weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-xs text-zinc-500">
                Auto-labeled from distance, heart rate, activity title, and FIT lap patterns.
              </p>
              <WorkoutTypeChart data={insights.workoutTypeMix} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>HR zone distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ZoneBarChart data={insights.hrZones} />
                <ul className="mt-4 space-y-1 text-sm text-zinc-500">
                  {insights.hrZones.map((z) => (
                    <li key={z.zone}>
                      {z.label}: {z.runCount} runs ({z.pct.toFixed(0)}%)
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Easy vs hard runs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-emerald-500/10 p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-400">{insights.easyHard.easy}</p>
                    <p className="text-sm text-zinc-500">Easy (&lt;80% max HR)</p>
                  </div>
                  <div className="rounded-lg bg-red-500/10 p-4 text-center">
                    <p className="text-3xl font-bold text-red-400">{insights.easyHard.hard}</p>
                    <p className="text-sm text-zinc-500">Hard (80%+ max HR)</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-400">
                  {insights.easyHard.easyPct.toFixed(0)}% of runs classified as easy — polarized
                  training typically targets ~80% easy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </RequireData>
  );
}
