import type { CoachWorkspaceState } from "./types";
import type { ActiveInvestigation } from "./types";

/** Proactive analytical entry points — not generic prompt chips. */
export function buildActiveInvestigations(
  state: Pick<
    CoachWorkspaceState,
    | "currentFocus"
    | "observations"
    | "domains"
    | "temporal"
    | "snapshot"
    | "lastAssistantSummary"
  >
): ActiveInvestigation[] {
  const out: ActiveInvestigation[] = [];
  const seen = new Set<string>();

  const push = (inv: ActiveInvestigation) => {
    const key = inv.question.slice(0, 40);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(inv);
  };

  if (state.lastAssistantSummary) {
    push({
      id: "continue",
      question: "Go deeper on the last conclusion",
      rationale: `Follow up: ${state.lastAssistantSummary.slice(0, 80)}…`,
      domain: state.currentFocus,
      priority: 12,
    });
  }

  for (const o of state.observations.filter((x) => x.tone === "warning").slice(0, 2)) {
    push({
      id: `obs-${o.id}`,
      question: `Why is ${o.domain.toLowerCase()} flagged right now?`,
      rationale: o.text,
      domain: o.domain,
      priority: 10,
    });
  }

  for (const d of state.domains.slice(0, 5)) {
    push({
      id: `dom-${d.id}`,
      question: d.suggestedQuery,
      rationale: d.liveInsight,
      domain: d.title,
      priority: d.priority,
    });
  }

  if (state.temporal.weekTransition) {
    push({
      id: "week",
      question: "Explain this week's volume shift vs last week",
      rationale: state.temporal.weekTransition,
      domain: "Training patterns",
      priority: 7,
    });
  }

  if (state.snapshot.daysToRace != null && state.snapshot.daysToRace <= 28) {
    push({
      id: "race",
      question: "What should I prioritize in the next 7 days before race?",
      rationale: state.temporal.raceCountdown ?? "Race approaching",
      domain: "Race prep",
      priority: 11,
    });
  }

  push({
    id: "fade",
    question: "Why do I fade after 15 km?",
    rationale: "Late-run execution pattern from historical fade analysis",
    domain: "Pacing",
    priority: 6,
  });

  push({
    id: "threshold",
    question: "Compare my last 3 threshold sessions",
    rationale: "Threshold density and execution consistency",
    domain: "Performance",
    priority: 8,
  });

  push({
    id: "hm-block",
    question: "What historically improved my HM pace most?",
    rationale: "Longitudinal block comparison",
    domain: "Long-term trends",
    priority: 7,
  });

  return out.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

export function buildContinuityLine(
  messages: import("./types").CoachMessage[],
  observations: CoachWorkspaceState["observations"]
): string | null {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastAssist = [...messages].reverse().find((m) => m.role === "assistant");
  if (lastAssist?.parsed?.summary && lastUser) {
    return `Continuing from your ${lastUser.content.slice(0, 48)}${lastUser.content.length > 48 ? "…" : ""} investigation.`;
  }
  const warn = observations.find((o) => o.tone === "warning");
  if (warn) {
    return `Active thread context: ${warn.text}`;
  }
  return null;
}
