"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGoalStore } from "@/stores/goal-store";
import {
  RACE_DISTANCE_LABELS,
  type RaceDistance,
  type RaceGoal,
} from "@/lib/analytics/readiness";

const DISTANCES: RaceDistance[] = ["5k", "10k", "hm", "marathon"];

function parseTargetTime(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    if (parts.some((n) => Number.isNaN(n))) return undefined;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return undefined;
  }
  const min = Number(trimmed);
  if (!Number.isNaN(min) && min > 0) return Math.round(min * 60);
  return undefined;
}

export function RaceGoalPicker() {
  const { raceGoal, setRaceGoal, clearRaceGoal } = useGoalStore();
  const [distance, setDistance] = useState<RaceDistance>(raceGoal?.distance ?? "hm");
  const [date, setDate] = useState(
    () =>
      raceGoal?.date ??
      new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [targetTime, setTargetTime] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!date) return;
    const goal: RaceGoal = { distance, date };
    const targetTimeSec = parseTargetTime(targetTime);
    if (targetTimeSec) goal.targetTimeSec = targetTimeSec;
    setRaceGoal(goal);
  };

  return (
    <Card className="border-white/10 bg-white/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Race goal
        </CardTitle>
        <p className="text-sm font-normal text-zinc-400">
          Set a target race to get a personalized readiness score and training gaps.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-zinc-500">Distance</Label>
            <Select
              value={distance}
              onValueChange={(v) => setDistance(v as RaceDistance)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISTANCES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {RACE_DISTANCE_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="race-goal-date" className="text-zinc-500">
              Race date
            </Label>
            <Input
              id="race-goal-date"
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="race-goal-target" className="text-zinc-500">
              Target time (optional, e.g. 1:45:00 or 50:00)
            </Label>
            <Input
              id="race-goal-target"
              type="text"
              value={targetTime}
              placeholder="Leave blank to use predictions"
              onChange={(e) => setTargetTime(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" size="sm">
              Save race goal
            </Button>
            {raceGoal && (
              <Button type="button" variant="ghost" size="sm" onClick={clearRaceGoal}>
                Clear goal
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
