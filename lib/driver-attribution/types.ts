export type DriverImpact = "small" | "moderate" | "large";
export type DriverConfidence = "low" | "medium" | "high";

export interface AttributedDriver {
  driver: string;
  impact: DriverImpact;
  confidence: DriverConfidence;
  evidence: string[];
}

export interface DriverAttribution {
  phenomenon: string;
  likelyDrivers: AttributedDriver[];
  uncertainties: string[];
  summary: string;
}

export type AttributionTarget =
  "readiness" | "fatigue" | "forecast" | "efficiency" | "execution" | "pacing";
