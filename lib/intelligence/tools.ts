import { simulateRaceStrategy, type StrategyMode } from "@/lib/analytics/raceStrategy";
import { WORKOUT_TYPE_LABELS } from "@/lib/analytics/workoutType";
import { formatDuration, formatPace } from "@/lib/utils";
import { countRunsMissingStreams, countStreamsForUser } from "@/lib/db/activity-streams";
import { buildGoalsPageView } from "@/lib/goals/viewModels";
import { buildTrainingPageView } from "@/lib/training/viewModels";
import {
  buildFullEcosystemCoachPayload,
  compareModalityBlocks,
  getAthleteArchetypePayload,
  getCrossTrainingSupport,
  getInterferenceRisks,
  getModalityDistribution,
  getRaceWeekInterferenceCheck,
  getStrengthMobilitySupport,
  getTrainingEcosystemSummary,
  parseEcosystemWindow,
} from "@/lib/ecosystem/coachTools";
import type {
  CompareModalityBlocksArgs,
  EcosystemWindowArgs,
  RaceWeekInterferenceArgs,
} from "./types";
import { buildReasoningContext } from "@/lib/reasoning/context";
import {
  analyzeFadePattern,
  attributeImprovement,
  compareSessions,
  explainReadinessDelta,
  findBestPhase,
  prContext,
} from "@/lib/reasoning";
import { buildAthleteMemoryProfile, serializeMemoryForCoachAnswer } from "@/lib/athlete-memory";
import { executeGenerateNextWeekTrainingPlan, planToolPayload } from "@/lib/ai-planning/planTool";
import { buildRunCoachDetail } from "@/lib/coaching-context";
import { buildIntelligenceBrief } from "./brief";
import { wrapIntelligence, wrapReasoning } from "./envelope";
import { computeAthleteIntelligence, resolveIntelligenceContext } from "./service";
import type {
  AnalyzeFadePatternToolArgs,
  AthleteIntelligenceBundle,
  AttributeImprovementToolArgs,
  CompareSessionsToolArgs,
  ExplainReadinessDeltaToolArgs,
  FindBestPhaseToolArgs,
  GenerateNextWeekTrainingPlanArgs,
  GetRaceStrategyArgs,
  IntelligenceContext,
  IntelligenceToolName,
  GetRunDetailArgs,
  ListRecentRunsArgs,
  PrContextToolArgs,
  ToolCallInput,
} from "./types";

let bundleCache: {
  key: string;
  bundle: AthleteIntelligenceBundle;
  at: number;
} | null = null;

const CACHE_MS = 60_000;

async function getBundle(ctx: IntelligenceContext): Promise<AthleteIntelligenceBundle> {
  const key = `${ctx.userId}:${ctx.raceGoal?.date ?? ""}:${ctx.raceGoal?.distance ?? ""}`;
  if (bundleCache && bundleCache.key === key && Date.now() - bundleCache.at < CACHE_MS) {
    return bundleCache.bundle;
  }
  const bundle = await computeAthleteIntelligence(ctx);
  bundleCache = { key, bundle, at: Date.now() };
  return bundle;
}

