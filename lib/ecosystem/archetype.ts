import type {
  ActivityModality,
  AthleteArchetype,
  AthleteArchetypeResult,
  ModalityCoverage,
  RollingEcosystemSnapshot,
} from "./types";

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

export function detectAthleteArchetype(
  rolling56: RollingEcosystemSnapshot | undefined,
  rolling84?: RollingEcosystemSnapshot,
): AthleteArchetypeResult {
  const snap = rolling56 ?? rolling84;
  if (!snap || snap.totalTrainingMinutes < 30) {
    return {
      archetype: "unknown",
      label: "Insufficient multi-modality data",
      confidence: "low",
      evidence: ["Less than 30 training minutes in rolling window"],
      coachingNotes: ["Sync Strava activities across sports for archetype detection."],
    };
  }

  const dist = snap.modalityDistribution ?? {};
  const totalSessions = Object.values(dist).reduce((s, n) => s + (n ?? 0), 0);
  const runPct = pct(dist.run ?? 0, totalSessions);
  const bikePct = pct(dist.bike ?? 0, totalSessions);
  const swimPct = pct(dist.swim ?? 0, totalSessions);
  const strengthPct = pct(dist.strength ?? 0, totalSessions);
  const hiitPct = pct(dist.high_intensity_cross_training ?? 0, totalSessions);
  const sportPct = pct(dist.sport ?? 0, totalSessions);

  const evidence = [
    `8-week mix (~${totalSessions} sessions): run ${Math.round(runPct)}%, bike ${Math.round(bikePct)}%, swim ${Math.round(swimPct)}%, strength ${Math.round(strengthPct)}%`,
  ];

  let archetype: AthleteArchetype = "unknown";
  let label = "Multisport profile";
  const coachingNotes: string[] = [];

  if (runPct >= 75 && strengthPct < 15 && hiitPct < 10) {
    archetype = "runner";
    label = "Run-focused endurance athlete";
    coachingNotes.push(
      "Recommendations prioritize run volume and quality; cross-training is contextual support.",
    );
  } else if (runPct >= 40 && bikePct >= 15 && swimPct >= 10) {
    archetype = "triathlete";
    label = "Triathlon / multisport endurance profile";
    coachingNotes.push(
      "Bike and swim add aerobic support — do not treat as wasted volume.",
      "Race predictions remain run-specific unless explicitly calibrated.",
    );
  } else if (bikePct >= 50 && runPct < 40) {
    archetype = "cyclist";
    label = "Cycling-dominant profile";
    coachingNotes.push(
      "Cycling may carry fatigue into run quality days — watch interference near key runs.",
    );
  } else if (strengthPct >= 20 && hiitPct >= 15 && runPct >= 25) {
    archetype = "strength_endurance";
    label = "Strength-endurance / HYROX-style profile";
    coachingNotes.push(
      "Account for gym and HIIT fatigue before adding run intensity.",
      "Do not recommend more running alone when strength/HIIT load is high.",
    );
  } else if (runPct >= 45 && (strengthPct >= 12 || hiitPct >= 10)) {
    archetype = "hybrid_runner";
    label = "Hybrid runner (run + strength/HIIT)";
    coachingNotes.push(
      "Respect gym fatigue; separate hard non-run work from quality runs.",
      "Strength supports durability — not equivalent to easy running volume.",
    );
  } else if (sportPct + (dist.unknown ?? 0) > totalSessions * 0.25) {
    archetype = "multisport";
    label = "Broad multisport profile";
    coachingNotes.push(
      "Multiple sport types present — use modality balance and interference tools.",
    );
  } else if (runPct >= 50) {
    archetype = "runner";
    label = "Primarily running";
  } else {
    archetype = "multisport";
    label = "Mixed modality athlete";
  }

  const confidence: "low" | "medium" | "high" =
    totalSessions >= 24 ? "medium" : totalSessions >= 12 ? "low" : "low";

  return { archetype, label, confidence, evidence, coachingNotes };
}

export function archetypeDisplayLabel(archetype: AthleteArchetype): string {
  const map: Record<AthleteArchetype, string> = {
    runner: "Runner",
    hybrid_runner: "Hybrid runner",
    triathlete: "Triathlete",
    cyclist: "Cyclist",
    strength_endurance: "Strength-endurance",
    multisport: "Multisport",
    unknown: "Unknown",
  };
  return map[archetype];
}

/** Coverage buckets for import UI */
export function modalityCoverageFromDistribution(
  dist: Partial<Record<ActivityModality, number>>,
): ModalityCoverage {
  const sum = (...keys: ActivityModality[]) => keys.reduce((s, k) => s + (dist[k] ?? 0), 0);
  const total = Object.values(dist).reduce((s, n) => s + (n ?? 0), 0);
  return {
    running: dist.run ?? 0,
    cycling: sum("bike"),
    swim: dist.swim ?? 0,
    strength: dist.strength ?? 0,
    mobilityRecovery: sum("mobility", "recovery"),
    hiitCrossfit: dist.high_intensity_cross_training ?? 0,
    outdoorEndurance: dist.outdoor_endurance ?? 0,
    sport: dist.sport ?? 0,
    unknown: dist.unknown ?? 0,
    total,
  };
}
