import { getSessionUserId } from "@/lib/auth/session";
import { parseSessionToken } from "@/lib/auth/session";
import type { NextRequest } from "next/server";
import type { IntelligenceContext } from "./types";
import type { RaceGoal, RaceDistance } from "@/lib/analytics/readiness";

export async function intelligenceContextFromRequest(
  req: NextRequest,
): Promise<IntelligenceContext | null> {
  let userId = await getSessionUserId();
  if (!userId) {
    const apiKey = req.headers.get("x-strideiq-api-key");
    const keyUser = process.env.STRIDEIQ_API_KEY_USER_ID;
    if (
      apiKey &&
      process.env.STRIDEIQ_API_KEY &&
      apiKey === process.env.STRIDEIQ_API_KEY &&
      keyUser
    ) {
      userId = keyUser;
    }
  }
  if (!userId) {
    const cookieHeader = req.headers.get("cookie");
    const match = cookieHeader?.match(/strideiq_session=([^;]+)/);
    if (match) {
      userId = parseSessionToken(decodeURIComponent(match[1]));
    }
  }
  if (!userId) return null;

  const raceGoal = parseRaceGoalQuery(req);
  const defaultWeeklyRuns = parseInt(req.nextUrl.searchParams.get("defaultWeeklyRuns") ?? "", 10);
  const maxWeeklyKm = parseFloat(req.nextUrl.searchParams.get("maxWeeklyKm") ?? "");

  return {
    userId,
    raceGoal,
    settings: {
      ...(Number.isFinite(defaultWeeklyRuns) && defaultWeeklyRuns > 0 ? { defaultWeeklyRuns } : {}),
      ...(Number.isFinite(maxWeeklyKm) && maxWeeklyKm > 0 ? { maxWeeklyKm } : {}),
    },
  };
}

function parseRaceGoalQuery(req: NextRequest): RaceGoal | null | undefined {
  const distance = req.nextUrl.searchParams.get("distance") as RaceDistance | null;
  const date = req.nextUrl.searchParams.get("raceDate");
  if (!distance || !date) return undefined;
  const target = req.nextUrl.searchParams.get("targetTimeSec");
  const goal: RaceGoal = { distance, date };
  if (target) {
    const sec = parseInt(target, 10);
    if (Number.isFinite(sec) && sec > 0) goal.targetTimeSec = sec;
  }
  return goal;
}
