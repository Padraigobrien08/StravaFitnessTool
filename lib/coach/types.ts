import type { ParsedCoachResponse } from "./parseResponse";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  toolsUsed?: string[];
  parsed?: ParsedCoachResponse;
  status?: "complete" | "error";
}

export interface CoachContextSnapshot {
  readinessScore: number | null;
  readinessLabel: string | null;
  freshness: number | null;
  fatigueLabel: string | null;
  tsb: number | null;
  raceLabel: string | null;
  daysToRace: number | null;
  projectedFinish: string | null;
  dataConfidence: "low" | "medium" | "high" | null;
  runCount: number;
  last7Km: number;
  /** Operational coaching state */
  currentFocus: string;
  adaptationTrend: "improving" | "stable" | "strained" | "unknown";
  adaptationLabel: string;
  riskLevel: "low" | "moderate" | "elevated";
  riskLabel: string;
  recommendationConfidence: "low" | "medium" | "high";
  blockSummary: string | null;
  archetypeLabel: string | null;
  modalityHeadline: string | null;
  weekLabel: string | null;
}

export type ObservationTone = "positive" | "neutral" | "warning" | "opportunity";

export interface ActiveObservation {
  id: string;
  text: string;
  tone: ObservationTone;
  domain: string;
  confidence: "low" | "medium" | "high";
  isNew?: boolean;
}

export interface CoachingDomain {
  id: string;
  title: string;
  subtitle: string;
  liveInsight: string;
  trendBadge: { label: string; tone: "up" | "down" | "flat" | "alert" } | null;
  memoryRef: string | null;
  suggestedQuery: string;
  priority: number;
}

export interface PinnedConclusion {
  id: string;
  title: string;
  summary: string;
  confidence: string | null;
  createdAt: string;
}

export interface RiskOpportunity {
  id: string;
  text: string;
  kind: "risk" | "opportunity";
  domain: string;
}

export interface ActiveInvestigation {
  id: string;
  question: string;
  rationale: string;
  domain: string;
  priority: number;
}

export interface CoachWorkspaceState {
  snapshot: CoachContextSnapshot;
  currentFocus: string;
  focusRationale: string;
  observations: ActiveObservation[];
  domains: CoachingDomain[];
  memory: import("./memorySnippets").MemorySnippet[];
  risksAndOpportunities: RiskOpportunity[];
  investigations: ActiveInvestigation[];
  temporal: {
    currentBlock: string | null;
    raceCountdown: string | null;
    weekTransition: string | null;
    fatigueRecovery: string | null;
  };
  pinnedFromThread: PinnedConclusion[];
  lastAssistantSummary: string | null;
  continuityLine: string | null;
}

export interface CoachPromptGroup {
  id: string;
  title: string;
  description: string;
  prompts: string[];
}
