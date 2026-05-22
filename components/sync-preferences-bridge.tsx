"use client";

import { useStrava } from "@/lib/context/strava-context";
import { useSyncPreferences } from "@/hooks/use-sync-preferences";

export function SyncPreferencesBridge() {
  const { apiConnected } = useStrava();
  useSyncPreferences(apiConnected);
  return null;
}
