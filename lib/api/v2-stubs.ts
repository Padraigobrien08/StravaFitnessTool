/**
 * V2 hosted architecture stubs — implement when adding auth + Neon.
 *
 * POST /api/imports  → store raw zip, queue parse job
 * GET  /api/runs     → return parsed RunActivity[]
 * GET  /api/insights → return precomputed dashboard payload
 */

import type { StravaImport } from "@/lib/strava/types";
import type { DashboardInsights } from "@/lib/analytics";

export interface ImportJobPayload {
  userId: string;
  exportKey: string;
}

export interface RunsResponse {
  runs: StravaImport["runs"];
}

export interface InsightsResponse {
  insights: DashboardInsights;
  computedAt: string;
}

export const V2_API_ROUTES = {
  imports: "/api/imports",
  runs: "/api/runs",
  insights: "/api/insights",
  health: "/api/health",
} as const;
