import type { IntensityInference, NormalizedActivity, PerceivedIntensity } from "./types";

const HEAVY_KEYWORDS = [
  "heavy",
  "max",
  "pr",
  "squat",
  "deadlift",
  "hyrox",
  "wod",
  "amrap",
  "threshold",
  "tempo",
  "interval",
  "race",
];
const EASY_KEYWORDS = ["easy", "recovery", "mobility", "stretch", "yoga", "walk"];

function nameSignals(name: string): { high: boolean; low: boolean } {
  const n = name.toLowerCase();
  return {
    high: HEAVY_KEYWORDS.some((k) => n.includes(k)),
    low: EASY_KEYWORDS.some((k) => n.includes(k)),
  };
}

function hrLevel(
  avgHr: number | undefined,
  athleteMaxHr: number
): PerceivedIntensity | null {
  if (avgHr == null || athleteMaxHr <= 0) return null;
  const pct = avgHr / athleteMaxHr;
  if (pct >= 0.85) return "high";
  if (pct >= 0.72) return "moderate";
  return "low";
}

export function inferActivityIntensity(
  activity: Pick<
    NormalizedActivity,
    | "modality"
    | "sportType"
    | "movingTimeSec"
    | "avgHr"
    | "maxHr"
    | "name"
    | "isHardRun"
    | "power"
  >,
  athleteMaxHr = 190
): IntensityInference {
  const evidence: string[] = [];
  const { modality, movingTimeSec, avgHr, sportType, name } = activity;
  const names = nameSignals(name);

  if (modality === "mobility" || modality === "recovery") {
    return {
      level: "low",
      confidence: "medium",
      evidence: [`${modality} modality defaults to low intensity`],
    };
  }

  if (modality === "high_intensity_cross_training") {
    if (names.low) {
      return {
        level: "moderate",
        confidence: "low",
        evidence: ["Activity name suggests lighter session despite HIIT sport type"],
      };
    }
    return {
      level: "high",
      confidence: "medium",
      evidence: ["HIIT/CrossFit sport_type — fatigue context assumed high"],
    };
  }

  const hr = hrLevel(avgHr, athleteMaxHr);
  if (hr) {
    evidence.push(
      `Avg HR ${avgHr} (~${Math.round((avgHr! / athleteMaxHr) * 100)}% of max ${athleteMaxHr})`
    );
  }

  if (modality === "run") {
    if (activity.isHardRun) {
      evidence.push("Classified as quality/long run from workout labels");
      return { level: "high", confidence: "medium", evidence };
    }
    if (hr) return { level: hr, confidence: "medium", evidence };
    if (names.high) {
      return { level: "high", confidence: "low", evidence: [...evidence, "Name keywords suggest quality"] };
    }
    if (names.low) {
      return { level: "low", confidence: "low", evidence: [...evidence, "Name keywords suggest easy"] };
    }
    return {
      level: "moderate",
      confidence: "low",
      evidence: [...evidence, "No HR or label — moderate assumed"],
    };
  }

  if (modality === "strength") {
    if (names.high || movingTimeSec > 3600) {
      evidence.push(
        names.high ? "Name suggests heavy lifting" : "Duration > 60 min"
      );
      return { level: "high", confidence: "low", evidence };
    }
    if (movingTimeSec > 2400) {
      return {
        level: "moderate",
        confidence: "low",
        evidence: [...evidence, "Typical gym session duration"],
      };
    }
    return {
      level: "moderate",
      confidence: "low",
      evidence: ["Strength default moderate without set/rep data"],
    };
  }

  if (modality === "bike" || modality === "swim") {
    if (hr) return { level: hr, confidence: "medium", evidence };
    if (activity.power != null && activity.power > 200) {
      return {
        level: "moderate",
        confidence: "low",
        evidence: [`Power ${activity.power}W available`],
      };
    }
    if (movingTimeSec > 5400) {
      return {
        level: "moderate",
        confidence: "low",
        evidence: ["Long duration session"],
      };
    }
    return {
      level: "low",
      confidence: "low",
      evidence: [`${sportType} without HR — low-moderate assumed`],
    };
  }

  if (modality === "sport") {
    if (hr) return { level: hr, confidence: "medium", evidence };
    return {
      level: "moderate",
      confidence: "low",
      evidence: ["Sport session — mixed intensity, fatigue relevant"],
    };
  }

  if (isAerobicModality(modality)) {
    if (hr) return { level: hr, confidence: "medium", evidence };
    return {
      level: movingTimeSec > 3600 ? "moderate" : "low",
      confidence: "low",
      evidence: [`${sportType} cross-training duration-based estimate`],
    };
  }

  return {
    level: "unknown",
    confidence: "low",
    evidence: ["Insufficient signals for intensity inference"],
  };
}

function isAerobicModality(
  m: NormalizedActivity["modality"]
): m is "aerobic_cross_training" | "outdoor_endurance" {
  return m === "aerobic_cross_training" || m === "outdoor_endurance";
}

export function inferActivityPurpose(
  activity: Pick<
    NormalizedActivity,
    "modality" | "perceivedIntensity" | "name" | "sportType" | "isHardRun"
  >
): string {
  const { modality, perceivedIntensity, sportType } = activity;

  if (modality === "run") {
    return activity.isHardRun
      ? "Running quality or key endurance stimulus"
      : "Easy or aerobic running";
  }
  if (modality === "bike") {
    return perceivedIntensity === "high"
      ? "Cycling load — aerobic support with fatigue context"
      : "Cycling aerobic support without run impact";
  }
  if (modality === "swim") {
    return "Swim aerobic support — preserves run specificity for race predictions";
  }
  if (modality === "strength") {
    return perceivedIntensity === "high"
      ? "Heavy strength / durability loading"
      : "Strength maintenance or support work";
  }
  if (modality === "mobility") return "Mobility, tissue care, or recovery movement";
  if (modality === "recovery") return "Active recovery or easy movement";
  if (modality === "high_intensity_cross_training") {
    return "High-intensity non-run conditioning (fatigue context only)";
  }
  if (modality === "sport") return "Sport session — mixed intensity, fatigue relevant";
  if (modality === "outdoor_endurance") {
    return "Outdoor endurance — aerobic support, not run-equivalent";
  }
  if (modality === "aerobic_cross_training") {
    return perceivedIntensity === "low"
      ? "Low-impact aerobic support"
      : `${sportType} cross-training — supports endurance base`;
  }
  return "General training activity";
}
