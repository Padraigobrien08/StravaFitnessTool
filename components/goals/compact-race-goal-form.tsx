"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { RACE_DISTANCE_LABELS, type RaceDistance, type RaceGoal } from "@/lib/analytics/readiness";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function CompactRaceGoalForm() {
  const { raceGoal, setRaceGoal, clearRaceGoal } = useGoalStore();
  const [open, setOpen] = useState(!raceGoal);
  const [distance, setDistance] = useState<RaceDistance>(raceGoal?.distance ?? "hm");
  const [date, setDate] = useState(
    () =>
      raceGoal?.date ?? new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [targetTime, setTargetTime] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!date) return;
    const goal: RaceGoal = { distance, date };
    const targetTimeSec = parseTargetTime(targetTime);
    if (targetTimeSec) goal.targetTimeSec = targetTimeSec;
    setRaceGoal(goal);
    setOpen(false);
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-white/[0.05] bg-white/[0.02]"
    >
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            className="flex h-auto w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left font-normal hover:bg-white/[0.02]"
          />
        }
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Race mission setup
          {raceGoal ? (
            <span className="ml-2 font-normal normal-case text-teal-400/80">
              {RACE_DISTANCE_LABELS[raceGoal.distance]} ·{" "}
              {new Date(raceGoal.date).toLocaleDateString()}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-zinc-600 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 border-t border-white/[0.04] px-4 py-4 sm:grid-cols-4"
        >
          <div className="space-y-2">
            <Label className="text-xs text-zinc-500">Distance</Label>
            <Select value={distance} onValueChange={(v) => setDistance(v as RaceDistance)}>
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
            <Label htmlFor="compact-race-date" className="text-xs text-zinc-500">
              Race date
            </Label>
            <Input
              id="compact-race-date"
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="compact-race-target" className="text-xs text-zinc-500">
              Target time (optional)
            </Label>
            <Input
              id="compact-race-target"
              type="text"
              value={targetTime}
              placeholder="1:49:00"
              onChange={(e) => setTargetTime(e.target.value)}
            />
          </div>
          <div className="flex gap-2 sm:col-span-4">
            <Button type="submit" size="sm">
              Update mission
            </Button>
            {raceGoal ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearRaceGoal}>
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
