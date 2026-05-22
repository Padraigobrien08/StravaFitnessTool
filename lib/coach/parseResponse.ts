export interface ParsedCoachResponse {
  summary: string | null;
  why: string[];
  recommendation: string | null;
  confidence: string | null;
  evidence: string[];
  limitations: string[];
  followUps: string[];
  memoryNotes: string[];
  risks: string[];
  historicalComparison: string[];
  adaptation: string[];
  raw: string;
  isStructured: boolean;
}

const SECTION_ALIASES: Record<string, keyof Omit<ParsedCoachResponse, "raw" | "isStructured">> = {
  summary: "summary",
  why: "why",
  reasoning: "why",
  analysis: "why",
  recommendation: "recommendation",
  recommendations: "recommendation",
  confidence: "confidence",
  evidence: "evidence",
  limitations: "limitations",
  "missing data": "limitations",
  "follow-up": "followUps",
  "follow-ups": "followUps",
  followup: "followUps",
  followups: "followUps",
  related: "followUps",
  memory: "memoryNotes",
  "training memory": "memoryNotes",
  risks: "risks",
  "historical comparison": "historicalComparison",
  history: "historicalComparison",
  adaptation: "adaptation",
  "adaptation interpretation": "adaptation",
};

function parseBullets(block: string): string[] {
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, ""))
    .filter((l) => l.length > 0);
}

export function parseCoachResponse(content: string): ParsedCoachResponse {
  const result: ParsedCoachResponse = {
    summary: null,
    why: [],
    recommendation: null,
    confidence: null,
    evidence: [],
    limitations: [],
    followUps: [],
    memoryNotes: [],
    risks: [],
    historicalComparison: [],
    adaptation: [],
    raw: content,
    isStructured: false,
  };

  const sectionRegex = /^##\s+(.+)$/gim;
  const matches = [...content.matchAll(sectionRegex)];

  if (matches.length === 0) {
    const paragraphs = content.trim().split(/\n\n+/);
    result.summary = paragraphs[0]?.trim() || content.trim();
    return result;
  }

  result.isStructured = true;

  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim().toLowerCase();
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? content.length)
        : content.length;
    const body = content.slice(start, end).trim();
    const key =
      SECTION_ALIASES[title] ??
      SECTION_ALIASES[title.replace(/:$/, "")];

    if (!key) continue;

    if (key === "summary" || key === "recommendation" || key === "confidence") {
      result[key] = body.replace(/\n+/g, " ").trim() || null;
    } else if (
      key === "why" ||
      key === "evidence" ||
      key === "limitations" ||
      key === "followUps" ||
      key === "memoryNotes" ||
      key === "risks" ||
      key === "historicalComparison" ||
      key === "adaptation"
    ) {
      const bullets = parseBullets(body);
      result[key] = bullets.length > 0 ? bullets : body ? [body] : [];
    }
  }

  if (!result.summary && result.why.length > 0) {
    result.summary = result.why[0];
  }

  return result;
}
