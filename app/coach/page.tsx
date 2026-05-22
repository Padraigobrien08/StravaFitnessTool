"use client";

import { Suspense, useEffect, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { useSyncPreferences } from "@/hooks/use-sync-preferences";
import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { CoachReasoningWorkspace } from "@/components/coach/coach-reasoning-workspace";

function CoachPageInner() {
  const { apiConnected, importData } = useStrava();
  const [serverReady, setServerReady] = useState(false);

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
            !apiConnected
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
