"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RunActivity } from "@/lib/strava/types";
import type { WorkoutClassification, WorkoutType } from "@/lib/analytics/workoutType";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import { WorkoutTypeBadge } from "@/components/workout/workout-type-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const SortHead = ({
    label,
    col,
  }: {
    label: string;
    col: SortKey;
  }) => (
    <TableHead className="pr-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto px-0 text-zinc-500 hover:text-zinc-300"
        onClick={() => toggleSort(col)}
      >
        {label}
        {sortKey === col ? (sortAsc ? " ↑" : " ↓") : ""}
      </Button>
    </TableHead>
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
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="search"
            placeholder="Search runs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search runs"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) =>
            setTypeFilter(value as WorkoutType | typeof ALL_TYPES)
          }
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by workout type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t === ALL_TYPES ? "All types" : WORKOUT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-zinc-600">
        {filtered.length} of {runs.length} runs
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <SortHead label="Date" col="date" />
              <TableHead className="pr-4 text-zinc-500">Run</TableHead>
              <SortHead label="Type" col="type" />
              <SortHead label="Distance" col="distance" />
              <SortHead label="Pace" col="pace" />
              <SortHead label="HR" col="hr" />
              <TableHead className="text-zinc-500">FIT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((run) => {
              const pace = paceSecPerKm(run);
              const hasFit = fitRunIds.includes(run.id);
              const workout = workoutByRunId.get(run.id);
              return (
                <TableRow
                  key={run.id}
                  className="border-white/5 text-zinc-300 hover:bg-white/[0.03]"
                >
                  <TableCell className="whitespace-nowrap pr-4">
                    {new Date(run.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="pr-4">
                    <Link
                      href={`/runs/${run.id}`}
                      className="font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      {run.name}
                    </Link>
                  </TableCell>
                  <TableCell className="pr-4">
                    {workout ? (
                      <WorkoutTypeBadge
                        type={workout.type}
                        confidence={workout.confidence}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums pr-4">
                    {formatDistanceKm(run.distanceM)}
                  </TableCell>
                  <TableCell className="tabular-nums pr-4">
                    {pace ? formatPace(pace) : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums pr-4">
                    {run.avgHr ?? "—"}
                  </TableCell>
                  <TableCell>
                    {hasFit ? (
                      <span className="text-emerald-500" title="FIT data loaded">
                        ●
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
