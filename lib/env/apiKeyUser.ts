import type { EnvIssue } from "./index";

/**
 * Does `STRIDEIQ_API_KEY_USER_ID` point at a user who actually has data?
 *
 * `lib/env/index.ts` can only check that the variable is *set*, because it is pure and
 * synchronous by design. Whether it *resolves* is a different question and needs the
 * database, which is why this lives apart from it.
 *
 * The failure it catches is silent by construction. The variable is set by hand, and a
 * fresh Strava OAuth creates a **new** user row — so the id keeps naming a user that
 * no longer has the data, or never existed. The web UI is unaffected, because a browser
 * session carries its own user id, so nothing looks wrong. Meanwhile every API-key
 * request (`/api/me/intelligence?tool=…`) and the whole MCP package authenticate
 * successfully as an athlete with no activities, and answer "no data" to every question.
 *
 * Observed on this repository: a freshly minted session for the configured id returned
 * `{"connected":false}` from `/api/me/status` and a 404 from `/api/me/import`, while the
 * same deployment served the browser normally.
 *
 * Authenticating as an empty account is worse than failing to authenticate: a 401 is a
 * bug report, an empty answer is a wrong one.
 */

export interface ApiKeyUserFacts {
  /** A row exists in `users` for the configured id. */
  userExists: boolean;
  /** That user has completed Strava OAuth. */
  hasStravaConnection: boolean;
  /** How many activities they hold. */
  activityCount: number;
}

/**
 * The decision, separated from the query so it is testable without a database.
 * Returns null when the configuration is fine or when there is nothing to judge.
 */
export function describeApiKeyUserState(
  facts: ApiKeyUserFacts | null,
  configured: boolean,
): EnvIssue | null {
  if (!configured || facts === null) return null;

  const key = "STRIDEIQ_API_KEY_USER_ID";

  if (!facts.userExists) {
    return {
      level: "error",
      key,
      message: `${key} names a user that does not exist. API-key requests will authenticate and then answer as an athlete with no data. Re-read the id after connecting Strava.`,
    };
  }

  if (!facts.hasStravaConnection) {
    return {
      level: "error",
      key,
      message: `${key} points at a user with no Strava connection — usually because a later OAuth created a new user row. The API-key and MCP paths will return empty results while the web UI works normally.`,
    };
  }

  if (facts.activityCount === 0) {
    return {
      level: "warn",
      key,
      message: `${key} resolves to a connected user with no activities yet. API-key and MCP requests will answer "no data" until a sync completes.`,
    };
  }

  return null;
}

/**
 * Resolve the configured API-key user against the database.
 *
 * Returns null when there is nothing to check — no API key configured, or no database
 * to check it against — so callers can treat null as "no opinion" rather than "fine".
 */
export async function checkApiKeyUser(
  env: NodeJS.ProcessEnv = process.env,
): Promise<EnvIssue | null> {
  const userId = env.STRIDEIQ_API_KEY_USER_ID?.trim();
  const key = env.STRIDEIQ_API_KEY?.trim();
  if (!userId || !key || !env.DATABASE_URL?.trim()) return null;

  try {
    const { getSql } = await import("@/lib/db/client");
    const sql = getSql();

    // One round trip, and it must not throw on a malformed id: `::uuid` on a value that
    // is not a UUID raises 22P02, which would otherwise surface as a boot-time crash
    // rather than the configuration warning this exists to produce.
    const rows = (await sql`
      SELECT
        EXISTS (SELECT 1 FROM users WHERE id = ${userId}::uuid) AS user_exists,
        EXISTS (SELECT 1 FROM strava_connections WHERE user_id = ${userId}::uuid) AS has_connection,
        (SELECT COUNT(*)::int FROM activities WHERE user_id = ${userId}::uuid) AS activity_count
    `) as unknown as Array<{
      user_exists: boolean;
      has_connection: boolean;
      activity_count: number;
    }>;

    const row = rows[0];
    if (!row) return null;

    return describeApiKeyUserState(
      {
        userExists: row.user_exists,
        hasStravaConnection: row.has_connection,
        activityCount: row.activity_count,
      },
      true,
    );
  } catch (e) {
    return mapQueryError(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Turn a failed lookup into an issue, or into silence.
 *
 * Extracted so it can be tested: reaching it through `checkApiKeyUser` needs a database
 * that both exists and rejects the id, and the malformed-UUID case additionally needs a
 * non-empty `users` table — Postgres does not evaluate the cast when there are no rows
 * to filter, so an empty database reports "no such user" instead. Rather than ship a
 * branch that is awkward to reach and therefore never exercised, the mapping is pure and
 * the test feeds it the exact message Postgres produces.
 */
export function mapQueryError(message: string): EnvIssue | null {
  // A malformed id is a configuration error worth naming; an unreachable database is
  // not this check's business, and /api/health already reports that separately.
  if (/invalid input syntax for type uuid|22P02/i.test(message)) {
    return {
      level: "error",
      key: "STRIDEIQ_API_KEY_USER_ID",
      message:
        "STRIDEIQ_API_KEY_USER_ID is not a valid UUID, so no API-key request can resolve to a user.",
    };
  }
  return null;
}
