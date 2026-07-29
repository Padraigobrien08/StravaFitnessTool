"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseCoachResponse } from "@/lib/coach/parseResponse";
import {
  createThread,
  getActiveThreadId,
  getThread,
  listThreads,
  setActiveThreadId,
  upsertThread,
  deleteThread,
  titleFromFirstMessage,
} from "@/lib/coach/threadStorage";
import type { CoachMessage } from "@/lib/coach/types";
import { isAbortError, retryTargetFromMessages } from "@/lib/coach/threadRetry";
import { toast } from "sonner";
import { classifyPlanningMessage } from "@/lib/ai-planning/planningIntent";
import { classifyMemoryQuestion } from "@/lib/athlete-memory/memoryIntent";
import { classifyAdaptiveCoachQuestion } from "@/lib/adaptive-intelligence";
import type { CoachPlanApiResponse } from "./use-coach-plan";
import {
  buildCalendarCoachPayload,
  calendarWeekToWeeklyPlan,
  getCalendarWeek,
  targetPlanWeekStart,
} from "@/lib/training-calendar";

export function useCoachThread(disabled?: boolean) {
  const [threads, setThreads] = useState(() => listThreads());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveThreadId());
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTools, setPendingTools] = useState<string[]>([]);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  // A tool-backed turn can run for tens of seconds, so the athlete needs a way
  // out of it. Held in a ref so `stop()` can reach the in-flight request.
  const abortRef = useRef<AbortController | null>(null);

  const loadThread = useCallback((id: string) => {
    const t = getThread(id);
    if (t) {
      setActiveId(id);
      setActiveThreadId(id);
      setMessages(t.messages);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (activeId) {
      const t = getThread(activeId);
      if (t) setMessages(t.messages);
    } else if (threads.length > 0) {
      loadThread(threads[0].id);
    }
  }, [activeId, threads, loadThread]);

  const persist = useCallback((msgs: CoachMessage[], threadId: string, title?: string) => {
    const existing = getThread(threadId);
    if (!existing) return;
    upsertThread({
      ...existing,
      messages: msgs,
      title: title ?? existing.title,
    });
    setThreads(listThreads());
  }, []);

  const ensureThread = useCallback(() => {
    if (activeId && getThread(activeId)) return activeId;
    const t = createThread();
    setThreads(listThreads());
    setActiveId(t.id);
    setMessages([]);
    return t.id;
  }, [activeId]);

  const send = useCallback(
    /**
     * @param baseOverride the thread to build on, instead of current `messages`.
     *   Used by `retryLast`, which drops the failed turn before re-running it;
     *   without this the closure's stale `messages` would duplicate it.
     */
    async (text: string, baseOverride?: CoachMessage[]) => {
      const trimmed = text.trim();
      if (!trimmed || loading || disabled) return;

      const base = baseOverride ?? messages;
      const controller = new AbortController();
      abortRef.current = controller;
      const threadId = ensureThread();
      const userMsg: CoachMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const nextMessages = [...base, userMsg];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);
      setError(null);
      setPendingTools([]);
      setLoadingPhase(0);

      const isFirst = base.filter((m) => m.role === "user").length === 0;
      persist(nextMessages, threadId, isFirst ? titleFromFirstMessage(trimmed) : undefined);

      try {
        const lastPlan = [...base]
          .reverse()
          .find((m) => m.role === "assistant" && m.weeklyPlan)?.weeklyPlan;
        const savedCalendar = getCalendarWeek(targetPlanWeekStart());
        const previousPlan = savedCalendar
          ? calendarWeekToWeeklyPlan(savedCalendar)
          : lastPlan?.plan;
        const calendarPayload = buildCalendarCoachPayload(savedCalendar, null);

        const memoryQuestion =
          classifyMemoryQuestion(trimmed) ?? classifyAdaptiveCoachQuestion(trimmed);
        if (memoryQuestion) {
          setPendingTools(["get_athlete_memory"]);
          const memRes = await fetch("/api/me/coach/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({ message: trimmed }),
          });
          const memData = await memRes.json();
          if (!memRes.ok) {
            throw new Error(memData.error ?? "Memory request failed");
          }
          const replyText = memData.answer as string;
          const parsed = parseCoachResponse(replyText);
          const assistantMsg: CoachMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: replyText,
            createdAt: new Date().toISOString(),
            toolsUsed: ["get_athlete_memory"],
            parsed,
            status: "complete",
          };
          const final = [...nextMessages, assistantMsg];
          setMessages(final);
          persist(final, threadId);
          return;
        }

        const planningRoute = classifyPlanningMessage(trimmed, Boolean(previousPlan));

        if (planningRoute) {
          setPendingTools(["generate_next_week_training_plan"]);
          const planRes = await fetch("/api/me/coach/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({
              message: trimmed,
              previousPlan,
              calendarContext: calendarPayload.summaryText,
            }),
          });
          const planData = (await planRes.json()) as CoachPlanApiResponse & {
            error?: string;
          };
          if (!planRes.ok) {
            throw new Error(planData.error ?? "Weekly plan failed");
          }

          const replyText =
            planData.replySummary ?? planData.explanationOnly ?? planData.plan.summary;

          const parsed = parseCoachResponse(replyText);
          const assistantMsg: CoachMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: replyText,
            createdAt: new Date().toISOString(),
            toolsUsed: ["generate_next_week_training_plan"],
            parsed,
            weeklyPlan: {
              plan: planData.plan,
              guardrails: planData.guardrails,
              source: planData.source,
              validation: planData.validation,
              observability: planData.observability,
              explanationOnly: planData.explanationOnly,
            },
            status: "complete",
          };
          const final = [...nextMessages, assistantMsg];
          setMessages(final);
          persist(final, threadId);
          return;
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Chat request failed");
        }

        const toolsUsed = (data.toolsUsed as string[] | undefined) ?? [];
        setPendingTools(toolsUsed);

        const parsed = parseCoachResponse(data.reply as string);
        const assistantMsg: CoachMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          createdAt: new Date().toISOString(),
          toolsUsed,
          parsed,
          status: "complete",
        };
        const final = [...nextMessages, assistantMsg];
        setMessages(final);
        persist(final, threadId);
      } catch (e) {
        // Stopping on purpose is not a failure, so it must not surface as one.
        if (isAbortError(e)) return;
        setError(e instanceof Error ? e.message : "Chat failed");
      } finally {
        abortRef.current = null;
        setLoading(false);
        setPendingTools([]);
      }
    },
    [messages, loading, disabled, ensureThread, persist],
  );

  /** Cancel the turn in flight and keep the thread as it stands. */
  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setPendingTools([]);
  }, []);

  /**
   * Re-run the last question after a failure. `retryTargetFromMessages` drops
   * the trailing user turn so the thread does not gain a duplicate of it.
   */
  const retryLast = useCallback(() => {
    if (loading) return;
    const target = retryTargetFromMessages(messages);
    if (!target) return;
    void send(target.text, target.base);
  }, [loading, messages, send]);

  // Abandoning the page should not leave a request running.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadingPhase((p) => p + 1), 1200);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 140;
    if (nearBottom || loading) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleNewThread = useCallback(() => {
    const t = createThread();
    setThreads(listThreads());
    setActiveId(t.id);
    setMessages([]);
    setError(null);
  }, []);

  const handleDeleteThread = useCallback(
    (id: string) => {
      // One click on a trash icon used to destroy an investigation outright.
      // Keep the thread in hand so the toast can genuinely put it back.
      const removed = getThread(id);
      deleteThread(id);
      const next = listThreads();
      setThreads(next);
      if (activeId === id) {
        if (next[0]) loadThread(next[0].id);
        else {
          setActiveId(null);
          setMessages([]);
        }
      }
      if (removed) {
        toast.success("Investigation deleted", {
          description: removed.title || "Untitled investigation",
          action: {
            label: "Undo",
            onClick: () => {
              upsertThread(removed);
              setThreads(listThreads());
              loadThread(removed.id);
              toast.success("Investigation restored");
            },
          },
        });
      }
    },
    [activeId, loadThread],
  );

  return {
    threads,
    activeId,
    messages,
    input,
    setInput,
    loading,
    error,
    pendingTools,
    loadingPhase,
    scrollRef,
    send,
    stop,
    retryLast,
    loadThread,
    handleNewThread,
    handleDeleteThread,
    hasConversation: messages.length > 0,
  };
}
