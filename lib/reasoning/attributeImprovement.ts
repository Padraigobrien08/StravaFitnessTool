import { paceSecPerKm } from "@/lib/analytics/pace";
import { confidenceFromRuns } from "@/lib/intelligence/envelope";
import { parseISO, subWeeks } from "date-fns";
import { buildPhaseBlocks } from "./phaseBlocks";
import type {
  AttributeImprovementArgs,
  AttributeMetric,
  ReasoningContext,
  ReasoningResult,
} from "./types";

function outcomeAfterBlock(
  ctx: ReasoningContext,
  blockEnd: Date,
  metric: AttributeMetric
): number | null {
  const blockStart = subWeeks(blockEnd, 4);
  const followEnd = subWeeks(blockEnd, -4);
  const follow = ctx.runs.filter((r) => {
    const d = parseISO(r.date);
    return d > blockEnd && d <= followEnd;
  });
  if (follow.length === 0) return null;

  if (metric === "volume") {
    return follow.reduce((s, r) => s + r.distanceM / 1000, 0);
  }

  const paces: number[] = [];
  const effs: number[] = [];
  for (const r of follow) {
    const pace = paceSecPerKm(r);
    if (pace != null) paces.push(pace);
    if (pace != null && r.avgHr != null && r.avgHr >= 80) {
      effs.push(pace / r.avgHr);
    }
  }

  if (metric === "pace") {
    if (paces.length === 0) return null;
    return paces.reduce((a, b) => a + b, 0) / paces.length;
  }

  if (effs.length === 0) return null;
  return effs.reduce((a, b) => a + b, 0) / effs.length;
}

export function attributeImprovement(
  ctx: ReasoningContext,
  args: AttributeImprovementArgs = {}
): ReasoningResult<{
  metric: AttributeMetric;
  factors: {
    rank: number;
    description: string;
    association: string;
    evidence: string;
  }[];
  narrative: string;
}> {
  const metric = args.metric ?? "pace";
  const blocks = buildPhaseBlocks(ctx);

  const scored = blocks
    .map((block) => {
      const end = parseISO(block.weekEnd);
      const outcome = outcomeAfterBlock(ctx, end, metric);
      return { block, outcome };
    })
    .filter((x): x is { block: typeof blocks[0]; outcome: number } => x.outcome != null);

  if (scored.length < 2) {
    return {
      payload: {
        metric,
        factors: [],
        narrative:
          "Not enough historical blocks with follow-on data to attribute improvement.",
      },
      evidence: [],
      assumptions: [
        "Associates each 4-week block with outcomes in the following 4 weeks.",
      ],
      limitations: ["Need at least 8 weeks of varied training history."],
      confidence: "low",
    };
  }

  const bestOutcomes = [...scored].sort((a, b) => {
    if (metric === "pace") return a.outcome - b.outcome;
    if (metric === "efficiency") return a.outcome - b.outcome;
    return b.outcome - a.outcome;
  });
  const topBlocks = bestOutcomes.slice(0, Math.min(3, bestOutcomes.length));

  const avgRunsPerWeek =
    topBlocks.reduce((s, t) => s + t.block.runsPerWeek, 0) / topBlocks.length;
  const avgHard =
    topBlocks.reduce((s, t) => s + t.block.hardPct, 0) / topBlocks.length;
  const avgLongPct =
    topBlocks.reduce((s, t) => s + t.block.longRunPctOfVolume, 0) /
    topBlocks.length;

  const factors = [
    {
      rank: 1,
      description: `~${avgRunsPerWeek.toFixed(1)} runs per week`,
      association: "likely associated with better follow-on outcomes",
      evidence: topBlocks.map((t) => t.block.label).join(", "),
    },
    {
      rank: 2,
      description: `Hard-day share ~${avgHard.toFixed(0)}%`,
      association:
        avgHard <= 25
          ? "moderate intensity density"
          : "higher intensity concentration",
      evidence: `Hard % in top blocks: ${topBlocks.map((t) => `${t.block.hardPct}%`).join(", ")}`,
    },
    {
      rank: 3,
      description: `Long run ~${avgLongPct.toFixed(0)}% of block volume`,
      association: "long-run loading pattern",
      evidence: topBlocks
        .map((t) => `${t.block.longestRunKm} km longest`)
        .join("; "),
    },
  ];

  const metricLabel =
    metric === "pace"
      ? "pace at similar efforts"
      : metric === "efficiency"
        ? "aerobic efficiency (pace/HR)"
        : "follow-on volume";

  const narrative = `Periods that likely supported your best ${metricLabel} had ${factors[0].description}, ${factors[1].description}, and ${factors[2].description}. This is association from ${scored.length} historical blocks — not proven causation.`;

  return {
    payload: { metric, factors, narrative },
    evidence: topBlocks.map(
      (t) =>
        `Block ${t.block.label}: ${t.block.distanceKm} km, hard ${t.block.hardPct}% → strong follow-on ${metric}`
    ),
    assumptions: [
      "Outcome measured in the 4 weeks after each block ends.",
      "Correlation only — other life factors not modeled.",
    ],
    limitations:
      blocks.length < 6
        ? ["Limited block count — treat rankings as directional."]
        : [],
    confidence:
      blocks.length >= 8 ? "medium" : confidenceFromRuns(ctx.runs.length),
  };
}
