"use client";

import { useEffect, useState } from "react";
import type { LimiterProtocolResult } from "@/lib/goals/limiterProtocols";

/** Fetch the per-limiter protocol (server-computed, logged as a recommendation) once on mount. */
export function useLimiterProtocol(enabled: boolean): LimiterProtocolResult | null {
  const [data, setData] = useState<LimiterProtocolResult | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch("/api/me/limiter-protocol", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: LimiterProtocolResult | null) => {
        if (!cancelled && d && "available" in d) setData(d);
      })
      .catch(() => {
        /* offline / no DB — panel hides */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return data;
}
