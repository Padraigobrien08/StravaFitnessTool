// Recompute stored best efforts with the corrected extraction.
//
// The fix in lib/analytics/bestEfforts.ts applies at ingest, so rows already in
// activity_streams keep the values that produced a 1:35:11 half marathon for an
// athlete whose actual half was 1:44:17. This recomputes them in place from the
// pace stream and laps already stored — no Strava calls, no re-sync.
//
// DRY RUN BY DEFAULT. It prints what would change and writes nothing until you
// pass --write.
//
//   node --import ./scripts/lib-loader.mjs --env-file=.env.local scripts/backfill-best-efforts.mts
//   node --import ./scripts/lib-loader.mjs --env-file=.env.local scripts/backfill-best-efforts.mts --write
//
// Options:
//   --write        actually persist the recomputed efforts
//   --user <uuid>  restrict to one athlete
import { getSql } from "../lib/db/client.ts";
import { buildStravaImportFromDb } from "../lib/db/activities.ts";
import { getAllFitDetailsForUser, upsertFitDetail } from "../lib/db/activity-streams.ts";
import { computeAllBestEfforts } from "../lib/analytics/bestEfforts.ts";
import type { FitRunDetail } from "../lib/strava/fitTypes.ts";

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const ONLY_USER = argv[argv.indexOf("--user") + 1];
const onlyUser = argv.includes("--user") ? ONLY_USER : null;

const fmt = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(
    Math.round(s % 60),
  ).padStart(2, "0")}`;

type Effort = { key: string; timeSec: number };
const byKey = (efforts: Effort[]) => new Map(efforts.map((e) => [e.key, e]));

async function main() {
  const sql = getSql();
  const users = (await sql`SELECT id FROM users ORDER BY id`) as { id: string }[];
  const targets = onlyUser ? users.filter((u) => u.id === onlyUser) : users;
  if (onlyUser && targets.length === 0) {
    console.error(`No such user: ${onlyUser}`);
    process.exit(1);
  }

  let examined = 0;
  let changed = 0;
  let written = 0;
  const deltas: number[] = [];

  for (const { id } of targets) {
    const data = await buildStravaImportFromDb(id);
    // The activity's own distance is the anchor; without it the recomputation
    // would fall back to lap sums and could differ from what ingest will do.
    const distanceById = new Map((data?.runs ?? []).map((r) => [r.id, r.distanceM]));
    const details = await getAllFitDetailsForUser(id);

    for (const detail of details) {
      examined++;
      const totalDistanceM = distanceById.get(detail.activityId);
      const recomputed = computeAllBestEfforts(
        detail.paceStream ?? [],
        detail.laps ?? [],
        totalDistanceM,
      );

      const before = byKey((detail.bestEfforts ?? []) as Effort[]);
      const after = byKey(recomputed as Effort[]);
      const keys = new Set([...before.keys(), ...after.keys()]);
      const diffs: string[] = [];
      for (const k of keys) {
        const b = before.get(k);
        const a = after.get(k);
        if (!b && a) diffs.push(`${k}: — -> ${fmt(a.timeSec)}`);
        else if (b && !a) diffs.push(`${k}: ${fmt(b.timeSec)} -> removed`);
        else if (b && a && Math.abs(b.timeSec - a.timeSec) > 1) {
          diffs.push(`${k}: ${fmt(b.timeSec)} -> ${fmt(a.timeSec)}`);
          deltas.push(a.timeSec - b.timeSec);
        }
      }
      if (diffs.length === 0) continue;

      changed++;
      console.log(`${detail.activityId}  ${diffs.join("   ")}`);

      if (WRITE) {
        // The row is rewritten wholesale, so preserve every other field and
        // change only the efforts.
        const updated: FitRunDetail = { ...detail, bestEfforts: recomputed };
        await upsertFitDetail(id, Number(detail.activityId), updated);
        written++;
      }
    }
  }

  const slower = deltas.filter((d) => d > 0).length;
  console.log(
    `\nexamined ${examined} · would change ${changed}` + (WRITE ? ` · wrote ${written}` : ""),
  );
  if (deltas.length) {
    console.log(
      `of ${deltas.length} revised times, ${slower} got slower (the bug made efforts look faster than they were)`,
    );
  }
  if (!WRITE && changed > 0) {
    console.log("\nDry run — nothing written. Re-run with --write to persist.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
