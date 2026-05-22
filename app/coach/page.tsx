"use client";

import { useEffect, useState } from "react";
import { RequireData } from "@/components/require-data";
import { useStrava } from "@/lib/context/strava-context";
import { useSyncPreferences } from "@/hooks/use-sync-preferences";
import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { CoachReasoningWorkspace } from "@/components/coach/coach-reasoning-workspace";
import Link from "next/link";

export default function CoachPage() {
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
              ? "Connect Strava on Import — the reasoning engine needs server-synced activities and your race goal."
              : "Sync activities from Import so Coach can run intelligence tools on your full history."
          }
        />

        <p className="mt-2 text-center text-[11px] text-zinc-600">
          <Link href="/import" className="text-teal-400/80 hover:underline">
            Data
          </Link>
          {" · "}
          <Link href="/goals" className="text-teal-400/80 hover:underline">
            Goal
          </Link>
          {" · "}
          <Link href="/training" className="text-teal-400/80 hover:underline">
            Training
          </Link>
        </p>
      </CoachWorkspace>
    </RequireData>
  );
}
