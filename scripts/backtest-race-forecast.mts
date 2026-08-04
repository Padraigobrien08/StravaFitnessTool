// Race-forecast backtest (offline, READ-ONLY).
//
// The Performance page projects a 2h 10m half for an athlete whose actual half,
// ten weeks earlier, was 1:44:17 — and quotes a band of 1:45–2:49 that does not
// contain it. This replays the forecast as it would have stood the day before
// each real race in the athlete's history, using only data available then, and
// compares the prediction to what they ran.
//
// Every race is held out: runs on or after race day are removed from the input,
// so nothing the model sees includes the result it is predicting.
//
// Run: node --import ./scripts/lib-loader.mjs --env-file=.env.local scripts/backtest-race-forecast.mts
import { getSql } from "../lib/db/client.ts";
import { buildStravaImportFromDb } from "../lib/db/activities.ts";
import { getAllFitDetailsForUser } from "../lib/db/activity-streams.ts";
import { computeInsights } from "../lib/analytics/index.ts";
import { buildRaceForecastInput } from "../lib/forecasting-v2/buildInput.ts";
import { buildRaceForecastV2 } from "../lib/forecasting-v2/forecastEngine.ts";
import type { RunActivity } from "../lib/strava/types.ts";
import type { RaceDistance } from "../lib/analytics/readiness.ts";

/** Distances we can score, with the tolerance that counts a run as that race. */
const RACE_BUCKETS: { distance: RaceDistance; km: number; tol: number }[] = [
  { distance: "5k", km: 5, tol: 0.4 },
  { distance: "10k", km: 10, tol: 0.6 },
  { distance: "hm", km: 21.0975, tol: 1.0 },
  { distance: "marathon", km: 42.195, tol: 1.5 },
];

const fmt = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(
    Math.round(s % 60),
  ).padStart(2, "0")}`;

/**
 * Races, not training runs. A parkrun-length effort inside a long run is not a
 * race, so this only counts activities whose name says they were one.
 */
const RACE_NAME = /\b(race|half|marathon|10k|5k|parkrun|championship|cup|classic)\b/i;

function findRaces(runs: RunActivity[]) {
  const out: { run: RunActivity; distance: RaceDistance; km: number }[] = [];
  for (const r of runs) {
    if (!RACE_NAME.test(r.name)) continue;
    const km = r.distanceM / 1000;
    const bucket = RACE_BUCKETS.find((b) => Math.abs(km - b.km) <= b.tol);
    if (!bucket) continue;
    out.push({ run: r, distance: bucket.distance, km });
  }
  return out;
}

async function main() {
  const sql = getSql();
  const users = (await sql`SELECT id FROM users ORDER BY id`) as { id: string }[];
  let scored = 0;

  for (const { id } of users) {
    const data = await buildStravaImportFromDb(id);
    const runs = data?.runs ?? [];
    if (runs.length === 0) continue;
    // The app feeds FIT laps/segments in, which is where the fastest efforts
    // come from; leaving them out would test a model production never runs.
    const allFit = await getAllFitDetailsForUser(id);

    for (const race of findRaces(runs)) {
      const raceMs = Date.parse(race.run.date);
      // Hold out the race itself and everything after it.
      const priorRunsRaw = runs.filter((r) => Date.parse(r.date) < raceMs);
      if (priorRunsRaw.length < 20) {
        console.log(`skip ${race.run.name}: only ${priorRunsRaw.length} prior runs`);
        continue;
      }

      // computeInsights measures recency against the wall clock, so replaying a
      // race from months ago made the model think the athlete had not run in 67
      // days and dock the forecast for it. Slide the whole history forward so
      // race day lands on today; every interval the model reasons about is
      // preserved, only the absolute dates move.
      const shiftMs = Date.now() - raceMs;
      const shift = (iso: string) => new Date(Date.parse(iso) + shiftMs).toISOString();
      const priorRuns = priorRunsRaw.map((r) => ({ ...r, date: shift(r.date) }));

      const priorIds = new Set(priorRuns.map((r) => r.id));
      const fitDetails = (allFit ?? []).filter((f: { activityId: string }) =>
        priorIds.has(f.activityId),
      );

      const held = { ...data, runs: priorRuns };
      const analytics = computeInsights(held, fitDetails);
      // Score the no-goal path too: that is what the Performance page runs for
      // an athlete who has not set a race, and it is where the fallback bites.
      const input = buildRaceForecastInput({
        analytics,
        runs: priorRuns,
        fitDetails,
        goal: null,
        fallbackDistance: race.distance,
      });
      if (!input) {
        console.log(`skip ${race.run.name}: no forecast input`);
        continue;
      }
      const f = buildRaceForecastV2(input);

      // The Performance page shows a different model: racePredictionAnalysis.
      // Score both, since the number the athlete complained about is that one.
      const cons = analytics.racePredictionAnalysis.consensus.find(
        (c: { distanceKm: number }) => Math.abs(c.distanceKm - race.km) <= 1.2,
      );

      const actual = race.run.movingSec;
      const pred = f.mostLikelyTimeSec;
      const lo = f.rangeSec?.[0] ?? f.optimisticTimeSec ?? pred;
      const hi = f.rangeSec?.[1] ?? f.conservativeTimeSec ?? pred;
      const inBand = actual >= lo && actual <= hi;
      const errPct = ((pred - actual) / actual) * 100;
      scored++;

      console.log(
        `\n${race.run.date.slice(0, 10)}  ${race.run.name}  (${race.distance}, ${race.km.toFixed(1)} km)`,
      );
      console.log(`  actual      ${fmt(actual)}`);
      console.log(
        `  predicted   ${fmt(pred)}   ${errPct >= 0 ? "+" : ""}${errPct.toFixed(1)}% ${
          errPct > 0 ? "(too slow)" : "(too fast)"
        }`,
      );
      console.log(
        `  band        ${fmt(lo)} – ${fmt(hi)}   ${inBand ? "contains" : "MISSES"} actual`,
      );
      console.log(`  prior runs  ${priorRuns.length} · fit details ${fitDetails.length}`);
      if (cons) {
        const cErr = ((cons.timeSec - actual) / actual) * 100;
        const cIn = actual >= cons.timeMin && actual <= cons.timeMax;
        console.log(
          `  [perf page] ${fmt(cons.timeSec)}   ${cErr >= 0 ? "+" : ""}${cErr.toFixed(1)}%   band ${fmt(cons.timeMin)} – ${fmt(cons.timeMax)}   ${cIn ? "contains" : "MISSES"}`,
        );
      } else {
        console.log("  [perf page] no consensus entry for this distance");
      }
      const pi = f.predictionIntervalSec;
      if (pi) {
        console.log(
          `  [v2 interval] ${fmt(pi.p25)} – ${fmt(pi.p75)}   ${actual >= pi.p25 && actual <= pi.p75 ? "contains" : "MISSES"}`,
        );
      }
      const uw = f.uncertaintyWidthSec ?? 0;
      const uLo = pred - uw / 2,
        uHi = pred + uw / 2;
      console.log(
        `  [v2 uncertainty] width ${fmt(uw)}   ${fmt(uLo)} – ${fmt(uHi)}   ${actual >= uLo && actual <= uHi ? "contains" : "MISSES"}`,
      );
      for (const d of f.derivation ?? []) {
        console.log(
          `    ${String(d.label).padEnd(20)} ${String(d.deltaSec >= 0 ? "+" : "") + d.deltaSec}s -> ${fmt(d.cumulativeSec)}   ${d.evidence ?? ""}`,
        );
      }
    }
  }

  if (scored === 0) console.log("\nNo races found to score.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
