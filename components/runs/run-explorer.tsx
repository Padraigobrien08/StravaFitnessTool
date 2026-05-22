"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { WorkoutTypeBadge } from "@/components/workout/workout-type-badge";
import type { RunExplorerRow, RunMarker } from "@/lib/runs/viewModels";
import { semanticSearchTokens } from "@/lib/runs/formatWorkoutName";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import type { WorkoutType } from "@/lib/analytics/workoutType";
import { cn } from "@/lib/utils";
import { Search, Trophy, Zap, Mountain, TrendingUp } from "lucide-react";

type SortKey = "date" | "distance" | "pace" | "type" | "load";
type SignificanceFilter = "all" | "pr" | "long" | "key" | "high_load";

const ALL_TYPES = "all" as const;

const markerConfig: Record<
  RunMarker,
  { label: string; icon: typeof Trophy; className: string }
> = {
  pr: { label: "PR", icon: Trophy, className: "text-teal-400" },
  long: { label: "Long", icon: Mountain, className: "text-blue-400/90" },
  key: { label: "Key", icon: Zap, className: "text-amber-400/90" },
  high_load: { label: "Load", icon: TrendingUp, className: "text-amber-300/80" },
  efficient: { label: "Eff", icon: TrendingUp, className: "text-teal-400/70" },
};

