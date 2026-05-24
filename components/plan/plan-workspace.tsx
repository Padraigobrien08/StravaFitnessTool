"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { useWeeklyPlan } from "@/hooks/use-weekly-plan";
import { useTrainingCalendar } from "@/hooks/use-training-calendar";
import { useTrainingIntelligence } from "@/hooks/use-training-intelligence";
import { useStrava } from "@/lib/context/strava-context";
import { useGoalStore } from "@/stores/goal-store";
import {
  formatWeekRange,
  weekEndFromStart,
  weeklyPlanToCalendarWeek,
  calendarWeekToWeeklyPlan,
  saveCalendarWeek,
  dateForWeekDay,
  targetPlanWeekStart,
  matchPlannedVsActual,
} from "@/lib/training-calendar";
import type { TrainingCalendarWeek } from "@/lib/training-calendar";
import {
  historyCount,
  revertCalendarWeek,
} from "@/lib/training-calendar/calendarHistory";
import {
  buildWeekTelemetry,
  buildTodayInPlan,
  buildIntegrityItems,
  sessionExplainability,
  goalContextLabel,
  planPhaseLabel,
} from "@/lib/plan/planWorkspaceView";
import { coachUrl } from "@/lib/coach/domainLinks";
import { PlanHeader, type PlanHeaderStatus } from "./plan-header";
import { PlanWeekBoard } from "./plan-week-board";
import { PlanWeekNav } from "./plan-week-nav";
import { PlanWeekTelemetryStrip } from "./plan-week-telemetry";
import { PlanTodayFocus } from "./plan-today-focus";
import { PlanOperationalSidebar } from "./plan-operational-sidebar";
import { PlanSavedStateCard } from "./plan-saved-state";
import { PlanPlanningContext } from "./plan-planning-context";
import { PlanWeekExecution } from "./plan-week-execution";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CalendarPlus, RefreshCw } from "lucide-react";

