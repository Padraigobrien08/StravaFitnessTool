import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseFitFile } from "../lib/strava/parseFit.ts";
import { parseActivitiesCsv } from "../lib/strava/parseActivities.ts";
import { findPersonalRecords } from "../lib/analytics/records.ts";
import { matchFitFileToActivityId } from "../lib/strava/parseFit.ts";

async function main() {
  const csv = readFileSync("export_105352925/activities.csv", "utf-8");
  const { runs } = parseActivitiesCsv(csv);
  const map = new Map<string, string>();
  for (const r of runs) {
    if (r.fitFilename) map.set(r.id, r.fitFilename);
  }

  const fitDir = "export_105352925/activities";
  const files = readdirSync(fitDir).filter((f) => f.endsWith(".fit.gz"));
  const details = [];
  let matched = 0;

  for (const f of files) {
    const activityId = matchFitFileToActivityId(`activities/${f}`, map);
    if (!activityId) continue;
    matched++;
    const buf = readFileSync(join(fitDir, f));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    try {
      details.push(await parseFitFile(ab, activityId));
    } catch {
      // skip
    }
  }

  console.log("matched runs:", matched, "parsed:", details.length);
  const withEfforts = details.filter((d) => d.bestEfforts.length > 0).length;
  console.log("runs with bestEfforts:", withEfforts);

  const prs = findPersonalRecords(runs, details);
  for (const pr of prs) {
    console.log(
      pr.label,
      pr.runName.slice(0, 40),
      `${Math.floor(pr.timeSec / 60)}:${String(Math.round(pr.timeSec % 60)).padStart(2, "0")}`,
      `pace ${Math.floor(pr.paceSecPerKm / 60)}:${String(Math.round(pr.paceSecPerKm % 60)).padStart(2, "0")}/km`,
      pr.source
    );
  }
}

main();
