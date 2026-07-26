"use client";

import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import type {
  CalendarIntensity,
  CalendarWorkout,
  TrainingCalendarWeek,
} from "@/lib/training-calendar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, GripVertical, MoreHorizontal, X } from "lucide-react";
import { ZONE_COLOR, ZoneLegend } from "@/components/console/console-kit";
import { PlanMobileWeekSwiper } from "./plan-mobile-week-swiper";

/** Zone-tinted card surface — mirrors the effort scale used across the console. */
function zoneCardStyle(intensity: CalendarIntensity): CSSProperties {
  if (intensity === "rest") {
    return {
      borderColor: "var(--border-subtle)",
      background: "color-mix(in srgb, var(--surface) 30%, transparent)",
    };
  }
  const c = ZONE_COLOR[intensity];
  return {
    borderColor: `color-mix(in srgb, ${c} 34%, transparent)`,
    background: `color-mix(in srgb, ${c} 8%, transparent)`,
  };
}

type PatchFn = (
  id: string,
  patch: Partial<Pick<CalendarWorkout, "title" | "distanceKm" | "durationMin" | "status">>,
) => void;

type BoardVariant = "full" | "compact";

const variantStyles: Record<
  BoardVariant,
  {
    columnMinH: string;
    restMinH: string;
    titleClass: string;
    gridClass: string;
    showWhy: boolean;
    mobileClass: string;
  }
> = {
  full: {
    columnMinH: "min-h-[132px]",
    restMinH: "min-h-[88px]",
    titleClass: "text-[12px]",
    gridClass: "hidden grid-cols-7 gap-1.5 lg:grid",
    showWhy: true,
    mobileClass: "lg:hidden",
  },
  compact: {
    columnMinH: "min-h-[96px]",
    restMinH: "min-h-[64px]",
    titleClass: "text-[11px]",
    gridClass: "hidden grid-cols-7 gap-1 sm:grid",
    showWhy: false,
    mobileClass: "sm:hidden",
  },
};

