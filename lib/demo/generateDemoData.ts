/**
 * Deterministic synthetic demo athlete for zero-setup "Try the demo".
 *
 * `buildDemoImport(now)` returns a fully-formed {@link StravaImport} that
 * lights up the entire client-side analytics pipeline (Home, Training,
 * Performance, Goals, Runs, Reports, Intelligence) with NO Strava account,
 * database, or API key.
 *
 * Design goals (why the numbers are what they are):
 *  - ~12 months / 180+ runs  → "high" confidence tier in computeInsights.
 *  - A coherent periodised half-marathon build (base → build → sharpen) so
 *    trends, phase comparison and causality read as a real athlete improving.
 *  - Every run carries avgHr + trainingLoad + elevation + cadence so no panel
 *    falls back to "estimated from distance" or hides for lack of HR.
 *  - Recurring ~5K ("parkrun") and periodic ~10K efforts give the prediction
 *    engine and PR buckets real anchors.
 *  - Non-run activities (strength / cycling / swim / mobility) feed the
 *    multi-sport ecosystem + interference panels.
 *  - `fitFilename` is intentionally omitted — a client demo has no FIT files,
 *    and setting it would trigger a permanent "import your FIT files" warning.
 *
 * The generator is pure: given the same `now` it produces byte-identical
 * output (seeded PRNG, no Math.random / no ambient clock), so it is safe for
 * SSR and unit tests.
 */
import type {
  ActivitySummary,
  AthleteProfile,
  RunActivity,
  StravaImport,
} from "@/lib/strava/types";
import type { RaceGoal } from "@/lib/analytics/readiness";

export const DEMO_EXPORT_LABEL = "Demo athlete";

/** Half-marathon goal ~9 weeks out, sub-1:45 (used to populate readiness). */
export function demoRaceGoal(now: Date): RaceGoal {
  const raceDate = addDays(now, 63);
  return {
    distance: "hm",
    date: toIso(raceDate),
    targetTimeSec: 105 * 60, // 1:45:00
  };
}

// ---------------------------------------------------------------------------
// Deterministic RNG — mulberry32. Seeded per-run so output is reproducible.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Symmetric jitter in [-amount, +amount] from a seeded stream. */
function jitter(rng: () => number, amount: number): number {
  return (rng() * 2 - 1) * amount;
}

// ---------------------------------------------------------------------------
// Date helpers (pure given `now`).
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

/** ISO timestamp at a plausible early-morning local-ish hour. */
function toIso(d: Date, hour = 7, minute = 32): string {
  const withTime = new Date(d.getTime());
  withTime.setHours(hour, minute, 0, 0);
  return withTime.toISOString();
}

// ---------------------------------------------------------------------------
// Training model
// ---------------------------------------------------------------------------

type SessionKind = "easy" | "tempo" | "interval" | "long" | "parkrun" | "tenk";

interface SessionSpec {
  kind: SessionKind;
  /** day offset within the week (0 = Monday) */
  day: number;
  /** fraction of the week's volume this run represents (ignored for races) */
  share: number;
}

/**
 * A full 6-slot training week (Mon→Sun). Shares sum to 1.0 so a week's run
 * distances total the week's volume target. Actual weeks drop 1–2 slots for
 * realism (see `activeSlots`), so run counts vary 4–6 per week.
 */
const WEEK_TEMPLATE: SessionSpec[] = [
  { kind: "easy", day: 0, share: 0.13 },
  { kind: "tempo", day: 1, share: 0.15 },
  { kind: "easy", day: 2, share: 0.12 },
  { kind: "interval", day: 3, share: 0.12 },
  { kind: "parkrun", day: 5, share: 0.11 }, // steady/parkrun/10K depending on week
  { kind: "long", day: 6, share: 0.37 },
];

interface KindProfile {
  /** base pace (sec/km) at peak fitness for this athlete */
  paceSecPerKm: number;
  /** avg HR as fraction of max */
  hrFrac: number;
  cadence: number;
  /** elevation gain metres per km */
  elevPerKm: number;
  namePool: string[];
}

