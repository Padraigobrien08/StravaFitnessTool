"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardInsights } from "@/lib/analytics";
import type { RunActivity } from "@/lib/strava/types";
import type { FitRunDetail } from "@/lib/strava/fitTypes";
import { evaluateSessionExecution } from "@/lib/session-intelligence";
import type { RunExplorerRow } from "@/lib/runs/viewModels";
import {
  filterExplorerRows,
  groupExplorerRows,
  paginateRows,
  sortExplorerRows,
  type ExplorerSortKey,
  type QuickFilter,
} from "@/lib/runs/explorerUtils";
import { semanticSearchTokens } from "@/lib/runs/formatWorkoutName";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import type { WorkoutType } from "@/lib/analytics/workoutType";
import { coachUrl } from "@/lib/coach/domainLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Trophy,
  Zap,
  Mountain,
  TrendingUp,
} from "lucide-react";
import type { RunMarker } from "@/lib/runs/viewModels";
import type { SessionIntelligence } from "@/lib/session-intelligence";

const PAGE_SIZES = [25, 50, 100] as const;
const ALL_TYPES = "all" as const;

function Th({
  label,
  col,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  col: ExplorerSortKey;
  sortKey: ExplorerSortKey;
  sortAsc: boolean;
  onSort: (col: ExplorerSortKey) => void;
}) {
  return (
    <th className="pb-1 pr-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSort(col)}
        className="h-auto p-0 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 hover:bg-transparent hover:text-zinc-400"
      >
        {label}
        {sortKey === col ? (sortAsc ? " ↑" : " ↓") : ""}
      </Button>
    </th>
  );
}

const markerConfig: Record<RunMarker, { label: string; icon: typeof Trophy; className: string }> = {
  pr: { label: "PR", icon: Trophy, className: "text-accent" },
  long: { label: "Long", icon: Mountain, className: "text-blue-400/90" },
  key: { label: "Key", icon: Zap, className: "text-amber-400/90" },
  high_load: { label: "Load", icon: TrendingUp, className: "text-amber-300/80" },
  efficient: { label: "Eff", icon: TrendingUp, className: "text-accent/70" },
};

