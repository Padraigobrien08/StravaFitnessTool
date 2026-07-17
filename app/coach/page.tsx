"use client";

import { Suspense, useEffect, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { useSyncPreferences } from "@/hooks/use-sync-preferences";
import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { CoachReasoningWorkspace } from "@/components/coach/coach-reasoning-workspace";

function CoachPageInner() {
  const { apiConnected, importData, dataSources } = useStrava();
  const [serverReady, setServerReady] = useState(false);
  const isDemo = Boolean(dataSources.demo);

  useSyncPreferences(apiConnected);

  useEffect(() => {
    if (!apiConnected) {
      setServerReady(false);
      return;
    }
    void fetch("/api/me/status", { credentials: "include" })
      .then((r) => r.json())
      .then((s: { connected?: boolean; runs?: number }) => {
        setServerReady(Boolean(s.connected && (s.runs ?? 0) > 0));
      })
      .catch(() => setServerReady(false));
  }, [apiConnected, importData]);

  const chatDisabled = !apiConnected || !serverReady;

  return (
    <RequireData>
      <CoachWorkspace>
        <CoachReasoningWorkspace
          disabled={chatDisabled}
          disabledReason={
            isDemo
              ? "Demo mode: the reasoning workspace below is live on the sample athlete, but the chat needs an LLM key. Add OPENAI_API_KEY (or ANTHROPIC_API_KEY) + DATABASE_URL to .env.local and connect Strava to enable tool-backed chat — see the README “Coach chat” section."
              : !apiConnected
                ? "Connect Strava on Import — Coach needs server-synced activities for tool-backed reasoning."
                : "Sync activities from Import so investigations can use your full history."
          }
        />
      </CoachWorkspace>
    </RequireData>
  );
}

export default function CoachPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full min-h-[240px] animate-pulse rounded-xl bg-white/[0.02]" />
      }
    >
      <CoachPageInner />
    </Suspense>
  );
}
