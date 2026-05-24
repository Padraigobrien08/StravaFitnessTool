"use client";

import { StravaProvider } from "@/lib/context/strava-context";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { SyncPreferencesBridge } from "@/components/sync-preferences-bridge";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <StravaProvider>
          <SyncPreferencesBridge />
          <AppShell>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AppShell>
          <Toaster richColors position="bottom-right" />
        </StravaProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