export function RunExplorer({
  rows,
  runs,
  analytics,
  getFitForRun,
}: {
  rows: RunExplorerRow[];
  runs: RunActivity[];
  analytics: DashboardInsights;
  getFitForRun: (id: string) => FitRunDetail | undefined;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<ExplorerSortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<WorkoutType | typeof ALL_TYPES>(ALL_TYPES);
  // No UI exposes these two yet, so they stay at "all" rather than pretending to
  // be state the user can change.
  const significance = "all";
  const effortFilter = "all" as const;
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [groupByMonth, setGroupByMonth] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tableTopRef = useRef<HTMLDivElement>(null);

  const runsById = useMemo(() => new Map(runs.map((r) => [r.id, r])), [runs]);

  const filtered = useMemo(() => {
    const sem = semanticSearchTokens(search);
    const q = sem.text || search.trim().toLowerCase();
    let list = filterExplorerRows(rows, {
      search: q,
      typeFilter,
      quickFilter,
      significanceFilter: significance,
      effortFilter,
    });
    if (sem.types.length > 0) {
      list = list.filter((r) => sem.types.includes(r.workout.type));
    }
    return sortExplorerRows(list, sortKey, sortAsc);
  }, [rows, search, sortKey, sortAsc, typeFilter, significance, effortFilter, quickFilter]);

  const { pageRows, totalPages, total } = useMemo(
    () => paginateRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const pageGroups = useMemo(() => {
    if (!groupByMonth) {
      return [{ key: "page", label: "Sessions", rows: pageRows }];
    }
    return groupExplorerRows(pageRows, "month");
  }, [groupByMonth, pageRows]);

  // Only the expanded row needs session intelligence; compute it in a memo
  // (keyed on the expanded id) rather than caching in a ref read during render.
  const expandedIntel = useMemo<SessionIntelligence | null>(() => {
    if (!expandedId) return null;
    const run = runsById.get(expandedId);
    const row = rows.find((r) => r.runId === expandedId);
    if (!run || !row) return null;
    return evaluateSessionExecution(run, getFitForRun(expandedId) ?? null, row.workout, {
      analytics,
      historicalRuns: runs,
    });
  }, [expandedId, runsById, rows, getFitForRun, analytics, runs]);

  // What is actually narrowing the list, so an empty result can say so instead
  // of leaving the athlete at a dead end.
  const activeFilters: string[] = [];
  if (search.trim()) activeFilters.push(`search “${search.trim()}”`);
  if (typeFilter !== ALL_TYPES) activeFilters.push(`type ${typeFilter}`);
  if (quickFilter !== "all") activeFilters.push(`quick filter ${quickFilter.replace(/_/g, " ")}`);
  const hasFilters = activeFilters.length > 0;

  function clearFilters() {
    setSearch("");
    setTypeFilter(ALL_TYPES);
    setQuickFilter("all");
    setPage(0);
  }

  function toggleSort(key: ExplorerSortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(0);
  }

  function goPage(next: number) {
    setPage(next);
    setExpandedId(null);
    tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      ref={tableTopRef}
      className="rounded-xl bg-[var(--surface-elevated)] shadow-[var(--surface-shadow)] ring-1 ring-[var(--border-subtle)]"
    >
      <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Activity explorer
          </h2>
          <span className="font-mono text-[10px] tabular-nums text-zinc-600">
            {total} sessions · page {page + 1}/{totalPages}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <Input
              type="search"
              placeholder="Search sessions…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="border-[var(--border-subtle)] bg-white/[0.03] py-1.5 pl-7 pr-2 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus-visible:border-accent/30"
              aria-label="Search sessions"
            />
          </div>
          <FilterSelect
            value={quickFilter}
            onChange={(v) => {
              setQuickFilter(v as QuickFilter);
              setPage(0);
            }}
            options={[
              ["all", "All"],
              ["threshold", "Threshold"],
              ["long", "Long run"],
              ["recovery", "Recovery"],
              ["best_execution", "Best execution"],
              ["high_fatigue", "High fatigue"],
              ["race_specific", "Race-specific"],
            ]}
          />
          <FilterSelect
            value={typeFilter}
            onChange={(v) => {
              setTypeFilter(v as WorkoutType | typeof ALL_TYPES);
              setPage(0);
            }}
            options={[
              [ALL_TYPES, "All types"],
              ...(Object.keys(WORKOUT_TYPE_LABELS) as WorkoutType[]).map((t): [string, string] => [
                t,
                WORKOUT_TYPE_LABELS[t],
              ]),
            ]}
          />
          <FilterSelect
            value={String(pageSize)}
            onChange={(v) => {
              setPageSize(Number(v) as (typeof PAGE_SIZES)[number]);
              setPage(0);
            }}
            options={PAGE_SIZES.map((n) => [String(n), `${n} / page`])}
          />
          <Button
            type="button"
            variant={groupByMonth ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "h-auto px-2 py-1.5 text-[10px]",
              groupByMonth
                ? "bg-accent/15 text-accent hover:bg-accent/20"
                : "border-[var(--border-subtle)] bg-white/[0.03] text-zinc-500",
            )}
            onClick={() => setGroupByMonth((v) => !v)}
          >
            Group by month
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-white/[0.05] bg-white/[0.02]">
              <th className="w-6 px-2 py-1.5" />
              <th className="w-5 px-1" />
              <Th label="Date" col="date" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
              <th className="pb-1 pr-2 text-[9px] font-semibold uppercase text-zinc-600">
                Session
              </th>
              <Th
                label="Sig"
                col="significance"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={toggleSort}
              />
              <Th
                label="Exec"
                col="execution"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={toggleSort}
              />
              <th className="pb-1 pr-2 text-[9px] font-semibold uppercase text-zinc-600">Tags</th>
              <Th
                label="Dist"
                col="distance"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={toggleSort}
              />
              <Th label="Pace" col="pace" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
              <th className="pb-1 pr-2 text-[9px] font-semibold uppercase text-zinc-600">HR</th>
            </tr>
          </thead>
          <tbody>
            {pageGroups.map((group) => (
              <Fragment key={group.key}>
                {groupByMonth && group.key !== "page" ? (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={10} className="px-3 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex h-auto items-center gap-1 p-0 text-[11px] font-medium text-zinc-400 hover:bg-transparent hover:text-zinc-300"
                        onClick={() => {
                          setCollapsedGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(group.key)) next.delete(group.key);
                            else next.add(group.key);
                            return next;
                          });
                        }}
                      >
                        <ChevronDown
                          className={cn("h-3 w-3", collapsedGroups.has(group.key) && "-rotate-90")}
                        />
                        {group.label}
                        <span className="text-zinc-600">({group.rows.length})</span>
                      </Button>
                    </td>
                  </tr>
                ) : null}
                {!collapsedGroups.has(group.key)
                  ? group.rows.map((row) => (
                      <ExplorerRow
                        key={row.runId}
                        row={row}
                        expanded={expandedId === row.runId}
                        onToggle={() => setExpandedId(expandedId === row.runId ? null : row.runId)}
                        intel={expandedId === row.runId ? expandedIntel : null}
                      />
                    ))
                  : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {pageRows.length === 0 ? (
        <div className="px-3 py-8 text-center">
          {rows.length === 0 ? (
            <>
              <p className="text-[13px] text-zinc-400">No runs in this history yet.</p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] text-zinc-600">
                Once runs are imported they appear here, searchable by distance, pace, and workout
                type.
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-zinc-400">
                No sessions match {hasFilters ? "these filters" : "this view"}.
              </p>
              {hasFilters ? (
                <p className="mx-auto mt-1 max-w-md text-[12px] text-zinc-600">
                  Filtering {rows.length} runs by {activeFilters.join(" and ")}.
                </p>
              ) : null}
              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 text-[12px]"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page <= 0}
          className="h-auto gap-0.5 px-2 py-1 text-[11px] text-zinc-500 hover:bg-white/[0.04]"
          onClick={() => goPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <span className="font-mono text-[10px] tabular-nums text-zinc-600">
          Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page >= totalPages - 1}
          className="h-auto gap-0.5 px-2 py-1 text-[11px] text-zinc-500 hover:bg-white/[0.04]"
          onClick={() => goPage(page + 1)}
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <Select value={value} onValueChange={(v) => v != null && onChange(v)}>
      <SelectTrigger
        size="sm"
        className="h-auto border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[10px] text-zinc-400"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ExplorerRow({
  row,
  expanded,
  onToggle,
  intel,
}: {
  row: RunExplorerRow;
  expanded: boolean;
  onToggle: () => void;
  intel: SessionIntelligence | null;
}) {
  const isNotable = row.significanceTier === "critical" || row.significanceTier === "meaningful";

  return (
    <>
      <tr
        className={cn(
          "border-b border-white/[0.03] cursor-pointer transition-colors hover:bg-white/[0.03]",
          isNotable && "bg-accent/[0.03]",
        )}
        onClick={onToggle}
      >
        <td className="px-2 py-1.5 align-middle">
          <ChevronDown
            className={cn("h-3 w-3 text-zinc-600 transition-transform", expanded && "rotate-180")}
          />
        </td>
        <td className="px-1 py-1.5 align-middle">
          <div className="flex flex-col gap-0.5">
            {row.markers.slice(0, 2).map((m) => {
              const cfg = markerConfig[m];
              const Icon = cfg.icon;
              return (
                <span key={m} title={cfg.label}>
                  <Icon className={cn("h-3 w-3", cfg.className)} />
                </span>
              );
            })}
          </div>
        </td>
        <td className="whitespace-nowrap py-1.5 pr-2 text-[11px] text-zinc-500">
          {row.dateDisplay.replace(/, \d{4}$/, "")}
        </td>
        <td className="max-w-[200px] py-1.5 pr-2">
          <Link
            href={`/runs/${row.runId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[12px] font-medium text-accent hover:text-[var(--home-signal-strong)] line-clamp-1"
          >
            {row.formattedTitle.primary}
          </Link>
        </td>
        <td className="py-1.5 pr-2 text-[10px] capitalize text-zinc-500">{row.significanceTier}</td>
        <td className="py-1.5 pr-2 text-[10px] text-zinc-400">{row.executionLabel}</td>
        <td className="max-w-[100px] py-1.5 pr-2">
          <div className="flex flex-wrap gap-0.5">
            {row.adaptationTags.slice(0, 2).map((t) => (
              <span key={t} className="rounded bg-white/[0.04] px-1 text-[9px] text-zinc-600">
                {t}
              </span>
            ))}
          </div>
        </td>
        <td className="py-1.5 pr-2 font-mono text-[11px] tabular-nums text-zinc-400">
          {row.distanceDisplay}
        </td>
        <td className="py-1.5 pr-2 font-mono text-[11px] tabular-nums text-zinc-400">
          {row.paceDisplay}
        </td>
        <td className="py-1.5 pr-2 font-mono text-[11px] tabular-nums text-zinc-500">
          {row.hrDisplay}
        </td>
      </tr>
      {expanded && intel ? (
        <tr className="border-b border-white/[0.04] bg-white/[0.02]">
          <td colSpan={10} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-medium text-zinc-600">Session intelligence</p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{intel.narrative}</p>
              </div>
              <div className="space-y-1.5 text-[11px] text-zinc-500">
                <p>
                  <span className="text-zinc-600">Execution: </span>
                  {intel.executionQuality}
                </p>
                <p>
                  <span className="text-zinc-600">Adaptation: </span>
                  {intel.likelyAdaptations.join(", ")}
                </p>
                <p>
                  <span className="text-zinc-600">Fatigue cost: </span>
                  {intel.fatigueCost}
                </p>
                {intel.historicalComparison ? (
                  <p>
                    <span className="text-zinc-600">History: </span>
                    {intel.historicalComparison}
                  </p>
                ) : null}
                {intel.pacingAssessment ? (
                  <p>
                    <span className="text-zinc-600">Pacing: </span>
                    {intel.pacingAssessment}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex gap-3">
              <Link
                href={`/runs/${row.runId}`}
                className="text-[10px] text-accent/80 hover:text-accent"
                onClick={(e) => e.stopPropagation()}
              >
                Full session →
              </Link>
              <Link
                href={coachUrl({
                  q: `Explain my session on ${row.dateDisplay}: ${row.rawName}`,
                })}
                className="text-[10px] text-zinc-600 hover:text-zinc-400"
                onClick={(e) => e.stopPropagation()}
              >
                Ask Coach →
              </Link>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
