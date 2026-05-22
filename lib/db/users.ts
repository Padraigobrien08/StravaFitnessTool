import { getSql } from "./client";

export async function createUser(): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO users DEFAULT VALUES
    RETURNING id
  `;
  const row = rows[0] as { id: string };
  return row.id;
}

export async function findUserByStravaAthleteId(
  stravaAthleteId: number
): Promise<string | null> {
  return findUserIdByStravaAthleteId(stravaAthleteId);
}

export async function findUserIdByStravaAthleteId(
  stravaAthleteId: number
): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id FROM strava_connections
    WHERE strava_athlete_id = ${stravaAthleteId}
    LIMIT 1
  `;
  const row = rows[0] as { user_id: string } | undefined;
  return row?.user_id ?? null;
}