export function PlanWeekBoard({
  week,
  variant = "full",
  editable,
  draggable,
  highlightWorkoutIds = [],
  onPatchWorkout,
  onDeleteWorkout,
  onSwapWorkouts,
  onSwipePastStart,
  onSwipePastEnd,
  mobileSwipe = true,
}: {
  week: TrainingCalendarWeek;
  variant?: BoardVariant;
  editable?: boolean;
  draggable?: boolean;
  highlightWorkoutIds?: string[];
  onPatchWorkout?: PatchFn;
  onDeleteWorkout?: (id: string) => void;
  onSwapWorkouts?: (fromId: string, toId: string) => void;
  onSwipePastStart?: () => void;
  onSwipePastEnd?: () => void;
  mobileSwipe?: boolean;
}) {
  const styles = variantStyles[variant];
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const canDrag = Boolean(draggable && editable && onSwapWorkouts);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (dragId && dragId !== targetId) {
        onSwapWorkouts?.(dragId, targetId);
      }
      setDragId(null);
      setDropTargetId(null);
    },
    [dragId, onSwapWorkouts],
  );

  const sharedDayProps = {
    editable,
    canDrag,
    showWhy: styles.showWhy,
    titleClass: styles.titleClass,
    columnMinH: styles.columnMinH,
    restMinH: styles.restMinH,
    dragId,
    dropTargetId,
    onCloseEdit: () => setEditId(null),
    onPatch: onPatchWorkout,
    onDelete: onDeleteWorkout,
    onDragStart: (id: string) => setDragId(id),
    onDragEnd: () => {
      setDragId(null);
      setDropTargetId(null);
    },
    onDragOver: (id: string) => setDropTargetId(id),
    onDragLeave: () => setDropTargetId(null),
    onDrop: handleDrop,
  };

  return (
    <div className="plan-week-board">
      <div className={styles.gridClass}>
        {week.workouts.map((w) => (
          <DayBoardColumn
            key={w.id}
            workout={w}
            highlighted={highlightWorkoutIds.includes(w.id)}
            editing={editId === w.id}
            expanded={expandedId === w.id}
            onToggleExpand={() => setExpandedId((id) => (id === w.id ? null : w.id))}
            onEdit={() => setEditId(w.id)}
            {...sharedDayProps}
          />
        ))}
      </div>

      {mobileSwipe ? (
        <PlanMobileWeekSwiper
          workouts={week.workouts}
          onSwipePastStart={onSwipePastStart}
          onSwipePastEnd={onSwipePastEnd}
          className={styles.mobileClass}
        >
          {({ workout, isToday }) => (
            <DayBoardCard
              workout={workout}
              editable={editable}
              highlighted={highlightWorkoutIds.includes(workout.id)}
              isToday={isToday}
              editing={editId === workout.id}
              expanded={expandedId === workout.id}
              showWhy={styles.showWhy}
              titleClass={styles.titleClass}
              onEdit={() => setEditId(workout.id)}
              onToggleExpand={() => setExpandedId((id) => (id === workout.id ? null : workout.id))}
              onCloseEdit={() => setEditId(null)}
              onPatch={onPatchWorkout}
              onDelete={onDeleteWorkout}
            />
          )}
        </PlanMobileWeekSwiper>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ZoneLegend />
        {canDrag ? (
          <p className="hidden text-[10px] text-zinc-600 lg:block">
            Drag a session onto another day to reschedule it.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function isRaceDay(w: CalendarWorkout): boolean {
  return /\brace\b/i.test(`${w.type} ${w.title}`);
}

function DayBoardColumn({
  workout: w,
  editable,
  canDrag,
  highlighted,
  editing,
  expanded,
  showWhy,
  titleClass,
  columnMinH,
  restMinH,
  dragId,
  dropTargetId,
  onToggleExpand,
  onEdit,
  onCloseEdit,
  onPatch,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  workout: CalendarWorkout;
  editable?: boolean;
  canDrag?: boolean;
  highlighted?: boolean;
  editing?: boolean;
  expanded?: boolean;
  showWhy?: boolean;
  titleClass?: string;
  columnMinH?: string;
  restMinH?: string;
  dragId?: string | null;
  dropTargetId?: string | null;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCloseEdit: () => void;
  onPatch?: PatchFn;
  onDelete?: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onDragOver?: (id: string) => void;
  onDragLeave?: () => void;
  onDrop?: (id: string) => void;
}) {
  const isRest = w.modality === "rest";
  const race = isRaceDay(w);
  const isDragging = dragId === w.id;
  const isDropTarget = dropTargetId === w.id && dragId !== w.id;

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", w.id);
        onDragStart?.(w.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(e) => {
        if (!canDrag || !dragId) return;
        e.preventDefault();
        onDragOver?.(w.id);
      }}
      onDragLeave={() => onDragLeave?.()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(w.id);
      }}
      style={zoneCardStyle(w.intensity)}
      className={cn(
        "group flex flex-col rounded-lg border px-2 py-2 transition-all",
        columnMinH,
        isRest && "opacity-75",
        race && "ring-1 ring-accent/45 shadow-[0_0_20px_-8px_var(--home-signal-line)]",
        highlighted && "ring-2 ring-amber-400/50",
        isRest && restMinH,
        isDragging && "opacity-50",
        isDropTarget && "scale-[1.02] ring-2 ring-accent/60",
        canDrag && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-0.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: ZONE_COLOR[w.intensity] }}
          />
          {w.day}
        </span>
        <div className="flex items-center gap-0.5">
          {canDrag ? (
            <GripVertical className="h-3 w-3 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
          ) : null}
          {w.status !== "planned" ? <StatusBadge status={w.status} /> : null}
          {editable && !isRest ? (
            <button
              type="button"
              className="text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
              onClick={onEdit}
              aria-label="Edit"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      <WorkoutBoardBody w={w} titleClass={titleClass} />

      {showWhy && !isRest && (w.reasoning || w.purpose) ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-1 flex items-center gap-0.5 text-left text-[9px] text-zinc-600 hover:text-zinc-400"
        >
          <ChevronDown
            className={cn("h-2.5 w-2.5 transition-transform", expanded && "rotate-180")}
          />
          {expanded ? "Less" : "Why"}
        </button>
      ) : null}

      {showWhy && expanded && !isRest ? (
        <p className="mt-1 text-[9px] leading-snug text-zinc-500">{w.reasoning ?? w.purpose}</p>
      ) : null}

      {editing && editable ? (
        <EditPanel w={w} onClose={onCloseEdit} onPatch={onPatch} onDelete={onDelete} />
      ) : null}
    </div>
  );
}

function DayBoardCard({
  workout: w,
  editable,
  highlighted,
  isToday,
  editing,
  expanded,
  showWhy,
  titleClass,
  onToggleExpand,
  onEdit,
  onCloseEdit,
  onPatch,
  onDelete,
}: {
  workout: CalendarWorkout;
  editable?: boolean;
  highlighted?: boolean;
  isToday?: boolean;
  editing?: boolean;
  expanded?: boolean;
  showWhy?: boolean;
  titleClass?: string;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCloseEdit: () => void;
  onPatch?: PatchFn;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      style={zoneCardStyle(w.intensity)}
      className={cn(
        "rounded-lg border px-3 py-2",
        highlighted && "ring-2 ring-amber-400/50",
        isToday && "ring-1 ring-accent/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-zinc-500">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: ZONE_COLOR[w.intensity] }}
          />
          {w.day} · {w.date.slice(5)}
          {isToday ? <span className="ml-1 text-accent">· today</span> : null}
        </span>
        {editable && w.modality !== "rest" ? (
          <button type="button" className="text-[10px] text-zinc-600" onClick={onEdit}>
            Edit
          </button>
        ) : null}
      </div>
      <WorkoutBoardBody w={w} className="mt-1" titleClass={titleClass} />
      {showWhy !== false && w.modality !== "rest" ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-1 flex items-center gap-0.5 text-[10px] text-zinc-600"
        >
          <ChevronDown
            className={cn("h-2.5 w-2.5 transition-transform", expanded && "rotate-180")}
          />
          {expanded ? "Hide detail" : "Session detail"}
        </button>
      ) : null}
      {expanded && w.reasoning ? (
        <p className="mt-1 text-[10px] text-zinc-500">{w.reasoning}</p>
      ) : null}
      {editing && editable ? (
        <EditPanel w={w} onClose={onCloseEdit} onPatch={onPatch} onDelete={onDelete} />
      ) : null}
    </div>
  );
}

function WorkoutBoardBody({
  w,
  className,
  titleClass = "text-[12px]",
}: {
  w: CalendarWorkout;
  className?: string;
  titleClass?: string;
}) {
  const isRest = w.modality === "rest";
  const race = isRaceDay(w);
  const emphasis = fatigueEmphasis(w);

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <p
        className={cn(
          "font-semibold leading-tight",
          titleClass,
          isRest ? "text-zinc-600" : race ? "text-accent" : "text-zinc-100",
        )}
      >
        {w.title}
      </p>
      {!isRest ? (
        <>
          <p className="mt-0.5 font-mono text-[10px] tabular-nums text-zinc-500">
            {w.distanceKm != null ? `${w.distanceKm} km` : null}
            {w.distanceKm != null && w.durationMin != null ? " · " : null}
            {w.durationMin != null ? `${w.durationMin} min` : null}
          </p>
          <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-zinc-600">{w.purpose}</p>
          {emphasis ? <p className="mt-1 text-[9px] text-accent/80">{emphasis}</p> : null}
        </>
      ) : (
        <p className="mt-0.5 text-[9px] text-zinc-700">Recovery</p>
      )}
    </div>
  );
}

function fatigueEmphasis(w: CalendarWorkout): string | null {
  if (w.intensity === "easy" || w.intensity === "recovery") {
    return "Low fatigue cost · rhythm support";
  }
  if (w.intensity === "hard") {
    return "High execution emphasis · monitor freshness";
  }
  if (/stride|neuromuscular/i.test(w.title + w.purpose)) {
    return "Neuromuscular sharpening";
  }
  return null;
}

function StatusBadge({ status }: { status: CalendarWorkout["status"] }) {
  const label =
    status === "completed"
      ? "Done"
      : status === "skipped"
        ? "Skip"
        : status === "modified"
          ? "Edit"
          : "";
  return (
    <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[8px] uppercase text-zinc-500">
      {label}
    </span>
  );
}

function EditPanel({
  w,
  onClose,
  onPatch,
  onDelete,
}: {
  w: CalendarWorkout;
  onClose: () => void;
  onPatch?: PatchFn;
  onDelete?: (id: string) => void;
}) {
  const [title, setTitle] = useState(w.title);
  const [distanceKm, setDistanceKm] = useState(w.distanceKm != null ? String(w.distanceKm) : "");

  return (
    <div className="mt-2 space-y-2 border-t border-[var(--border-subtle)] pt-2">
      <Input
        className="h-7 rounded bg-black/30 px-2 py-1 text-[11px] text-zinc-200"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        className="h-7 rounded bg-black/30 px-2 py-1 text-[11px] text-zinc-200"
        placeholder="km"
        value={distanceKm}
        onChange={(e) => setDistanceKm(e.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto gap-0.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent/20 hover:text-accent"
          onClick={() => {
            onPatch?.(w.id, { status: "completed" });
            onClose();
          }}
        >
          <Check className="h-3 w-3" /> Done
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto gap-0.5 rounded px-1.5 py-0.5 text-[10px] bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/20 hover:text-zinc-400"
          onClick={() => {
            onPatch?.(w.id, { status: "skipped" });
            onClose();
          }}
        >
          <X className="h-3 w-3" /> Skip
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-[10px] text-accent hover:text-accent/80"
          onClick={() => {
            onPatch?.(w.id, {
              title,
              distanceKm: distanceKm ? Number(distanceKm) : undefined,
              status: "modified",
            });
            onClose();
          }}
        >
          Save
        </Button>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-[10px] text-red-400/80 hover:text-red-400"
            onClick={() => {
              onDelete(w.id);
              onClose();
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
