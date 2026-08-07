import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDb } from "./testDatabase";
import { getSql } from "../client";

/**
 * Strava token storage and the refresh decision.
 *
 * `getValidAccessToken` sits in front of every Strava call the app makes. Refresh too
 * eagerly and each request costs an extra round trip and burns refresh tokens; refresh
 * too late and the access token expires mid-sync and the whole run fails. The margin
 * is 60 seconds, and the boundary either side of it is the part worth pinning.
 *
 * Opt-in and local-only — these tests DELETE rows. See testDatabase.ts.
 */

const refreshAccessToken = vi.fn();
vi.mock("@/lib/strava/api/oauth", () => ({
  refreshAccessToken: (...a: unknown[]) => refreshAccessToken(...a),
}));
vi.mock("@/lib/strava/api/fetchAthlete", () => ({
  fetchAthleteStats: vi.fn().mockResolvedValue(null),
  fetchAthleteZones: vi.fn().mockResolvedValue(null),
}));

const USER = "00000000-0000-0000-0000-0000000000f1";
const ATHLETE_ID = 987654;

/** Seconds since the epoch, the unit Strava's token payload uses. */
const epochIn = (seconds: number) => Math.floor(Date.now() / 1000) + seconds;

function tokens(overrides: Record<string, unknown> = {}) {
  return {
    access_token: "access-new",
    refresh_token: "refresh-new",
    expires_at: epochIn(6 * 3600),
    athlete: { id: ATHLETE_ID, firstname: "Test" },
    ...overrides,
  };
}

async function seedConnection(expiresInSeconds: number) {
  const sql = getSql();
  await sql`INSERT INTO users (id) VALUES (${USER}::uuid) ON CONFLICT DO NOTHING`;
  await sql`
    INSERT INTO strava_connections (
      user_id, strava_athlete_id, access_token, refresh_token, expires_at, scopes, athlete_json
    ) VALUES (
      ${USER}::uuid, ${ATHLETE_ID}, 'access-old', 'refresh-old',
      ${new Date(Date.now() + expiresInSeconds * 1000)}, 'read', ${JSON.stringify({ id: ATHLETE_ID })}::jsonb
    )
    ON CONFLICT (strava_athlete_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at
  `;
}

async function cleanup() {
  const sql = getSql();
  await sql`DELETE FROM strava_connections WHERE user_id = ${USER}::uuid`.catch(() => {});
  await sql`DELETE FROM users WHERE id = ${USER}::uuid`.catch(() => {});
}

describe.skipIf(!hasTestDb)("getValidAccessToken", () => {
  beforeEach(async () => {
    refreshAccessToken.mockReset().mockResolvedValue(tokens());
    await cleanup();
  });

  afterAll(cleanup);

  async function get() {
    const { getValidAccessToken } = await import("../strava-connection");
    return getValidAccessToken(USER);
  }

  it("reuses a token that is comfortably valid", async () => {
    await seedConnection(3600);
    const { accessToken } = await get();
    expect(accessToken).toBe("access-old");
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes a token that has already expired", async () => {
    await seedConnection(-60);
    const { accessToken } = await get();
    expect(accessToken).toBe("access-new");
    expect(refreshAccessToken).toHaveBeenCalledWith("refresh-old");
  });

  /**
   * The margin exists so a token cannot expire between the check and the request it
   * authorises. Either side of 60 seconds is the whole behaviour.
   */
  it("refreshes a token expiring inside the 60s margin", async () => {
    await seedConnection(30);
    await get();
    expect(refreshAccessToken).toHaveBeenCalled();
  });

  it("does not refresh a token expiring just outside the margin", async () => {
    await seedConnection(120);
    await get();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("persists the refreshed token rather than only returning it", async () => {
    await seedConnection(-60);
    await get();

    const { getStravaConnection } = await import("../strava-connection");
    const conn = await getStravaConnection(USER);
    expect(conn?.access_token).toBe("access-new");
    expect(conn?.refresh_token).toBe("refresh-new");
  });

  // Strava rotates refresh tokens: reusing the old one after a refresh fails, so
  // losing the new one would lock the athlete out until they reconnect.
  it("stores the rotated refresh token, not the one it was called with", async () => {
    await seedConnection(-60);
    refreshAccessToken.mockResolvedValue(tokens({ refresh_token: "refresh-rotated" }));
    await get();

    const { getStravaConnection } = await import("../strava-connection");
    expect((await getStravaConnection(USER))?.refresh_token).toBe("refresh-rotated");
  });

  it("refuses to invent a connection that does not exist", async () => {
    await expect(get()).rejects.toThrow(/No Strava connection/);
  });

  // A refresh response omits the athlete block; the stored profile must survive it
  // rather than being nulled out.
  it("keeps the stored athlete profile when the refresh omits one", async () => {
    await seedConnection(-60);
    refreshAccessToken.mockResolvedValue(tokens({ athlete: undefined }));
    const { athlete } = await get();
    expect(athlete).toMatchObject({ id: ATHLETE_ID });
  });
});
