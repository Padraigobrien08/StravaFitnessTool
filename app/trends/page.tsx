"use client";

import { RequireData } from "@/components/require-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaceChart, HrChart, LoadChart, FitnessChart } from "@/components/charts";
import { useStrava } from "@/lib/context/strava-context";

export default function TrendsPage() {
  const { insights } = useStrava();

  return (
    <RequireData>
      {insights && (
        <div className="space-y-8">
          <h1 className="font-display text-2xl font-bold text-white">Trends</h1>

          <Card>
            <CardHeader>
              <CardTitle>Pace over time</CardTitle>
            </CardHeader>
            <CardContent>
              {insights.paceTrend.length < 3 ? (
                <p className="text-sm text-zinc-500">Need more runs for pace trends.</p>
              ) : (
                <PaceChart
                  data={insights.paceTrend}
                  rolling={insights.rollingPace}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Average heart rate</CardTitle>
              </CardHeader>
              <CardContent>
                <HrChart data={insights.hrTrend} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Training load per run</CardTitle>
              </CardHeader>
              <CardContent>
                {insights.trainingLoadByRun.length === 0 ? (
                  <p className="text-sm text-zinc-500">No training load data on runs.</p>
                ) : (
                  <LoadChart data={insights.trainingLoadByRun} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fitness index (CTL-style)</CardTitle>
            </CardHeader>
            <CardContent>
              {insights.fitnessIndex.length < 2 ? (
                <p className="text-sm text-zinc-500">
                  Need more weeks with training load for fitness trend.
                </p>
              ) : (
                <>
                  <FitnessChart data={insights.fitnessIndex} />
                  <p className="mt-3 text-xs text-zinc-600">
                    Directional estimate from weekly training load — not identical to TrainingPeaks CTL.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </RequireData>
  );
}
