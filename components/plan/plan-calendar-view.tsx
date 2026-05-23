"use client";

import { useState } from "react";
import type { CalendarWorkout, TrainingCalendarWeek } from "@/lib/training-calendar";
import { cn } from "@/lib/utils";
import { Check, MoreHorizontal, X } from "lucide-react";

const intensityStyles: Record<string, string> = {
  easy: "border-teal-500/25 bg-teal-500/[0.06]",
  moderate: "border-amber-500/25 bg-amber-500/[0.06]",
  hard: "border-orange-500/30 bg-orange-500/[0.08]",
  recovery: "border-zinc-500/20 bg-zinc-500/[0.05]",
  rest: "border-white/[0.04] bg-white/[0.02]",
};

const statusLabel: Record<string, string> = {
  planned: "",
  completed: "Done",
  skipped: "Skipped",
  modified: "Edited",
};

type PatchWorkoutFn = (
  id: string,
  patch: Partial<
    Pick<CalendarWorkout, "title" | "distanceKm" | "durationMin" | "status">
  >
) => void;

export function PlanCalendarView({
  week,
  editable,
  onPatchWorkout,
  onDeleteWorkout,
}: {
  week: TrainingCalendarWeek;
  editable?: boolean;
  onPatchWorkout?: PatchWorkoutFn;
  onDeleteWorkout?: (id: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="plan-calendar">
      <div className="hidden gap-2 lg:grid lg:grid-cols-7">
        {week.workouts.map((w) => (
          <DayColumn
            key={w.id}
            workout={w}
            editable={editable}
            editing={editId === w.id}
            onEdit={() => setEditId(w.id)}
            onClose={() => setEditId(null)}
            onPatch={onPatchWorkout}
            onDelete={onDeleteWorkout}
          />
        ))}
      </div>
      <div className="space-y-2 lg:hidden">
        {week.workouts.map((w) => (
          <DayCard
            key={w.id}
            workout={w}
            editable={editable}
            editing={editId === w.id}
            onEdit={() => setEditId(w.id)}
            onClose={() => setEditId(null)}
            onPatch={onPatchWorkout}
            onDelete={onDeleteWorkout}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  workout: w,
  editable,
  editing,
  onEdit,
  onClose,
  onPatch,
  onDelete,
}: {
  workout: CalendarWorkout;
  editable?: boolean;
  editing?: boolean;
  onEdit: () => void;
  onClose: () => void;
  onPatch?: PatchWorkoutFn;
  onDelete?: (id: string) => void;
}) {
  const isRest = w.modality === "rest";
  return (
    <div
      className={cn(
        "flex min-h-[168px] flex-col rounded-lg border px-2 py-2",
        intensityStyles[w.intensity] ?? intensityStyles.easy
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <span className="text-[10px] font-medium text-zinc-500">{w.day}</span>
        {editable && !isRest ? (
          <button
            type="button"
            className="text-zinc-600 hover:text-zinc-400"
            onClick={onEdit}
            aria-label="Edit workout"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      <WorkoutBody w={w} />
      {w.status !== "planned" ? (
        <span className="mt-auto pt-1 text-[9px] uppercase tracking-wide text-zinc-600">
          {statusLabel[w.status]}
        </span>
      ) : null}
      {editing && editable ? (
        <EditPopover
          w={w}
          onClose={onClose}
          onPatch={onPatch}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}

function DayCard({
  workout: w,
  editable,
  editing,
  onEdit,
  onClose,
  onPatch,
  onDelete,
}: {
  workout: CalendarWorkout;
  editable?: boolean;
  editing?: boolean;
  onEdit: () => void;
  onClose: () => void;
  onPatch?: PatchWorkoutFn;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        intensityStyles[w.intensity] ?? intensityStyles.easy
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-500">
          {w.day} · {w.date.slice(5)}
        </span>
        {editable && w.modality !== "rest" ? (
          <button
            type="button"
            className="text-[10px] text-zinc-600"
            onClick={onEdit}
          >
            Edit
          </button>
        ) : null}
      </div>
      <WorkoutBody w={w} className="mt-1" />
      {editing && editable ? (
        <EditPopover
          w={w}
          onClose={onClose}
          onPatch={onPatch}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}

function WorkoutBody({
  w,
  className,
}: {
  w: CalendarWorkout;
  className?: string;
}) {
  const isRest = w.modality === "rest";
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <p
        className={cn(
          "text-[12px] font-medium leading-snug",
          isRest ? "text-zinc-600" : "text-zinc-200"
        )}
      >
        {w.title}
      </p>
      {!isRest ? (
        <>
          <p className="mt-0.5 text-[10px] capitalize text-zinc-600">
            {w.modality} · {w.type}
          </p>
          <p className="text-[10px] text-zinc-600">
            {w.distanceKm != null ? `${w.distanceKm} km` : null}
            {w.distanceKm != null && w.durationMin != null ? " · " : null}
            {w.durationMin != null ? `${w.durationMin} min` : null}
          </p>
          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-500">
            {w.purpose}
          </p>
          {w.constraintsApplied && w.constraintsApplied.length > 0 ? (
            <span className="mt-1 inline-block rounded bg-white/[0.04] px-1 py-0.5 text-[9px] text-zinc-600">
              constrained
            </span>
          ) : null}
        </>
      ) : (
        <p className="mt-0.5 text-[10px] text-zinc-700">Recovery</p>
      )}
    </div>
  );
}

function EditPopover({
  w,
  onClose,
  onPatch,
  onDelete,
}: {
  w: CalendarWorkout;
  onClose: () => void;
  onPatch?: PatchWorkoutFn;
  onDelete?: (id: string) => void;
}) {
  const [title, setTitle] = useState(w.title);
  const [distanceKm, setDistanceKm] = useState(
    w.distanceKm != null ? String(w.distanceKm) : ""
  );

  return (
    <div className="mt-2 space-y-2 border-t border-white/[0.06] pt-2">
      <input
        className="w-full rounded bg-black/30 px-2 py-1 text-[11px] text-zinc-200"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="w-full rounded bg-black/30 px-2 py-1 text-[11px] text-zinc-200"
        placeholder="Distance km"
        value={distanceKm}
        onChange={(e) => setDistanceKm(e.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] bg-teal-500/15 text-teal-300"
          onClick={() => {
            onPatch?.(w.id, { status: "completed" });
            onClose();
          }}
        >
          <Check className="h-3 w-3" /> Done
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] bg-zinc-500/15 text-zinc-400"
          onClick={() => {
            onPatch?.(w.id, { status: "skipped" });
            onClose();
          }}
        >
          <X className="h-3 w-3" /> Skip
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="text-[10px] text-teal-400/90"
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
        </button>
        {onDelete ? (
          <button
            type="button"
            className="text-[10px] text-red-400/70"
            onClick={() => {
              onDelete(w.id);
              onClose();
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
