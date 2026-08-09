import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Setup/health probe. Reports which pieces are configured and whether the
 * database is actually reachable, so a new install can diagnose why sync or
 * Coach isn't working. Visit /api/health after `npm run setup`.
 */
export async function GET() {
  const configured = {
    database: Boolean(process.env.DATABASE_URL),
    session_secret: Boolean(process.env.SESSION_SECRET),
    strava_oauth: Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
    coach_llm: Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
  };

  let database: { reachable: boolean; error?: string } = { reachable: false };
  if (configured.database) {
    try {
      const sql = getSql();
      await sql`SELECT 1`;
      database = { reachable: true };
    } catch (err) {
      database = {
        reachable: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const ready = configured.session_secret && database.reachable;

  // Whether the API-key user actually resolves. A boot log is easy to miss and gone by
  // the time anyone wonders why `/api/me/intelligence` returns nothing, so the probe
  // that people already visit reports it too.
  let apiKey: { configured: boolean; ok: boolean; issue?: string } = {
    configured: Boolean(process.env.STRIDEIQ_API_KEY && process.env.STRIDEIQ_API_KEY_USER_ID),
    ok: true,
  };
  if (apiKey.configured && database.reachable) {
    const { checkApiKeyUser } = await import("@/lib/env/apiKeyUser");
    const issue = await checkApiKeyUser();
    // The message names variables and states, never the id itself.
    if (issue) apiKey = { ...apiKey, ok: false, issue: issue.message };
  }

  return NextResponse.json({
    status: ready ? "ok" : "incomplete",
    configured,
    database,
    api_key: apiKey,
    features: {
      live_sync: configured.strava_oauth && database.reachable,
      coach: configured.coach_llm && database.reachable,
      // Authenticating as an empty account is worse than not authenticating: a 401 is a
      // bug report, an empty answer is a wrong one.
      automation: apiKey.configured && apiKey.ok && database.reachable,
    },
  });
}