// HR fractions are calibrated to the app's zone model (maxHR 190):
// Z2 easy 60–70%, Z3 aerobic 70–80%, Z4 threshold 80–90%, Z5 90%+. Easy/long
// sit clearly below the 80% "hard" line so the easy/hard split reads ~80/20.
const KIND_PROFILES: Record<SessionKind, KindProfile> = {
  easy: {
    paceSecPerKm: 335,
    hrFrac: 0.65,
    cadence: 172,
    elevPerKm: 8,
    namePool: ["Easy run", "Morning easy run", "Aerobic base run", "Easy shakeout"],
  },
  tempo: {
    paceSecPerKm: 275,
    hrFrac: 0.84,
    cadence: 178,
    elevPerKm: 6,
    namePool: ["Tempo run", "Threshold session", "Tempo intervals", "Cruise intervals"],
  },
  interval: {
    paceSecPerKm: 245,
    hrFrac: 0.9,
    cadence: 181,
    elevPerKm: 5,
    namePool: ["Intervals 6x800m", "5x1km reps", "Track intervals", "VO2 repeats 8x400m"],
  },
  long: {
    paceSecPerKm: 318,
    hrFrac: 0.72,
    cadence: 175,
    elevPerKm: 11,
    namePool: ["Long run", "Sunday long run", "Endurance run", "Progression long run"],
  },
  parkrun: {
    paceSecPerKm: 255,
    hrFrac: 0.92,
    cadence: 184,
    elevPerKm: 6,
    namePool: ["parkrun 5K", "Saturday parkrun"],
  },
  tenk: {
    paceSecPerKm: 265,
    hrFrac: 0.9,
    cadence: 182,
    elevPerKm: 7,
    namePool: ["10K race", "10K time trial"],
  },
};

const TOTAL_WEEKS = 52;
const MAX_HR = 190;

/**
 * Weekly volume (km) target for each of the trailing 52 weeks.
 * index 0 = oldest (52 weeks ago), index 51 = current week.
 * Arc: base ~30 → aerobic build → steady mid-build plateau ~40 km into the
 * present (the goal race is still ~9 weeks out, so NO taper yet). Every 4th
 * week is a recovery/down week, but never the most recent week — that keeps
 * acute load ≈ chronic load, i.e. a realistic near-zero training balance.
 */
function weeklyVolumeTargets(): number[] {
  const targets: number[] = [];
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    let base: number;
    if (w < 16)
      base = 30 + w * 0.6; // base building 30 → ~39
    else if (w < 34)
      base = 40 + (w - 16) * 0.35; // aerobic build 40 → ~46
    else base = 43 + Math.sin((w - 34) / 2.5) * 3; // steady undulating plateau ~40–46
    // recovery/down week every 4th week, but not the current week
    if (w % 4 === 1 && w !== TOTAL_WEEKS - 1) base *= 0.75;
    targets.push(Math.round(base));
  }
  return targets;
}

/** Fitness improves over the year: paces get ~6% faster oldest → newest. */
function paceFactor(weekIndex: number): number {
  const progress = weekIndex / (TOTAL_WEEKS - 1); // 0..1
  return 1.06 - progress * 0.06;
}

