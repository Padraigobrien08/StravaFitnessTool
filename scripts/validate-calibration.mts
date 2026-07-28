// Leg-feel calibration validator (offline, READ-ONLY).
//
// Answers "are the calibration weights any good on real data yet?" by replaying
// the exact production ladder over every athlete's history and reporting:
//   • coverage   — how many athletes even have enough data to leave the default
//   • signal     — where they do, do reports actually predict outcomes?
//   • weights    — what nudges real athletes receive, and are they within caps
//   • sensitivity — how coverage/trust move if we retune the gate or shrinkage
//
// It uses buildFeelCalibration() — the same code path computeInsights() runs —
// so what it measures is exactly what production would apply. It only issues
// SELECTs (via the app's DB loaders); it writes nothing.
//
// Run:  node --import ./scripts/lib-loader.mjs --env-file=.env.local scripts/validate-calibration.mts
//       add --json for machine-readable output.
import { getSql } from "../lib/db/client.ts";
import { buildStravaImportFromDb } from "../lib/db/activities.ts";
import { getAllFitDetailsForUser } from "../lib/db/activity-streams.ts";
import { getRecentLegFeel } from "../lib/db/leg-feel.ts";
import { buildFeelCalibration, type FeelCalibrationDiagnostics } from "../lib/analytics/index.ts";
import type { OutcomeSignal } from "../lib/wellness/outcomeCalibration.ts";

// Mirrors the constants in lib/wellness/outcomeCalibration.ts. Kept here only
// for the sensitivity sweep; the canonical numbers come from the real function.
const GATE = 6; // MIN_PAIRS — paired outcomes before deviating from the default
const PRIOR = 2; // Laplace prior strength
const SCALE_SENSITIVITY = 1.0;
const BASE_HEAVY = -12;
const BASE_FRESH = 5;
const HEAVY_CAP = -18;
const HEAVY_FLOOR = -6;
const FRESH_CAP = 8;
const FRESH_FLOOR = 3;
const DEFAULT_LOOKBACK_DAYS = 3650; // effectively "all history"

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Illustrative-only: what heavy/fresh deltas a (confirmed,pairs) count maps to. */
function mapDeltas(confirmed: number, pairs: number, prior: number, scaleSens: number) {
  const reliability = (confirmed + prior) / (pairs + 2 * prior);
  const scale = clamp(1 + (reliability - 0.5) * scaleSens, 0.5, 1.5);
  return {
    reliability,
    heavy: Math.round(clamp(BASE_HEAVY * scale, HEAVY_CAP, HEAVY_FLOOR)),
    fresh: Math.round(clamp(BASE_FRESH * scale, FRESH_FLOOR, FRESH_CAP)),
  };
}

interface AthleteResult {
  userId: string;
  runs: number;
  reports: number;
  diag: FeelCalibrationDiagnostics;
}