export function RunExplorer({ rows }: { rows: RunExplorerRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<WorkoutType | typeof ALL_TYPES>(
    ALL_TYPES
  );
  const [significance, setSignificance] = useState<SignificanceFilter>("all");
  const [effortFilter, setEffortFilter] = useState<"all" | "easy" | "hard">(
    "all"
  );

  const filtered = useMemo(() => {
    const sem = semanticSearchTokens(search);
    let list = [...rows];

    if (sem.text) {
      list = list.filter((r) => {
        const matchText =
          r.rawName.toLowerCase().includes(sem.text) ||
          r.formattedTitle.primary.toLowerCase().includes(sem.text) ||
          r.purpose.toLowerCase().includes(sem.text) ||
          r.dateDisplay.toLowerCase().includes(sem.text) ||
          WORKOUT_TYPE_LABELS[r.workout.type].toLowerCase().includes(sem.text);
        const matchType =
          sem.types.length === 0 || sem.types.includes(r.workout.type);
        const matchMarker =
          sem.markers.length === 0 ||
          sem.markers.some((m) =>
            m === "pr"
              ? r.markers.includes("pr")
              : m === "long"
                ? r.markers.includes("long")
                : false
          );
        return matchText || matchType || matchMarker;
      });
    }

    if (typeFilter !== ALL_TYPES) {
      list = list.filter((r) => r.workout.type === typeFilter);
    }

    if (significance !== "all") {
      list = list.filter((r) => r.markers.includes(significance));
    }

    if (effortFilter === "easy") {
      list = list.filter((r) =>
        ["easy", "recovery", "long"].includes(r.workout.type)
      );
    } else if (effortFilter === "hard") {
      list = list.filter((r) =>
        ["tempo", "interval", "race"].includes(r.workout.type)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "distance":
          cmp =
            parseFloat(a.distanceDisplay) - parseFloat(b.distanceDisplay);
          break;
        case "pace":
          cmp = a.paceDisplay.localeCompare(b.paceDisplay);
          break;
        case "type":
          cmp = a.workout.type.localeCompare(b.workout.type);
          break;
        case "load":
          cmp =
            (parseFloat(a.loadDisplay ?? "0") || 0) -
            (parseFloat(b.loadDisplay ?? "0") || 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [rows, search, sortKey, sortAsc, typeFilter, significance, effortFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const Th = ({ label, col }: { label: string; col: SortKey }) => (
    <th className="pb-2 pr-3">
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
      >
        {label}
        {sortKey === col ? (sortAsc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <PanelChrome title="Activity explorer" href="/records">
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Search tempo, interval, long run, PR…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-teal-500/40 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as WorkoutType | typeof ALL_TYPES)
          }
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-zinc-300"
        >
          <option value={ALL_TYPES}>All types</option>
          {(Object.keys(WORKOUT_TYPE_LABELS) as WorkoutType[]).map((t) => (
            <option key={t} value={t}>
              {WORKOUT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={significance}
          onChange={(e) =>
            setSignificance(e.target.value as SignificanceFilter)
          }
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-zinc-300"
        >
          <option value="all">All significance</option>
          <option value="pr">PR runs</option>
          <option value="long">Long runs</option>
          <option value="key">Key sessions</option>
          <option value="high_load">High load</option>
        </select>
        <select
          value={effortFilter}
          onChange={(e) =>
            setEffortFilter(e.target.value as "all" | "easy" | "hard")
          }
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-zinc-300"
        >
          <option value="all">All effort</option>
          <option value="easy">Easy / aerobic</option>
          <option value="hard">Quality / hard</option>
        </select>
      </div>

      <p className="mb-3 text-xs text-zinc-600">
        {filtered.length} of {rows.length} sessions
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/[0.05] bg-white/[0.01]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="w-8 px-3 py-2.5" />
              <Th label="Date" col="date" />
              <th className="pb-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Session
              </th>
              <Th label="Type" col="type" />
              <th className="pb-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Purpose
              </th>
              <Th label="Dist" col="distance" />
              <Th label="Pace" col="pace" />
              <th className="pb-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                HR
              </th>
              <Th label="Load" col="load" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.runId}
                className={cn(
                  "border-b border-white/[0.03] transition-colors hover:bg-white/[0.04]",
                  row.isKeyRow && "bg-teal-500/[0.03]"
                )}
              >
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    {row.markers.slice(0, 2).map((m) => {
                      const cfg = markerConfig[m];
                      const Icon = cfg.icon;
                      return (
                        <span
                          key={m}
                          title={cfg.label}
                          className={cfg.className}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 pr-3 align-top text-xs text-zinc-500">
                  {row.dateDisplay}
                </td>
                <td className="min-w-[200px] max-w-md py-3 pr-3 align-top">
                  <Link
                    href={`/runs/${row.runId}`}
                    className="font-medium text-teal-300/95 hover:text-teal-200"
                  >
                    {row.formattedTitle.isStructured ? (
                      <span className="block">
                        {row.formattedTitle.segments.length > 0 ? (
                          <span className="space-y-0.5">
                            {row.formattedTitle.segments.map((seg, i) => (
                              <span
                                key={i}
                                className="block text-xs leading-snug"
                              >
                                <span className="text-zinc-500">
                                  {seg.label}
                                </span>{" "}
                                <span className="text-zinc-300">
                                  {seg.detail}
                                </span>
                              </span>
                            ))}
                          </span>
                        ) : (
                          row.formattedTitle.primary
                        )}
                      </span>
                    ) : (
                      <span className="line-clamp-2 text-sm">
                        {row.formattedTitle.primary}
                      </span>
                    )}
                  </Link>
                  {row.hasFit ? (
                    <span className="mt-1 inline-block text-[10px] text-teal-500/60">
                      FIT
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pr-3 align-top">
                  <WorkoutTypeBadge
                    type={row.workout.type}
                    confidence={row.workout.confidence}
                  />
                </td>
                <td className="max-w-[140px] py-3 pr-3 align-top">
                  <p className="text-xs text-zinc-400">{row.purpose}</p>
                  <p className="text-[10px] text-zinc-600">{row.impact}</p>
                </td>
                <td className="py-3 pr-3 align-top tabular-nums text-xs text-zinc-300">
                  {row.distanceDisplay}
                </td>
                <td className="py-3 pr-3 align-top tabular-nums text-xs text-zinc-300">
                  {row.paceDisplay}
                </td>
                <td className="py-3 pr-3 align-top tabular-nums text-xs text-zinc-500">
                  {row.hrDisplay}
                </td>
                <td className="py-3 pr-3 align-top tabular-nums text-xs text-zinc-500">
                  {row.loadDisplay ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelChrome>
  );
}
