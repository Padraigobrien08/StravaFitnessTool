"use client";

import { StravaProvider } from "@/lib/context/strava-context";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { SyncPreferencesBridge } from "@/components/sync-preferences-bridge";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StravaProvider>
      <SyncPreferencesBridge />
      <AppShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
    </StravaProvider>
  );
}
