import { timingSafeEqual } from "crypto";
import { getSessionUserId } from "@/lib/auth/session";
import { parseSessionToken } from "@/lib/auth/session";
import type { NextRequest } from "next/server";
import type { IntelligenceContext } from "./types";
import type { RaceGoal, RaceDistance } from "@/lib/analytics/readiness";
import { getLegFeel } from "@/lib/db/leg-feel";
import { feelDateKey } from "@/lib/wellness/types";

/**
 * Constant-time secret comparison.
 *
 * `===` on a secret leaks its prefix through timing: it returns on the first
 * differing byte, so an attacker who can measure response time can recover the key
 * one character at a time. `lib/auth/session.ts` already compares session signatures
 * this way; the API key had been left on `===`.
 *
 * The length check is deliberately *outside* `timingSafeEqual`, which throws on
 * mismatched lengths rather than returning false. Length is not the secret here — the
 * key's value is — so leaking it is acceptable where leaking the prefix is not.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function intelligenceContextFromRequest(
  req: NextRequest,
): Promise<IntelligenceContext | null> {
  let userId = await getSessionUserId();
  if (!userId) {
    const apiKey = req.headers.get("x-strideiq-api-key");
    const keyUser = process.env.STRIDEIQ_API_KEY_USER_ID;
    const expected = process.env.STRIDEIQ_API_KEY;
    if (apiKey && expected && keyUser && secretsMatch(apiKey, expected)) {
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
  // Today's subjective leg-feel, if reported. Returns null on any DB failure.
  const feel = await getLegFeel(userId, feelDateKey());

  return {
    userId,
    raceGoal,
    settings: {
      ...(Number.isFinite(defaultWeeklyRuns) && defaultWeeklyRuns > 0 ? { defaultWeeklyRuns } : {}),
      ...(Number.isFinite(maxWeeklyKm) && maxWeeklyKm > 0 ? { maxWeeklyKm } : {}),
    },
    legFeel: feel?.legs,
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
