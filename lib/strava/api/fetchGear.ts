import { stravaGet } from "./client";

export interface StravaGear {
  id: string;
  primary: boolean;
  name: string;
  resource_state: number;
  distance: number;
}

export interface StravaAthleteGear {
  id: number;
  shoes?: StravaGear[];
  bikes?: StravaGear[];
}

export async function fetchAthleteGear(
  accessToken: string
): Promise<{ shoes: StravaGear[]; bikes: StravaGear[] }> {
  const athlete = await stravaGet<StravaAthleteGear>(
    accessToken,
    "/athlete",
    undefined,
    { context: "athlete gear" }
  );
  if (!athlete) return { shoes: [], bikes: [] };
  return {
    shoes: athlete.shoes ?? [],
    bikes: athlete.bikes ?? [],
  };
}
