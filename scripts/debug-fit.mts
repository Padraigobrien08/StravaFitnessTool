import { readFileSync } from "fs";
import FitParser from "fit-file-parser";
import { inflate } from "pako";
import { parseFitFile } from "../lib/strava/parseFit.ts";
import { parseActivitiesCsv } from "../lib/strava/parseActivities.ts";

const fitPath = process.argv[2] ?? "export_105352925/activities/19494160905.fit.gz";

async function main() {
  const buf = readFileSync(fitPath);
  const bytes = inflate(new Uint8Array(buf));

  const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: "m/s",
      lengthUnit: "m",
      elapsedRecordField: true,
      mode: "cascade",
    });
    parser.parse(bytes, (err, d) => (err ? reject(err) : resolve(d ?? {})));
  });

  const records = (data.records as Record<string, unknown>[]) ?? [];
  const laps = (data.laps as unknown[]) ?? [];
  console.log("records:", records.length, "laps:", laps.length);
  if (records[0]) console.log("record[0] keys:", Object.keys(records[0]));
  const withSpeed = records.filter(
    (r) => r.enhanced_speed ?? r.speed
  ).length;
  const withHr = records.filter((r) => r.heart_rate).length;
  console.log("with speed:", withSpeed, "with hr:", withHr);

  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const detail = await parseFitFile(ab, "test");
  console.log("parsed bestEfforts:", detail.bestEfforts);
  console.log("parsed paceStream:", detail.paceStream.length);

  const csv = readFileSync("export_105352925/activities.csv", "utf-8");
  const { runs } = parseActivitiesCsv(csv);
  console.log("standalone 10k runs:");
  for (const r of runs) {
    const km = r.distanceM / 1000;
    if (km >= 9.5 && km <= 10.5) {
      console.log(" ", r.name, km, (r.movingSec / km / 60).toFixed(2), "min/km");
    }
  }
}

main();
