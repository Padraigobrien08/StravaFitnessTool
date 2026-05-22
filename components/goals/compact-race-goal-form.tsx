"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGoalStore } from "@/stores/goal-store";
import {
  RACE_DISTANCE_LABELS,
  type RaceDistance,
  type RaceGoal,
} from "@/lib/analytics/readiness";
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const distance = fd.get("distance") as RaceDistance;
    const date = String(fd.get("date") ?? "");
    const targetRaw = String(fd.get("targetTime") ?? "");
    if (!date) return;
    const goal: RaceGoal = { distance, date };
    const targetTimeSec = parseTargetTime(targetRaw);
    if (targetTimeSec) goal.targetTimeSec = targetTimeSec;
    setRaceGoal(goal);
    setOpen(false);
  };

  const defaultDate =
    raceGoal?.date ??
    new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
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
      </button>
      {open ? (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 border-t border-white/[0.04] px-4 py-4 sm:grid-cols-4"
        >
          <label className="block text-xs text-zinc-500">
            Distance
            <select
              name="distance"
              defaultValue={raceGoal?.distance ?? "hm"}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-sm text-zinc-200"
            >
              {DISTANCES.map((d) => (
                <option key={d} value={d}>
                  {RACE_DISTANCE_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-500">
            Race date
            <input
              type="date"
              name="date"
              defaultValue={defaultDate}
              required
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-sm text-zinc-200"
            />
          </label>
          <label className="block text-xs text-zinc-500 sm:col-span-2">
            Target time (optional)
            <input
              type="text"
              name="targetTime"
              placeholder="1:49:00"
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-sm text-zinc-200"
            />
          </label>
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
      ) : null}
    </div>
  );
}
