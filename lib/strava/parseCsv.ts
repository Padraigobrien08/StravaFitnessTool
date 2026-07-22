import Papa from "papaparse";

/** Strava exports repeat column names; suffix duplicates for stable access. */
export function dedupeHeaders(headers: string[]): string[] {
  const counts: Record<string, number> = {};
  return headers.map((h) => {
    const key = h.trim();
    if (counts[key] === undefined) {
      counts[key] = 0;
      return key;
    }
    counts[key] += 1;
    return `${key}_${counts[key]}`;
  });
}

export function parseCsvRows(csvText: string): Record<string, string>[] {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    const msg = result.errors.map((e) => e.message).join("; ");
    throw new Error(`CSV parse error: ${msg}`);
  }

  const rows = result.data;
  if (rows.length < 2) return [];

  const headers = dedupeHeaders(rows[0].map((c) => String(c)));
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = row[i] ?? "";
    });
    return record;
  });
}

/** Prefer suffixed duplicate column when present (usually more precise). */
export function pickField(row: Record<string, string>, name: string): string | undefined {
  const v1 = row[`${name}_1`];
  if (v1 !== undefined && v1.trim() !== "") return v1;
  return row[name];
}
