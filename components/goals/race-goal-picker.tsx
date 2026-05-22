"use client";

import { Button } from "@/components/ui/button";
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
  };

  const defaultDate =
    raceGoal?.date ??
    new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Race goal
      </p>
      <p className="mt-1 text-sm text-zinc-400">
        Set a target race to get a personalized readiness score and training gaps.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-500">
          Distance
          <select
            name="distance"
            defaultValue={raceGoal?.distance ?? "hm"}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-200"
          >
            {DISTANCES.map((d) => (
              <option key={d} value={d}>
                {RACE_DISTANCE_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-zinc-500">
          Race date
          <input
            type="date"
            name="date"
            defaultValue={defaultDate}
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-200"
          />
        </label>
        <label className="block text-sm text-zinc-500 sm:col-span-2">
          Target time (optional, e.g. 1:45:00 or 50:00)
          <input
            type="text"
            name="targetTime"
            placeholder="Leave blank to use predictions"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-200"
          />
        </label>
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
    </div>
  );
}
