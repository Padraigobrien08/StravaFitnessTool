import { parseNum } from "@/lib/utils";
import { parseCsvRows } from "./parseCsv";
import type { AthleteProfile } from "./types";

export function parsePreferencesCsv(csvText: string): AthleteProfile {
  const rows = parseCsvRows(csvText);
  const row = rows[0] ?? {};

  const ftpRaw = row["Functional Threshold Power"] ?? "";
  const ftpMatch = ftpRaw.match(/([\d.]+)/);

  return {
    maxHeartRate: parseNum(row["Maximum Heartrate"]),
    athleteType: row["Athlete Type"]?.trim() || null,
    ftp: ftpMatch ? parseNum(ftpMatch[1]) : null,
    measurementPreference: row["Measurement Preference"]?.trim() || null,
  };
}