export function PlanWorkspace() {
  const searchParams = useSearchParams();
  const debugMode =
    searchParams.get("debug") === "true" ||
    (typeof window !== "undefined" &&
      process.env.NODE_ENV === "development" &&
      searchParams.get("debug") !== "false");

  const { analytics } = useTrainingIntelligence();
  const { importData } = useStrava();
  const raceGoal = useGoalStore((s) => s.raceGoal);
  const {
    generate,
    loading,
    error,
    result: preview,
    reset: resetPreview,
    lastPlanningContext,
  } = useWeeklyPlan();
  const [viewWeekStart, setViewWeekStart] = useState(() => targetPlanWeekStart());
  const calendar = useTrainingCalendar(viewWeekStart);
  const [planningContext, setPlanningContext] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    if (calendar.savedWeek?.planningContext) {
      setPlanningContext(calendar.savedWeek.planningContext);
    }
  }, [calendar.savedWeek?.weekStart, calendar.savedWeek?.planningContext]);

  const previewWeek = useMemo(() => {
    if (!preview) return null;
    return weeklyPlanToCalendarWeek(preview.plan, preview);
  }, [preview]);

  const previewAppliesToView =
    previewWeek?.weekStart === viewWeekStart ||
    previewWeek?.weekStart === calendar.targetWeek;

  const showingPreview = Boolean(
    previewAppliesToView &&
      previewWeek &&
      (confirmReplace || !calendar.savedWeek)
  );

  const displayWeek: TrainingCalendarWeek | null = useMemo(
    () => (showingPreview ? previewWeek : calendar.savedWeek),
    [showingPreview, previewWeek, calendar.savedWeek]
  );

  const status: PlanHeaderStatus = useMemo(() => {
    if (!displayWeek && !preview && !calendar.savedWeek) return "empty";
    if (calendar.savedWeek?.workouts.some((w) => w.status !== "planned")) {
      return "modified";
    }
    if (preview && calendar.savedWeek && !confirmReplace) {
      return "saved_with_preview";
    }
    if (preview && !calendar.hasSaved) return "preview";
    if (calendar.savedWeek && !preview) return "saved";
    if (preview) return "preview";
    return "empty";
  }, [displayWeek, preview, calendar.savedWeek, calendar.hasSaved, confirmReplace]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "saved":
        return "Saved · your week";
      case "preview":
        return preview?.source === "fallback"
          ? "Unsaved preview (fallback)"
          : "Unsaved preview";
      case "saved_with_preview":
        return "Saved · new preview ready";
      case "modified":
        return "Saved · edited";
      default:
        return "No plan";
    }
  }, [status, preview?.source]);

  const weekRange = displayWeek
    ? formatWeekRange(displayWeek.weekStart, displayWeek.weekEnd)
    : formatWeekRange(
        calendar.targetWeek,
        weekEndFromStart(calendar.targetWeek)
      );

  const phaseLabel = displayWeek
    ? planPhaseLabel(displayWeek.planType)
    : preview?.plan.planType
      ? planPhaseLabel(preview.plan.planType)
      : "Adaptive week";

  const goalContext = goalContextLabel(raceGoal, analytics);

  const telemetry = displayWeek
    ? buildWeekTelemetry(displayWeek, analytics)
    : null;
  const today = displayWeek ? buildTodayInPlan(displayWeek) : null;
  const integrityItems = displayWeek
    ? buildIntegrityItems(displayWeek, preview)
    : [];
  const explainLines = displayWeek ? sessionExplainability(displayWeek) : [];

  const runs = importData?.runs ?? [];
  const weekExecution = useMemo(() => {
    const week = calendar.savedWeek;
    if (!week || showingPreview) return null;
    return matchPlannedVsActual(week, runs);
  }, [calendar.savedWeek, runs, showingPreview]);

  const shiftViewWeek = useCallback((deltaWeeks: number) => {
    setViewWeekStart((current) =>
      format(addDays(parseISO(current), deltaWeeks * 7), "yyyy-MM-dd")
    );
    setConfirmReplace(false);
    setHighlightIds([]);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (calendar.hasSaved && !confirmReplace) {
      const ok = window.confirm(
        "Generate a new preview? Your saved week stays until you save over it."
      );
      if (!ok) return;
    }
    setSaveError(null);
    await generate({
      planningContext: planningContext.trim() || undefined,
    });
    setConfirmReplace(false);
  }, [calendar.hasSaved, confirmReplace, generate, planningContext]);

  const handleSave = useCallback(() => {
    if (!preview) return;
    setSaveError(null);
    const outcome = calendar.saveFromGenerated(preview, {
      planningContext:
        planningContext.trim() || lastPlanningContext || undefined,
    });
    if (!outcome.ok) {
      const high = outcome.validation.issues.filter((i) => i.severity === "high");
      setSaveError(
        high[0]?.message ??
          "Cannot save — fix critical issues or regenerate."
      );
      return;
    }
    resetPreview();
    setConfirmReplace(false);
    setHistoryTick((n) => n + 1);
  }, [preview, calendar, resetPreview, planningContext, lastPlanningContext]);

  const handleClear = useCallback(() => {
    if (
      !window.confirm("Clear the saved calendar for this week? This cannot be undone.")
    ) {
      return;
    }
    calendar.clearWeek();
    resetPreview();
    setConfirmReplace(false);
    setSaveError(null);
    setHighlightIds([]);
  }, [calendar, resetPreview]);

  const handleRevert = useCallback(() => {
    const previous = revertCalendarWeek(calendar.targetWeek);
    if (!previous) return;
    saveCalendarWeek(previous);
    calendar.refresh();
    setHistoryTick((n) => n + 1);
  }, [calendar]);

  const handleDuplicate = useCallback(() => {
    if (!calendar.savedWeek) return;
    const nextStart = format(
      addDays(parseISO(calendar.savedWeek.weekStart), 7),
      "yyyy-MM-dd"
    );
    const now = new Date().toISOString();
    const duplicated: TrainingCalendarWeek = {
      ...JSON.parse(JSON.stringify(calendar.savedWeek)),
      id: `week-${nextStart}`,
      weekStart: nextStart,
      weekEnd: weekEndFromStart(nextStart),
      revision: 1,
      savedAt: now,
      updatedAt: now,
      workouts: calendar.savedWeek.workouts.map((w) => ({
        ...w,
        id: `w-${nextStart}-${w.day.slice(0, 3).toLowerCase()}`,
        date: dateForWeekDay(nextStart, w.day),
        createdAt: now,
        updatedAt: now,
      })),
    };
    saveCalendarWeek(duplicated);
    alert(`Duplicated to week starting ${nextStart}.`);
  }, [calendar.savedWeek]);

  const coachPlan = calendar.savedWeek
    ? calendarWeekToWeeklyPlan(calendar.savedWeek)
    : preview?.plan;

  const coachHref = coachUrl({
    q: calendar.savedWeek
      ? "Modify my saved week plan — keep changes conservative"
      : "Build my next week plan for Mon/Wed/Fri/Sun only",
  });

  const histCount = calendar.savedWeek
    ? historyCount(calendar.savedWeek.weekStart)
    : 0;

  return (
    <div className="plan-workspace mx-auto max-w-[1400px] space-y-3 pb-10">
      <PlanHeader
        title="Next week plan"
        weekRange={weekRange}
        status={status}
        statusLabel={statusLabel}
        phaseLabel={phaseLabel}
        goalContext={goalContext}
        confidence={
          analytics?.dataConfidence ??
          (displayWeek?.confidence === "medium_high"
            ? "medium"
            : displayWeek?.confidence === "high"
              ? "high"
              : displayWeek?.confidence === "low"
                ? "low"
                : "medium")
        }
        canSave={Boolean(preview && showingPreview)}
        canRevert={histCount > 0 && !showingPreview}
        hasSaved={calendar.hasSaved}
        loading={loading}
        onGenerate={() => void handleGenerate()}
        onSave={handleSave}
        onClear={handleClear}
        onDuplicate={calendar.hasSaved ? handleDuplicate : undefined}
        onRevert={handleRevert}
        onViewPreview={() => setConfirmReplace(true)}
        onViewSaved={() => setConfirmReplace(false)}
        showingPreview={showingPreview}
        coachHref={coachHref}
      />

      {!displayWeek ? (
        <PlanPlanningContext
          value={planningContext}
          onChange={setPlanningContext}
          disabled={loading}
        />
      ) : null}

      {showingPreview && (planningContext.trim() || lastPlanningContext) ? (
        <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface)]/30 px-3 py-1.5 text-[11px] text-zinc-500">
          <span className="text-zinc-600">Context for this preview: </span>
          {planningContext.trim() || lastPlanningContext}
        </p>
      ) : null}

      {calendar.savedWeek?.planningContext && !showingPreview ? (
        <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface)]/30 px-3 py-1.5 text-[11px] text-zinc-500">
          <span className="text-zinc-600">Context used for this week: </span>
          {calendar.savedWeek.planningContext}
        </p>
      ) : null}

      {calendar.savedWeek && !showingPreview ? (
        <PlanSavedStateCard
          week={calendar.savedWeek}
          historyAvailable={histCount}
          modified={status === "modified"}
          key={historyTick}
        />
      ) : null}

      {showingPreview && preview ? (
        <Alert className="border-amber-500/20 bg-amber-500/[0.05] px-3 py-1.5 text-[11px] text-amber-200/85">
          <AlertDescription className="text-[11px] text-amber-200/85">
            Preview — save to make this your persistent training week
          </AlertDescription>
        </Alert>
      ) : null}

      {saveError ? (
        <Alert className="border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-200/90">
          <AlertDescription className="text-[12px] text-amber-200/90">
            {saveError}
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert className="border-red-500/20 bg-red-500/5 px-3 py-2.5">
          <AlertDescription className="text-sm text-red-300/90">
            {error}
          </AlertDescription>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-8"
            onClick={() => void generate({ forceFallback: true })}
          >
            Use safe fallback
          </Button>
        </Alert>
      ) : null}

      {loading && !displayWeek ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <div className="skeleton-shimmer h-40 rounded-lg" />
          <div className="skeleton-shimmer h-32 rounded-lg" />
        </div>
      ) : null}

      {!loading && status === "empty" && !displayWeek ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] px-5 py-12 text-center">
          <CalendarPlus className="mx-auto h-9 w-9 text-zinc-700" />
          <p className="mt-2 text-[15px] font-medium text-zinc-300">
            Your training week starts here
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-zinc-600">
            Generate a week, edit sessions on the board, then save — it becomes
            your living plan on Home and Plan.
          </p>
          <Button className="mt-4 h-9 gap-1.5" onClick={() => void handleGenerate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Generate plan
          </Button>
        </div>
      ) : null}

      {!displayWeek && !loading && status !== "empty" ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] px-4 py-6 text-center">
          <p className="text-[13px] text-zinc-500">No saved plan for this week.</p>
          <Button
            className="mt-3 h-8 gap-1.5"
            size="sm"
            onClick={() => void handleGenerate()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Generate for this week
          </Button>
        </div>
      ) : null}

      {displayWeek ? (
        <div className="grid gap-3 xl:grid-cols-[1fr_272px]">
          <div className="min-w-0 space-y-3">
            {today ? (
              <PlanTodayFocus today={today} sticky className="lg:hidden" />
            ) : null}

            <PlanWeekNav
              weekRange={weekRange}
              onPrev={() => shiftViewWeek(-1)}
              onNext={() => shiftViewWeek(1)}
            />

            <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subdued)]/60 p-2 sm:p-3">
              <PlanWeekBoard
                week={displayWeek}
                variant="full"
                editable={!showingPreview && Boolean(calendar.savedWeek)}
                draggable={!showingPreview && Boolean(calendar.savedWeek)}
                highlightWorkoutIds={highlightIds}
                onPatchWorkout={
                  !showingPreview ? calendar.patchWorkout : undefined
                }
                onDeleteWorkout={
                  !showingPreview ? calendar.removeWorkout : undefined
                }
                onSwapWorkouts={
                  !showingPreview ? calendar.swapWorkouts : undefined
                }
                onSwipePastStart={() => shiftViewWeek(-1)}
                onSwipePastEnd={() => shiftViewWeek(1)}
              />
            </section>

            {weekExecution ? (
              <PlanWeekExecution
                summary={weekExecution}
                onHighlightDay={(id) => setHighlightIds([id])}
              />
            ) : null}

            {telemetry ? <PlanWeekTelemetryStrip telemetry={telemetry} /> : null}

            {today ? (
              <PlanTodayFocus today={today} className="hidden lg:block" />
            ) : null}
          </div>

          <PlanOperationalSidebar
            week={!showingPreview ? calendar.savedWeek : null}
            preview={showingPreview ? preview : null}
            integrityItems={integrityItems}
            explainLines={explainLines}
            onHighlightWorkouts={setHighlightIds}
          />
        </div>
      ) : null}

      {debugMode && preview ? (
        <Collapsible className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[10px] text-zinc-700">
          <CollapsibleTrigger className="cursor-pointer text-left">
            Advanced (dev)
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-1 max-h-32 overflow-auto">
              {JSON.stringify(
                { validation: preview.validation, integrity: preview.integrity },
                null,
                2
              )}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {coachPlan ? (
        <p className="text-[10px] text-zinc-700">
          Coach uses{" "}
          {calendar.savedWeek ? "your saved calendar" : "the current preview"}.
          Plans persist in this browser only.
        </p>
      ) : null}
    </div>
  );
}