export async function executeIntelligenceTool(ctx: IntelligenceContext, call: ToolCallInput) {
  const bundle = await getBundle(ctx);
  const resolved = await resolveIntelligenceContext(ctx.userId, ctx);
  const { analytics, insights, quality } = bundle;
  const raceGoal = resolved.raceGoal ?? null;

  switch (call.name) {
    case "get_coach_brief": {
      const brief = buildIntelligenceBrief(analytics, insights, quality, raceGoal);
      return wrapIntelligence(brief, quality);
    }

    case "get_readiness": {
      const goals = buildGoalsPageView(analytics, raceGoal, insights);
      const r = analytics.raceReadiness ?? analytics.halfMarathonReadiness;
      return wrapIntelligence(
        {
          score: r.score,
          label: r.label,
          distanceLabel: goals.targetDistanceLabel,
          daysUntilRace: analytics.raceReadiness?.daysUntilRace ?? null,
          probabilityBand: analytics.raceReadiness?.probabilityBand ?? null,
          gaps: analytics.raceReadiness?.gaps?.length
            ? analytics.raceReadiness.gaps
            : goals.risks.slice(0, 3).map((x) => ({
                metric: x.title,
                current: x.evidence,
                target: x.mitigation,
              })),
          strongestSignal: goals.hero.strongestSignal,
          largestRisk: goals.hero.biggestLimiter,
        },
        quality,
      );
    }

    case "get_predictions": {
      const analysis = analytics.racePredictionAnalysis;
      return wrapIntelligence(
        {
          confidence: analysis.confidence,
          explanation: analysis.explanation,
          primaryAnchor: analysis.primaryAnchor
            ? {
                runName: analysis.primaryAnchor.runName,
                time: formatDuration(analysis.primaryAnchor.timeSec),
                distanceKm: analysis.primaryAnchor.distanceKm,
              }
            : null,
          consensus: analysis.consensus.map((c) => ({
            label: c.label,
            time: formatDuration(c.timeSec),
            range:
              c.spreadSec > 45
                ? `${formatDuration(c.timeMin)} – ${formatDuration(c.timeMax)}`
                : null,
            pace: formatPace(c.timeSec / c.distanceKm),
          })),
        },
        quality,
      );
    }

    case "get_week_plan": {
      const plan = analytics.nextWeekPlan;
      return wrapIntelligence(
        {
          weekLabel: plan.weekLabel,
          weekStart: plan.weekStart,
          template: plan.template,
          totalKmRange: plan.totalKmRange,
          rationale: plan.rationale,
          warnings: plan.warnings.filter((w) => !w.includes("Not a substitute")),
          sessions: plan.sessions.map((s) => ({
            day: s.day,
            type: s.type,
            typeLabel: WORKOUT_TYPE_LABELS[s.type],
            description: s.description,
            distanceKmRange: s.distanceKmRange,
          })),
        },
        quality,
        [
          analytics.raceReadiness
            ? `Race in ${analytics.raceReadiness.daysUntilRace} days`
            : "No race goal on server",
        ],
      );
    }

    case "get_race_strategy": {
      const mode = ((call.arguments as GetRaceStrategyArgs)?.mode ?? "even") as StrategyMode;
      if (!raceGoal) {
        return wrapIntelligence(
          { error: "No race goal set — set goal on Goals page or sync preferences." },
          quality,
          [],
          ["Race strategy requires a race goal with date and distance."],
        );
      }
      const strategy = simulateRaceStrategy(
        raceGoal,
        analytics.racePredictionAnalysis,
        analytics.fatigue,
        analytics.raceReadiness,
        mode,
      );
      if (!strategy) {
        return wrapIntelligence(
          { error: "Could not build strategy — need predictions for this distance." },
          quality,
        );
      }
      return wrapIntelligence(
        {
          mode,
          targetTime: formatDuration(strategy.targetTimeSec),
          fadeRisk: strategy.fadeRisk,
          narrative: strategy.narrative,
          warnings: strategy.warnings,
          splits: strategy.splits.map((s) => ({
            km: s.km,
            pace: formatPace(s.paceSecPerKm),
            cumulative: formatDuration(s.cumulativeSec),
          })),
        },
        quality,
      );
    }

    case "get_fatigue_load": {
      const training = buildTrainingPageView(analytics, insights);
      return wrapIntelligence(
        {
          freshness: analytics.fatigue.freshness,
          label: analytics.fatigue.label,
          tsb: analytics.fatigue.tsb,
          ctl: analytics.fatigue.ctl,
          atl: analytics.fatigue.atl,
          trendNote: training.load.trendNote,
          interpretation: training.load.interpretation,
          recentLoad: analytics.loadHistory.slice(-6),
        },
        quality,
      );
    }

    case "list_recent_runs": {
      const limit = Math.min(20, Math.max(1, (call.arguments as ListRecentRunsArgs)?.limit ?? 10));
      const runs = bundle.recentRuns.slice(0, limit).map((r) => ({
        ...r,
        typeLabel: WORKOUT_TYPE_LABELS[r.type as keyof typeof WORKOUT_TYPE_LABELS] ?? r.type,
      }));
      return wrapIntelligence({ runs }, quality);
    }

    case "get_run_detail": {
      const args = (call.arguments ?? {}) as GetRunDetailArgs;
      const fitById = new Map(bundle.fitDetails.map((f) => [f.activityId, f]));
      let run = args.runId != null ? bundle.runs.find((r) => r.id === args.runId) : undefined;
      if (!run && args.date) {
        const day = args.date.slice(0, 10);
        run = bundle.runs.find((r) => r.date.slice(0, 10) === day);
      }
      if (!run) {
        return wrapIntelligence(
          {
            error: "Run not found — pass runId from list_recent_runs or a YYYY-MM-DD date.",
          },
          quality,
          [],
          ["Use list_recent_runs to see available runId values."],
        );
      }
      const detail = buildRunCoachDetail(run, fitById.get(run.id) ?? null, analytics, bundle.runs);
      return wrapIntelligence({ run: detail }, quality);
    }

    case "get_data_quality": {
      return wrapIntelligence(
        {
          runCount: quality.runCount,
          activityCount: quality.activityCount,
          fitParsed: quality.fitParsed,
          fitReferenced: quality.fitReferenced,
          fieldCoverage: quality.fieldCoverage,
          warnings: quality.warnings,
          overallConfidence: quality.overallConfidence,
        },
        quality,
      );
    }

    case "get_connection_status": {
      const streams = await countStreamsForUser(ctx.userId);
      const missing = await countRunsMissingStreams(ctx.userId);
      return wrapIntelligence(
        {
          connected: true,
          runs: quality.runCount,
          streams,
          runsMissingStreams: missing,
        },
        quality,
      );
    }

    case "compare_sessions": {
      const rctx = buildReasoningContext(bundle, raceGoal);
      const args = (call.arguments ?? {}) as CompareSessionsToolArgs;
      return wrapReasoning(compareSessions(rctx, { type: args.type, n: args.n }), quality);
    }

    case "explain_readiness_delta": {
      const rctx = buildReasoningContext(bundle, raceGoal);
      const args = (call.arguments ?? {}) as ExplainReadinessDeltaToolArgs;
      return wrapReasoning(explainReadinessDelta(rctx, { weeks: args.weeks }), quality);
    }

    case "find_best_phase": {
      const rctx = buildReasoningContext(bundle, raceGoal);
      const args = (call.arguments ?? {}) as FindBestPhaseToolArgs;
      return wrapReasoning(findBestPhase(rctx, { metric: args.metric }), quality);
    }

    case "attribute_improvement": {
      const rctx = buildReasoningContext(bundle, raceGoal);
      const args = (call.arguments ?? {}) as AttributeImprovementToolArgs;
      return wrapReasoning(attributeImprovement(rctx, { metric: args.metric }), quality);
    }

    case "analyze_fade_pattern": {
      const rctx = buildReasoningContext(bundle, raceGoal);
      const args = (call.arguments ?? {}) as AnalyzeFadePatternToolArgs;
      return wrapReasoning(analyzeFadePattern(rctx, { distanceKm: args.distanceKm }), quality);
    }

    case "pr_context": {
      const rctx = buildReasoningContext(bundle, raceGoal);
      const args = (call.arguments ?? {}) as PrContextToolArgs;
      return wrapReasoning(prContext(rctx, { bucket: args.bucket, runId: args.runId }), quality);
    }

    case "get_training_ecosystem": {
      return wrapIntelligence(buildFullEcosystemCoachPayload(analytics, raceGoal), quality);
    }

    case "get_training_ecosystem_summary": {
      const w = parseEcosystemWindow(call.arguments as EcosystemWindowArgs);
      return wrapIntelligence(getTrainingEcosystemSummary(analytics, w), quality);
    }

    case "get_modality_distribution": {
      const w = parseEcosystemWindow(call.arguments as EcosystemWindowArgs);
      return wrapIntelligence(getModalityDistribution(analytics, w), quality);
    }

    case "get_cross_training_support": {
      const w = parseEcosystemWindow(call.arguments as EcosystemWindowArgs);
      return wrapIntelligence(getCrossTrainingSupport(analytics, w), quality);
    }

    case "get_interference_risks": {
      const w = parseEcosystemWindow(call.arguments as EcosystemWindowArgs);
      return wrapIntelligence(getInterferenceRisks(analytics, w), quality);
    }

    case "get_athlete_archetype": {
      return wrapIntelligence(getAthleteArchetypePayload(analytics), quality);
    }

    case "compare_modality_blocks": {
      const args = (call.arguments ?? {}) as CompareModalityBlocksArgs;
      return wrapIntelligence(
        compareModalityBlocks(analytics, args.blockADays ?? 28, args.blockBDays ?? 28),
        quality,
      );
    }

    case "get_race_week_interference_check": {
      const args = (call.arguments ?? {}) as RaceWeekInterferenceArgs;
      return wrapIntelligence(getRaceWeekInterferenceCheck(analytics, args.goalId), quality);
    }

    case "get_strength_mobility_support": {
      const w = parseEcosystemWindow(call.arguments as EcosystemWindowArgs);
      return wrapIntelligence(getStrengthMobilitySupport(analytics, w <= 14 ? 14 : 28), quality);
    }

    case "get_athlete_memory": {
      const profile = buildAthleteMemoryProfile(analytics, ctx.userId);
      const topic = (call.arguments as { topic?: string })?.topic;
      const answer = serializeMemoryForCoachAnswer(
        profile,
        topic === "fatigue" ||
          topic === "adaptation" ||
          topic === "pacing" ||
          topic === "taper" ||
          topic === "modality"
          ? topic
          : "all",
      );
      return wrapIntelligence(
        {
          summary: answer,
          beliefCount:
            profile.adaptationPatterns.length +
            profile.fatiguePatterns.length +
            profile.pacingPatterns.length,
          generatedAt: profile.generatedAt,
        },
        quality,
      );
    }

    case "generate_next_week_training_plan": {
      const args = (call.arguments ?? {}) as GenerateNextWeekTrainingPlanArgs;
      const result = await executeGenerateNextWeekTrainingPlan(ctx, {
        goalId: args.goalId,
        windowDays: args.windowDays,
        planPreference: args.planPreference,
        availableDays: args.availableDays,
        constraints: args.constraints,
        planningContext: args.planningContext,
      });
      return wrapIntelligence(
        planToolPayload(result),
        quality,
        result.plan.rationale.evidenceUsed,
        result.plan.limitations,
      );
    }

    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}

export const INTELLIGENCE_TOOL_DEFINITIONS = [
  {
    name: "get_coach_brief",
    description:
      "Get a compact training intelligence brief: readiness, week plan, predictions, fatigue, data quality. Call first for overview questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_readiness",
    description: "Race or half-marathon readiness score, gaps, and risks.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_predictions",
    description: "Consensus race time predictions with confidence and anchor effort.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_week_plan",
    description: "Recommended next week sessions (deterministic plan engine).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_race_strategy",
    description:
      "Pacing strategy splits for the race goal. mode: even, negative, conservative, aggressive.",
    input_schema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["even", "negative", "conservative", "aggressive"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_fatigue_load",
    description: "Freshness, TSB, CTL/ATL, and load interpretation.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_recent_runs",
    description:
      "List recent runs with workout type, pace, HR, execution quality, fade/drift, and a one-line narrative. Use before get_run_detail when browsing.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_run_detail",
    description:
      "Deep dive on one run: laps, stream metrics, pacing/HR assessment, execution score, adaptations, and evidence. Requires runId or date (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        runId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_data_quality",
    description: "Import coverage: HR, FIT, cadence, warnings.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_connection_status",
    description: "Strava connection and stream sync status.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "compare_sessions",
    description:
      "Compare recent sessions of a workout type (tempo, interval, long, race) with execution quality scores.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["tempo", "interval", "long", "race"],
        },
        n: { type: "number", description: "Number of sessions (default 3)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "explain_readiness_delta",
    description:
      "Explain how race or HM readiness changed over the last N weeks with component drivers.",
    input_schema: {
      type: "object",
      properties: {
        weeks: { type: "number", description: "Lookback weeks 1-4 (default 1)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "find_best_phase",
    description:
      "Find strongest historical 4-week training phase by aerobic, volume, consistency, or efficiency.",
    input_schema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["aerobic", "volume", "consistency", "efficiency"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "attribute_improvement",
    description:
      "Historically associate training block patterns with pace, efficiency, or volume improvements.",
    input_schema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["pace", "efficiency", "volume"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "analyze_fade_pattern",
    description: "Analyze late-session pace fade on long runs at or above a distance threshold.",
    input_schema: {
      type: "object",
      properties: {
        distanceKm: { type: "number", description: "Min distance km (default 15)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "pr_context",
    description:
      "Summarize training in the 8 weeks before a PR vs the prior 8 weeks — what changed.",
    input_schema: {
      type: "object",
      properties: {
        bucket: {
          type: "string",
          enum: ["5k", "10k", "hm", "long"],
        },
        runId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_training_ecosystem",
    description:
      "Full training ecosystem payload (summary, modality, cross-training, interference, archetype). Use for gym/hybrid/triathlon questions. Does not change race predictions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_training_ecosystem_summary",
    description: "Compact ecosystem summary for a rolling window (days: 7, 14, 28, 56, 84).",
    input_schema: {
      type: "object",
      properties: { window: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_modality_distribution",
    description: "Session distribution by modality and sport_type mix for a window.",
    input_schema: {
      type: "object",
      properties: { window: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_cross_training_support",
    description:
      "Bike/swim/aerobic cross-training support scores and evidence (not run-equivalent miles).",
    input_schema: {
      type: "object",
      properties: { window: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_interference_risks",
    description: "HIIT/strength/sport timing risks near quality runs and weekly HI density.",
    input_schema: {
      type: "object",
      properties: { window: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_athlete_archetype",
    description:
      "Infer runner/hybrid/triathlete/cyclist/strength-endurance/multisport from 8–12 week modality mix.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "compare_modality_blocks",
    description: "Compare modality session counts between two rolling blocks.",
    input_schema: {
      type: "object",
      properties: {
        blockADays: { type: "number" },
        blockBDays: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_race_week_interference_check",
    description: "Race-week non-run intensity warnings and taper guidance for strength/HIIT.",
    input_schema: {
      type: "object",
      properties: { goalId: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_strength_mobility_support",
    description:
      "Strength and mobility consistency, scores, and whether to schedule strength this week.",
    input_schema: {
      type: "object",
      properties: { window: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_athlete_memory",
    description:
      "Structured athlete memory: evidence-backed beliefs about adaptation, fatigue, pacing, taper, and modality. Use for 'what have you learned about me', fatigue patterns, uncertain patterns, and longitudinal coaching context.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["all", "adaptation", "fatigue", "pacing", "taper", "modality"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "generate_next_week_training_plan",
    description:
      "Generate an AI-native adaptive weekly training plan from coaching context, guardrails, and validation. REQUIRED for 'build my next week', race week plans, taper plans, and plan adjustments — never invent a plan without this tool. Returns structured WeeklyTrainingPlan with evidence, constraints, and limitations.",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string" },
        windowDays: { type: "number", enum: [14, 21, 28] },
        planPreference: {
          type: "string",
          enum: ["conservative", "balanced", "aggressive"],
        },
        availableDays: {
          type: "array",
          items: { type: "string" },
          description: "e.g. Mon, Wed, Fri, Sun",
        },
        constraints: {
          type: "array",
          items: { type: "string" },
        },
        planningContext: {
          type: "string",
          description:
            "Freeform athlete narrative for this week (e.g. post-race recovery, travel, no current goal)",
        },
      },
      additionalProperties: false,
    },
  },
] as const;

export function parseToolName(name: string): IntelligenceToolName {
  const allowed = INTELLIGENCE_TOOL_DEFINITIONS.map((t) => t.name);
  if (!allowed.includes(name as IntelligenceToolName)) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return name as IntelligenceToolName;
}