async function loadAthlete(userId: string): Promise<AthleteResult | null> {
  try {
    const imp = await buildStravaImportFromDb(userId, null);
    const [fitDetails, feelHistory] = await Promise.all([
      getAllFitDetailsForUser(userId),
      getRecentLegFeel(userId, DEFAULT_LOOKBACK_DAYS),
    ]);
    const diag = buildFeelCalibration(
      imp.runs,
      fitDetails,
      feelHistory,
      imp.profile.maxHeartRate ?? undefined,
    );
    return { userId, runs: imp.runs.length, reports: feelHistory.length, diag };
  } catch (e) {
    console.error(`  ! ${userId.slice(0, 8)}: ${(e as Error).message}`);
    return null;
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
}

function report(results: AthleteResult[]): Record<string, unknown> {
  const total = results.length;
  const withReports = results.filter((r) => r.reports > 0);
  const withDirectional = results.filter((r) => r.diag.directionalReports > 0);
  const withPairs = results.filter((r) => r.diag.pairs.pairs > 0);
  const gated = results.filter((r) => r.diag.pairs.pairs >= GATE);

  // Pooled evidence across the whole fleet.
  const pooledConfirmed = results.reduce((s, r) => s + r.diag.pairs.confirmed, 0);
  const pooledContradicted = results.reduce((s, r) => s + r.diag.pairs.contradicted, 0);
  const pooledPairs = pooledConfirmed + pooledContradicted;
  const signalTotals: Record<OutcomeSignal, number> = {
    execution: 0,
    "hr-drift": 0,
    efficiency: 0,
    "training-response": 0,
  };
  for (const r of results) {
    for (const k of Object.keys(signalTotals) as OutcomeSignal[]) {
      signalTotals[k] += r.diag.pairs.signalCounts[k];
    }
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  LEG-FEEL CALIBRATION — PRODUCTION VALIDATION");
  console.log("════════════════════════════════════════════════════════════\n");

  console.log("FLEET COVERAGE");
  console.log(`  athletes scanned .................. ${total}`);
  console.log(
    `  with ≥1 feel report ............... ${withReports.length}  (${pct(withReports.length, total)})`,
  );
  console.log(`  with ≥1 directional report ........ ${withDirectional.length}`);
  console.log(`  with ≥1 paired outcome ............ ${withPairs.length}`);
  console.log(
    `  clearing the gate (≥${GATE} pairs) ...... ${gated.length}  ← personalised, not on default\n`,
  );

  console.log("PREDICTIVE SIGNAL (pooled across all paired outcomes)");
  if (pooledPairs === 0) {
    console.log("  no paired outcomes yet — nothing to validate.\n");
  } else {
    const pooled = mapDeltas(pooledConfirmed, pooledPairs, PRIOR, SCALE_SENSITIVITY);
    console.log(
      `  confirmed / contradicted .......... ${pooledConfirmed} / ${pooledContradicted}  (raw ${pct(pooledConfirmed, pooledPairs)} predictive)`,
    );
    console.log(
      `  shrunk reliability ................ ${pooled.reliability.toFixed(3)}  (0.5 = chance)`,
    );
    console.log(
      `  → pooled nudge would be ........... heavy ${pooled.heavy} / fresh +${pooled.fresh}`,
    );
    console.log("  signal tier that decided each pair:");
    for (const k of Object.keys(signalTotals) as OutcomeSignal[]) {
      if (signalTotals[k] > 0)
        console.log(
          `     ${k.padEnd(18)} ${signalTotals[k]}  (${pct(signalTotals[k], pooledPairs)})`,
        );
    }
    console.log();
  }

  if (gated.length > 0) {
    console.log("PER-ATHLETE (gated only) — what production applies today");
    console.log("  user      runs  reports  pairs  reliab  heavy  fresh  dominant");
    for (const r of gated) {
      const c = r.diag.calibration;
      const dom = (Object.keys(r.diag.pairs.signalCounts) as OutcomeSignal[]).reduce((a, b) =>
        r.diag.pairs.signalCounts[b] > r.diag.pairs.signalCounts[a] ? b : a,
      );
      console.log(
        `  ${r.userId.slice(0, 8)}  ${String(r.runs).padStart(4)}  ${String(r.reports).padStart(7)}  ${String(r.diag.pairs.pairs).padStart(5)}  ${c.reliability.toFixed(2).padStart(6)}  ${String(c.heavyDelta).padStart(5)}  ${String("+" + c.freshDelta).padStart(5)}  ${dom}`,
      );
    }
    console.log();

    // Weight sanity: every gated athlete must sit inside the caps.
    const outOfBounds = gated.filter(
      (r) =>
        r.diag.calibration.heavyDelta < HEAVY_CAP ||
        r.diag.calibration.heavyDelta > HEAVY_FLOOR ||
        r.diag.calibration.freshDelta < FRESH_FLOOR ||
        r.diag.calibration.freshDelta > FRESH_CAP,
    );
    console.log("WEIGHT SANITY");
    console.log(
      outOfBounds.length === 0
        ? `  ✓ all ${gated.length} gated nudges within caps (heavy [${HEAVY_CAP},${HEAVY_FLOOR}], fresh [${FRESH_FLOOR},${FRESH_CAP}])\n`
        : `  ✗ ${outOfBounds.length} nudge(s) outside caps — investigate: ${outOfBounds.map((r) => r.userId.slice(0, 8)).join(", ")}\n`,
    );
  }

  console.log("SENSITIVITY — gate (how much data before anyone personalises)");
  for (const g of [4, 6, 8, 10]) {
    const n = results.filter((r) => r.diag.pairs.pairs >= g).length;
    console.log(
      `  MIN_PAIRS=${String(g).padStart(2)}  →  ${n} athlete(s) personalised${g === GATE ? "   ← current" : ""}`,
    );
  }
  if (pooledPairs > 0) {
    console.log("\nSENSITIVITY — shrinkage prior (pooled sample, illustrative)");
    for (const p of [1, 2, 4]) {
      const m = mapDeltas(pooledConfirmed, pooledPairs, p, SCALE_SENSITIVITY);
      console.log(
        `  PRIOR=${p}  →  reliability ${m.reliability.toFixed(3)}, heavy ${m.heavy} / fresh +${m.fresh}${p === PRIOR ? "   ← current" : ""}`,
      );
    }
  }

  console.log("\nVERDICT");
  if (gated.length === 0) {
    console.log("  Not enough real data to validate the weights yet: no athlete has");
    console.log(`  reached ${GATE} paired (report → outcome) observations, so the proven`);
    console.log("  default nudge (−12 / +5) is being applied fleet-wide — which is the");
    console.log("  intended graceful-degradation behaviour. Re-run once reporting");
    console.log("  history accrues (weeks of near-daily check-ins + logged runs).");
  } else if (pooledPairs > 0 && pooledConfirmed / pooledPairs >= 0.5) {
    console.log(
      `  Reports are predictive on real data (${pct(pooledConfirmed, pooledPairs)} pooled), and`,
    );
    console.log(`  ${gated.length} athlete(s) now earn a personalised nudge inside the caps.`);
    console.log("  Weights look sound; keep monitoring as the sample grows.");
  } else {
    console.log(
      `  Reports are NOT predictive on real data (${pct(pooledConfirmed, pooledPairs)} pooled < 50%).`,
    );
    console.log("  The bidirectional logic is correctly damping trust; review whether the");
    console.log("  outcome signals or the 0–2 day window match how athletes actually report.");
  }
  console.log("\n════════════════════════════════════════════════════════════\n");

  return {
    total,
    withReports: withReports.length,
    withDirectional: withDirectional.length,
    withPairs: withPairs.length,
    gated: gated.length,
    pooledConfirmed,
    pooledContradicted,
    signalTotals,
    perAthlete: results.map((r) => ({
      userId: r.userId,
      runs: r.runs,
      reports: r.reports,
      pairs: r.diag.pairs,
      calibration: r.diag.calibration,
    })),
  };
}

async function main() {
  const asJson = process.argv.includes("--json");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set — pass --env-file=.env.local");
    process.exit(1);
  }
  const sql = getSql();
  const rows = (await sql`SELECT id FROM users ORDER BY id`) as { id: string }[];
  if (!asJson) console.error(`Scanning ${rows.length} athlete(s)…`);

  const results: AthleteResult[] = [];
  for (const { id } of rows) {
    const r = await loadAthlete(id);
    if (r) results.push(r);
  }

  const summary = report(results);
  if (asJson) console.log(JSON.stringify(summary, null, 2));
}

await main();
