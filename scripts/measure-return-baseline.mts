// Return-to-running baseline measurement (offline, READ-ONLY).
//
// `preGapBaseline` currently answers "what were you running just before you
// stopped" and the comeback card presents that as "your usual week" — the
// volume to rebuild toward. On the live account those are wildly different
// numbers: 11.1 km/wk from the four weeks before the gap, for an athlete whose
// strongest block was 138 km/4wk and who raced a 1:35 half ten weeks earlier.
//
// The four weeks before a gap are systematically the least representative weeks
// in a history, because people wind down before they stop. This script tests
// that hypothesis and scores candidate definitions against what athletes
// actually returned to after their previous gaps.
//
// Method: find every gap >= MIN_GAP_DAYS in each athlete's history. For each,
// compute the candidates from data strictly before the gap, and compare them to
// the observed truth — the volume the athlete actually sustained in the weeks
// after coming back. Gaps still in progress, or with too little history either
// side, are skipped and counted.
//
// Run: node --import ./scripts/lib-loader.mjs --env-file=.env.local scripts/measure-return-baseline.mts
//      add --json for machine-readable output.
import { getSql } from "../lib/db/client.ts";
import { buildStravaImportFromDb } from "../lib/db/activities.ts";
import type { RunActivity } from "../lib/strava/types.ts";
import { preGapBaseline } from "../lib/returning/returnToRunning.ts";

const MIN_GAP_DAYS = Number(process.env.MIN_GAP_DAYS ?? 10);
const PRE_HISTORY_WEEKS = Number(process.env.PRE_HISTORY_WEEKS ?? 16);
const POST_WEEKS = Number(process.env.POST_WEEKS ?? 8);
const MS_WEEK = 7 * 86400000;

