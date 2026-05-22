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

  const persist = useCallback(
    (msgs: CoachMessage[], threadId: string, title?: string) => {
      const existing = getThread(threadId);
      if (!existing) return;
      upsertThread({
        ...existing,
        messages: msgs,
        title: title ?? existing.title,
      });
      setThreads(listThreads());
    },
    []
  );

  const ensureThread = useCallback(() => {
    if (activeId && getThread(activeId)) return activeId;
    const t = createThread();
    setThreads(listThreads());
    setActiveId(t.id);
    setMessages([]);
    return t.id;
  }, [activeId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || disabled) return;

      const threadId = ensureThread();
      const userMsg: CoachMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);
      setError(null);
      setPendingTools([]);
      setLoadingPhase(0);

      const isFirst = messages.filter((m) => m.role === "user").length === 0;
      persist(
        nextMessages,
        threadId,
        isFirst ? titleFromFirstMessage(trimmed) : undefined
      );

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
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
        setError(e instanceof Error ? e.message : "Chat failed");
      } finally {
        setLoading(false);
        setPendingTools([]);
      }
    },
    [messages, loading, disabled, ensureThread, persist]
  );

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadingPhase((p) => p + 1), 1200);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
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
    },
    [activeId, loadThread]
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
    loadThread,
    handleNewThread,
    handleDeleteThread,
    hasConversation: messages.length > 0,
  };
}
