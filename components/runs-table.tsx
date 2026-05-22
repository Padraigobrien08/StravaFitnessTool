"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RunActivity } from "@/lib/strava/types";
import type { WorkoutClassification, WorkoutType } from "@/lib/analytics/workoutType";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import { WorkoutTypeBadge } from "@/components/workout/workout-type-badge";
import { formatDistanceKm, formatPace } from "@/lib/utils";
import { paceSecPerKm } from "@/lib/analytics/pace";
import { Search } from "lucide-react";

type SortKey = "date" | "distance" | "pace" | "hr" | "type";

const ALL_TYPES = "all" as const;

export function RunsTable({
  runs,
  fitRunIds,
  workoutByRunId,
}: {
  runs: RunActivity[];
  fitRunIds: string[];
  workoutByRunId: Map<string, WorkoutClassification>;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<WorkoutType | typeof ALL_TYPES>(
    ALL_TYPES
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...runs];
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          new Date(r.date).toLocaleDateString().includes(q)
      );
    }
    if (typeFilter !== ALL_TYPES) {
      list = list.filter(
        (r) => workoutByRunId.get(r.id)?.type === typeFilter
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "distance":
          cmp = a.distanceM - b.distanceM;
          break;
        case "pace": {
          const pa = paceSecPerKm(a) ?? 9999;
          const pb = paceSecPerKm(b) ?? 9999;
          cmp = pa - pb;
          break;
        }
        case "hr":
          cmp = (a.avgHr ?? 0) - (b.avgHr ?? 0);
          break;
        case "type": {
          const ta = workoutByRunId.get(a.id)?.type ?? "unknown";
          const tb = workoutByRunId.get(b.id)?.type ?? "unknown";
          cmp = ta.localeCompare(tb);
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [runs, search, sortKey, sortAsc, typeFilter, workoutByRunId]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const Th = ({
    label,
    col,
  }: {
    label: string;
    col: SortKey;
  }) => (
    <th className="pb-3 pr-4">
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className="text-left text-zinc-500 hover:text-zinc-300"
      >
        {label}
        {sortKey === col ? (sortAsc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  const typeOptions: (WorkoutType | typeof ALL_TYPES)[] = [
    ALL_TYPES,
    "easy",
    "recovery",
    "long",
    "tempo",
    "interval",
    "race",
    "unknown",
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Search runs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
            aria-label="Search runs"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as WorkoutType | typeof ALL_TYPES)
          }
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200"
          aria-label="Filter by workout type"
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t === ALL_TYPES ? "All types" : WORKOUT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-zinc-600">
        {filtered.length} of {runs.length} runs
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <Th label="Date" col="date" />
              <th className="pb-3 pr-4 text-zinc-500">Run</th>
              <Th label="Type" col="type" />
              <Th label="Distance" col="distance" />
              <Th label="Pace" col="pace" />
              <Th label="HR" col="hr" />
              <th className="pb-3 text-zinc-500">FIT</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((run) => {
              const pace = paceSecPerKm(run);
              const hasFit = fitRunIds.includes(run.id);
              const workout = workoutByRunId.get(run.id);
              return (
                <tr
                  key={run.id}
                  className="border-b border-white/5 text-zinc-300 hover:bg-white/[0.03]"
                >
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {new Date(run.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/runs/${run.id}`}
                      className="font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      {run.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    {workout ? (
                      <WorkoutTypeBadge
                        type={workout.type}
                        confidence={workout.confidence}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {formatDistanceKm(run.distanceM)}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {pace ? formatPace(pace) : "—"}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {run.avgHr ?? "—"}
                  </td>
                  <td className="py-3">
                    {hasFit ? (
                      <span className="text-emerald-500" title="FIT data loaded">
                        ●
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