const asJson = process.argv.includes("--json");
// Dates arrive from the DB as full ISO timestamps, so truncate to a UTC day:
// bucketing on raw timestamps would shift week boundaries by time of day.
const day = (iso: string) => {
  const t = Date.parse(iso);
  if (!isFinite(t)) throw new Error(`unparseable activity date: ${iso}`);
  return Math.floor(t / 86400000) * 86400000;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Weekly km totals across a span, with empty weeks counted as zero. */
function weeklyTotals(runs: RunActivity[], fromMs: number, toMs: number): number[] {
  const weeks = Math.max(0, Math.round((toMs - fromMs) / MS_WEEK));
  const out = new Array(weeks).fill(0);
  for (const r of runs) {
    const t = day(r.date);
    if (t < fromMs || t >= toMs) continue;
    const i = Math.floor((t - fromMs) / MS_WEEK);
    if (i >= 0 && i < weeks) out[i] += r.distanceM / 1000;
  }
  return out;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** Best sustained 4-week average anywhere in the pre-gap history. */
function bestBlock4wk(weekly: number[]): number {
  if (weekly.length < 4) return weekly.length ? Math.max(...weekly) : 0;
  let best = 0;
  for (let i = 0; i + 4 <= weekly.length; i++) {
    const avg = (weekly[i] + weekly[i + 1] + weekly[i + 2] + weekly[i + 3]) / 4;
    if (avg > best) best = avg;
  }
  return best;
}

interface Candidate {
  name: string;
  note: string;
  compute: (pre: number[], runs: RunActivity[], gapStartMs: number) => number;
}

const CANDIDATES: Candidate[] = [
  {
    name: "shipped",
    note: "median of the 4 pre-gap weeks, weeks without runs omitted (current)",
    // Calls the real function so the comparison is against production, not a
    // reimplementation that might disagree.
    compute: (_pre, runs, gapStartMs) => preGapBaseline(runs, new Date(gapStartMs))?.weeklyKm ?? 0,
  },
  {
    name: "zerofilled-4wk",
    note: "median of the 4 pre-gap weeks, empty weeks counted as 0",
    compute: (pre) => median(pre.slice(-4)),
  },
  {
    name: "median-12wk",
    note: "median of the 12 pre-gap weeks, zero-filled",
    compute: (pre) => median(pre.slice(-12)),
  },
  {
    name: "p75-12wk",
    note: "75th percentile of the 12 pre-gap weeks, zero-filled",
    compute: (pre) => percentile(pre.slice(-12), 0.75),
  },
  {
    name: "best4wk-26",
    note: "best sustained 4-week average in the last 26 weeks",
    compute: (pre) => bestBlock4wk(pre.slice(-26)),
  },
  {
    name: "best4wk-26-x0.8",
    note: "80% of the best sustained 4-week average (a deliberate haircut)",
    compute: (pre) => bestBlock4wk(pre.slice(-26)) * 0.8,
  },
  {
    name: "max-recent-vs-best",
    note: "higher of the zero-filled 4-week median and 80% of the best block",
    compute: (pre) => Math.max(median(pre.slice(-4)), bestBlock4wk(pre.slice(-26)) * 0.8),
  },
];

interface GapCase {
  userId: string;
  gapStart: string;
  gapDays: number;
  truth: number;
  estimates: Record<string, number>;
}

function findGapCases(
  userId: string,
  runs: RunActivity[],
  nowMs: number,
): {
  cases: GapCase[];
  skipped: { reason: string; count: number }[];
} {
  const sorted = [...runs].sort((a, b) => day(a.date) - day(b.date));
  const skips = new Map<string, number>();
  const skip = (r: string) => skips.set(r, (skips.get(r) ?? 0) + 1);
  const cases: GapCase[] = [];
  if (sorted.length < 2) return { cases: [], skipped: [] };

  const firstMs = day(sorted[0].date);

  for (let i = 1; i < sorted.length; i++) {
    const prevMs = day(sorted[i - 1].date);
    const nextMs = day(sorted[i].date);
    const gapDays = Math.round((nextMs - prevMs) / 86400000);
    if (gapDays < MIN_GAP_DAYS) continue;

    // The gap must have enough history behind it to judge a baseline from...
    if (prevMs - firstMs < PRE_HISTORY_WEEKS * MS_WEEK) {
      skip("insufficient pre-gap history");
      continue;
    }
    // ...and enough completed weeks after it to observe the return.
    if (nowMs - nextMs < POST_WEEKS * MS_WEEK) {
      skip("return still in progress");
      continue;
    }

    const preStart = prevMs - PRE_HISTORY_WEEKS * MS_WEEK;
    const pre = weeklyTotals(sorted, preStart, prevMs);
    const post = weeklyTotals(sorted, nextMs, nextMs + POST_WEEKS * MS_WEEK);

    // Truth: the level they settled back into. Week 1 is a ramp by definition
    // so it is dropped; the median of what follows avoids scoring a later build
    // phase as if it were the return level (p75 over 8 weeks did exactly that,
    // scoring a 35 km/wk build as the "return" from a 17 km/wk baseline).
    const truth = median(post.slice(1));
    if (truth <= 0) {
      skip("no running resumed in the observation window");
      continue;
    }

    const estimates: Record<string, number> = {};
    for (const c of CANDIDATES) {
      estimates[c.name] = round1(
        c.compute(
          pre,
          sorted.filter((r) => day(r.date) < nextMs),
          prevMs,
        ),
      );
    }

    cases.push({
      userId,
      gapStart: sorted[i - 1].date,
      gapDays,
      truth: round1(truth),
      estimates,
    });
  }

  return {
    cases,
    skipped: [...skips].map(([reason, count]) => ({ reason, count })),
  };
}

async function main() {
  const sql = getSql();
  const users = (await sql`SELECT id FROM users ORDER BY id`) as { id: string }[];
  const nowMs = Date.now();

  const allCases: GapCase[] = [];
  const allSkips = new Map<string, number>();
  let usersWithRuns = 0;

  for (const { id } of users) {
    const data = await buildStravaImportFromDb(id);
    const runs = data?.runs ?? [];
    if (runs.length === 0) continue;
    usersWithRuns++;
    const { cases, skipped } = findGapCases(id, runs, nowMs);
    allCases.push(...cases);
    for (const s of skipped) allSkips.set(s.reason, (allSkips.get(s.reason) ?? 0) + s.count);
  }

  // Score each candidate by how far it lands from what the athlete came back to.
  // Ratio error, not absolute: being 5 km out matters far more to a 15 km/wk
  // runner than to an 80 km/wk one.
  const scores = CANDIDATES.map((c) => {
    const ratios = allCases.map((g) => g.estimates[c.name] / g.truth).filter((r) => isFinite(r));
    const logErrs = ratios.filter((r) => r > 0).map((r) => Math.abs(Math.log(r)));
    return {
      name: c.name,
      note: c.note,
      n: ratios.length,
      medianRatio: round1(median(ratios) * 100) / 100,
      medianAbsLogErr: Math.round(median(logErrs) * 1000) / 1000,
      understatesBy2x: ratios.filter((r) => r < 0.5).length,
      overstatesBy2x: ratios.filter((r) => r > 2).length,
    };
  }).sort((a, b) => a.medianAbsLogErr - b.medianAbsLogErr);

  if (asJson) {
    console.log(JSON.stringify({ cases: allCases, scores, skips: [...allSkips] }, null, 2));
    return;
  }

  console.log(`\nathletes with runs: ${usersWithRuns} / ${users.length}`);
  console.log(`scorable gaps (>=${MIN_GAP_DAYS}d): ${allCases.length}`);
  for (const [reason, count] of allSkips) console.log(`  skipped ${count}: ${reason}`);

  if (allCases.length === 0) {
    console.log("\nNothing to score. Widen MIN_GAP_DAYS or shorten POST_WEEKS.");
    return;
  }

  console.log(`\nper-gap detail (truth = p75 weekly km in the ${POST_WEEKS} weeks after)`);
  for (const g of allCases) {
    const est = CANDIDATES.map((c) => `${c.name}=${g.estimates[c.name]}`).join("  ");
    console.log(`  ${g.gapStart}  gap ${g.gapDays}d  truth ${g.truth} km/wk`);
    console.log(`     ${est}`);
  }

  console.log(`\ncandidate scores (lower median|log ratio| is better)`);
  for (const s of scores) {
    console.log(
      `  ${s.name.padEnd(20)} err ${String(s.medianAbsLogErr).padEnd(6)} ` +
        `median est/truth ${String(s.medianRatio).padEnd(5)} ` +
        `<half ${s.understatesBy2x}  >double ${s.overstatesBy2x}`,
    );
    console.log(`     ${s.note}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
