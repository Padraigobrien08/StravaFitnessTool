import { describe, expect, it } from "vitest";
import { describeApiKeyUserState, mapQueryError, type ApiKeyUserFacts } from "../apiKeyUser";

/**
 * `STRIDEIQ_API_KEY_USER_ID` is set by hand, and a fresh Strava OAuth creates a new
 * user row — so the id keeps naming an account that has no data. Confirmed live on this
 * repository: a session minted for the configured id got `{"connected":false}` and a 404
 * from `/api/me/import` while the browser session worked normally.
 *
 * `checkEnvCoherence` cannot catch it, because it is pure: it sees the variable is set
 * and stops there. These cover the decision half, which is where the judgement lives.
 */

const facts = (over: Partial<ApiKeyUserFacts> = {}): ApiKeyUserFacts => ({
  userExists: true,
  hasStravaConnection: true,
  activityCount: 120,
  ...over,
});

describe("describeApiKeyUserState", () => {
  it("says nothing when the key is not configured", () => {
    expect(describeApiKeyUserState(facts({ userExists: false }), false)).toBeNull();
  });

  it("says nothing when there are no facts to judge", () => {
    // Null means "could not check" — an unreachable database, say. Reporting that as a
    // healthy configuration would be the same silent-success failure being fixed.
    expect(describeApiKeyUserState(null, true)).toBeNull();
  });

  it("stays quiet on a fully working configuration", () => {
    expect(describeApiKeyUserState(facts(), true)).toBeNull();
  });

  it("errors when the id names no user at all", () => {
    const issue = describeApiKeyUserState(facts({ userExists: false }), true);
    expect(issue?.level).toBe("error");
    expect(issue?.key).toBe("STRIDEIQ_API_KEY_USER_ID");
    expect(issue?.message).toMatch(/does not exist/i);
  });

  // The live case: the user row survives, but the data moved to a newer one.
  it("errors when the user exists but has never connected Strava", () => {
    const issue = describeApiKeyUserState(
      facts({ hasStravaConnection: false, activityCount: 0 }),
      true,
    );
    expect(issue?.level).toBe("error");
    expect(issue?.message).toMatch(/no Strava connection/i);
    // Naming the cause is the point: without it this reads as "sync is broken".
    expect(issue?.message).toMatch(/new user row/i);
  });

  it("warns rather than errors when a connected user simply has not synced yet", () => {
    const issue = describeApiKeyUserState(facts({ activityCount: 0 }), true);
    expect(issue?.level).toBe("warn");
    expect(issue?.message).toMatch(/no activities yet/i);
  });

  it("never puts the id itself in the message", () => {
    for (const f of [
      facts({ userExists: false }),
      facts({ hasStravaConnection: false }),
      facts({ activityCount: 0 }),
    ]) {
      const issue = describeApiKeyUserState(f, true);
      // The env checker's standing rule: variable names appear, values never do.
      expect(issue?.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
  });
});

describe("mapQueryError", () => {
  // The verbatim message Postgres 17 returns for `'not-a-uuid'::uuid`, captured by
  // running the query rather than paraphrasing it, since a paraphrase is what the
  // regex would then be tested against instead of reality.
  const PG_UUID_ERROR = 'invalid input syntax for type uuid: "not-a-uuid"';

  it("names a malformed id as a configuration error", () => {
    const issue = mapQueryError(PG_UUID_ERROR);
    expect(issue?.level).toBe("error");
    expect(issue?.message).toMatch(/not a valid UUID/i);
  });

  it("matches on the SQLSTATE code too, in case the wording changes", () => {
    expect(mapQueryError("error 22P02 while binding parameter")?.level).toBe("error");
  });

  it("stays silent on failures that are not this check's business", () => {
    // An unreachable database is reported by /api/health; claiming the API-key user is
    // misconfigured because the database is down would send the reader the wrong way.
    expect(mapQueryError("connection refused")).toBeNull();
    expect(mapQueryError("timeout expired")).toBeNull();
    expect(mapQueryError('relation "users" does not exist')).toBeNull();
  });
});