function pick(pool: string[], rng: () => number): string {
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

interface BuiltRun {
  run: RunActivity;
  sportType: "Run" | "TrailRun";
}

function buildRun(
  kind: SessionKind,
  distanceKm: number,
  date: Date,
  weekIndex: number,
  seq: number,
  isTrail: boolean,
): BuiltRun {
  const rng = mulberry32(weekIndex * 1000 + seq * 7 + 13);
  const profile = KIND_PROFILES[kind];
  const pf = paceFactor(weekIndex);

  const km = round(distanceKm, 2);
  const distanceM = Math.round(km * 1000);

  const pace = profile.paceSecPerKm * pf * (1 + jitter(rng, 0.02));
  const movingSec = Math.round(km * pace);
  // small stoppage / traffic-light overhead
  const elapsedSec = Math.round(movingSec * (1 + 0.02 + rng() * 0.04));

  const hrFrac = profile.hrFrac + jitter(rng, 0.015);
  const avgHr = Math.round(MAX_HR * hrFrac);
  const maxHr = Math.min(MAX_HR, Math.round(avgHr * (1.06 + rng() * 0.05)));

  const durationMin = movingSec / 60;
  const intensity = hrFrac; // 0..1
  // Scaled so a normal training week sums to a credible chronic load (CTL),
  // which the app models as an EMA of weekly load (see fatigue.ts).
  const trainingLoad = Math.round(durationMin * intensity * intensity * 0.62);
  const relativeEffort = Math.round(trainingLoad * (0.9 + rng() * 0.2));

  const elevPerKm = profile.elevPerKm * (isTrail ? 3.2 : 1) * (1 + jitter(rng, 0.25));
  const elevationGainM = Math.max(0, Math.round(km * elevPerKm));

  const avgCadence = Math.round(profile.cadence + jitter(rng, 2.5));
  const calories = Math.round(km * 62 + durationMin * 1.5);

  const name = isTrail && kind === "long" ? "Trail long run" : pick(profile.namePool, rng);
  const id = `demo-${toDateStamp(date)}-${seq}`;

  const run: RunActivity = {
    id,
    date: toIso(date),
    name,
    distanceM,
    elapsedSec,
    movingSec,
    avgSpeedMps: null,
    maxSpeedMps: null,
    avgHr,
    maxHr,
    elevationGainM,
    calories,
    relativeEffort,
    trainingLoad,
    gradeAdjustedPaceSecPerKm: null,
    avgCadence,
    totalSteps: null,
    weatherTempC: null,
  };

  return { run, sportType: isTrail ? "TrailRun" : "Run" };
}

function toDateStamp(d: Date): string {
  return toIso(d).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Cross-training (feeds the ecosystem / interference panels)
// ---------------------------------------------------------------------------

interface CrossSpec {
  type: string; // canonical Strava sport_type
  day: number;
  name: string;
  distanceKm: number;
  minutes: number;
  hrFrac: number | null;
  watts?: number;
}

/** Weekly cross-training rotation, layered onto the most recent ~16 weeks. */
const CROSS_TEMPLATE: CrossSpec[] = [
  {
    type: "WeightTraining",
    day: 1,
    name: "Strength & core",
    distanceKm: 0,
    minutes: 45,
    hrFrac: 0.55,
  },
  {
    type: "Ride",
    day: 4,
    name: "Zone 2 spin",
    distanceKm: 32,
    minutes: 68,
    hrFrac: 0.68,
    watts: 165,
  },
  {
    type: "WeightTraining",
    day: 4,
    name: "Lower-body strength",
    distanceKm: 0,
    minutes: 40,
    hrFrac: 0.56,
  },
];

/** Less frequent extras for modality variety. */
const CROSS_EXTRAS: CrossSpec[] = [
  { type: "Swim", day: 2, name: "Recovery swim", distanceKm: 1.6, minutes: 38, hrFrac: 0.6 },
  { type: "Yoga", day: 6, name: "Mobility & yoga", distanceKm: 0, minutes: 30, hrFrac: null },
];

function buildCross(spec: CrossSpec, date: Date, seq: number): ActivitySummary {
  const rng = mulberry32(seq * 31 + 99);
  const minutes = Math.round(spec.minutes * (1 + jitter(rng, 0.1)));
  const elapsedSec = minutes * 60;
  const distanceM = Math.round(spec.distanceKm * 1000 * (1 + jitter(rng, 0.08)));
  const avgHr = spec.hrFrac === null ? null : Math.round(MAX_HR * spec.hrFrac + jitter(rng, 4));
  return {
    id: `demo-x-${toDateStamp(date)}-${seq}`,
    date: toIso(date, 18, 15),
    name: spec.name,
    type: spec.type,
    distanceM,
    elapsedSec,
    movingSec: elapsedSec,
    avgHr,
    maxHr: avgHr === null ? null : Math.min(MAX_HR, avgHr + 18),
    calories: Math.round(minutes * 8),
    elevationGainM: spec.type === "Ride" ? Math.round(spec.distanceKm * 9) : 0,
    avgCadence: null,
    avgWatts: spec.watts ?? null,
    trainer: spec.type === "Ride" ? false : undefined,
  };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Which template slots the athlete actually ran this week. Real athletes miss
 * sessions: recovery weeks drop the hard midweek work, most weeks drop the
 * second easy run, and two weeks a year are heavily disrupted (travel/illness).
 */
function activeSlots(w: number): SessionSpec[] {
  if (w === 20 || w === 41) {
    // disrupted week — just a token easy run + the long run
    return WEEK_TEMPLATE.filter((s) => (s.kind === "easy" && s.day === 0) || s.kind === "long");
  }
  const isDown = w % 4 === 1 && w !== TOTAL_WEEKS - 1;
  return WEEK_TEMPLATE.filter((spec) => {
    if (isDown) {
      // recovery week: easy volume + long only, no hard sessions
      if (spec.kind === "interval" || spec.kind === "tempo") return false;
      if (spec.kind === "easy" && spec.day === 2) return false;
      return true;
    }
    // ~80/20 easy:hard — both easy runs + long every week, plus exactly one
    // quality session that alternates tempo/intervals week to week.
    if (spec.kind === "tempo") return w % 2 === 0;
    if (spec.kind === "interval") return w % 2 === 1;
    return true;
  });
}

export function buildDemoImport(now: Date): StravaImport {
  const volumeTargets = weeklyVolumeTargets();
  const runs: RunActivity[] = [];
  const allActivities: ActivitySummary[] = [];
  let seq = 0;

  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const weeksAgo = TOTAL_WEEKS - 1 - w; // w=51 → 0 weeks ago (current)
    const weeklyKm = volumeTargets[w];
    // Monday of this week, relative to `now`.
    const mondayDaysAgo = weeksAgo * 7 + 6; // Sunday is `weeksAgo*7`, Monday 6 days earlier
    const slots = activeSlots(w);

    for (const spec of slots) {
      const daysAgo = mondayDaysAgo - spec.day;
      if (daysAgo < 0) continue; // don't place runs in the future
      const date = addDays(now, -daysAgo);

      // Saturday slot: occasional parkrun (every 3rd wk) / 10K race (every 6th wk),
      // otherwise a steady easy run. Shares are normalised over active slots so
      // the week's distances still sum to roughly the volume target.
      let kind = spec.kind;
      let distanceKm: number;
      let isTrail = false;

      if (spec.kind === "parkrun") {
        if (w % 6 === 2) {
          kind = "tenk";
          distanceKm = 10.0 + jitterKm(w, 0.05);
        } else if (w % 3 === 0) {
          kind = "parkrun";
          distanceKm = 5.0 + jitterKm(w, 0.04);
        } else {
          kind = "easy";
          distanceKm = weeklyKm * spec.share;
        }
      } else {
        distanceKm = weeklyKm * spec.share;
        if (spec.kind === "long") {
          // Cap the all-time longest around 16.5 km; trail long run every 5th wk.
          distanceKm = Math.min(distanceKm, 16.5);
          isTrail = w % 5 === 4;
        }
      }

      if (distanceKm < 2) continue;
      const built = buildRun(kind, distanceKm, date, w, seq, isTrail);
      runs.push(built.run);
      allActivities.push(runToSummary(built.run, built.sportType));
      seq++;
    }

    // Cross-training on the most recent ~16 weeks.
    if (weeksAgo <= 15) {
      for (const spec of CROSS_TEMPLATE) {
        const daysAgo = mondayDaysAgo - spec.day;
        if (daysAgo < 0) continue;
        allActivities.push(buildCross(spec, addDays(now, -daysAgo), seq++));
      }
      // extras roughly every other week
      if (weeksAgo % 2 === 0) {
        for (const spec of CROSS_EXTRAS) {
          const daysAgo = mondayDaysAgo - spec.day;
          if (daysAgo < 0) continue;
          allActivities.push(buildCross(spec, addDays(now, -daysAgo), seq++));
        }
      }
    }
  }

  runs.sort((a, b) => a.date.localeCompare(b.date));
  allActivities.sort((a, b) => a.date.localeCompare(b.date));

  const profile: AthleteProfile = {
    maxHeartRate: MAX_HR,
    athleteType: "runner",
    ftp: null,
    measurementPreference: "meters",
  };

  return {
    runs,
    profile,
    goals: [],
    allActivities,
    importedAt: now.toISOString(),
    exportLabel: DEMO_EXPORT_LABEL,
    fitRunIds: [],
  };
}

/** Deterministic small km jitter keyed to week (keeps races off exact 5.00). */
function jitterKm(week: number, amount: number): number {
  const rng = mulberry32(week * 17 + 3);
  return jitter(rng, amount);
}

function runToSummary(run: RunActivity, sportType: "Run" | "TrailRun"): ActivitySummary {
  return {
    id: run.id,
    date: run.date,
    name: run.name,
    type: sportType,
    distanceM: run.distanceM,
    elapsedSec: run.elapsedSec,
    movingSec: run.movingSec,
    avgHr: run.avgHr,
    maxHr: run.maxHr,
    calories: run.calories,
    elevationGainM: run.elevationGainM,
    avgCadence: run.avgCadence,
  };
}
