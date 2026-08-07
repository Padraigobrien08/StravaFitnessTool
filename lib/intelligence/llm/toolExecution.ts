import { executeIntelligenceTool, parseToolName } from "../tools";
import type { IntelligenceContext } from "../types";
import { logger } from "@/lib/observability/logger";

/**
 * Run one tool call on behalf of the model, without letting it end the conversation.
 *
 * Both provider loops previously called `parseToolName` and `executeIntelligenceTool`
 * bare. Both can throw: `parseToolName` throws on any name not in the registry, and
 * the executor loads the athlete's bundle from Postgres on every call. So a
 * hallucinated tool name or a momentary database blip did not degrade the answer, it
 * took down the whole request and the athlete got a 500 in place of their reply.
 *
 * Both tool-use protocols have a way to say "that call failed" — Anthropic's
 * `is_error` on a tool_result, OpenAI's error text in the tool message — and a model
 * handed one will normally apologise, try a different tool, or answer without it.
 * Returning the failure to the model is strictly better than throwing past it.
 */
export interface ToolExecutionOutcome {
  /** JSON to hand back as the tool result. */
  content: string;
  /** True when the call failed and the model should treat the content as an error. */
  isError: boolean;
}

export async function executeToolForModel(
  ctx: IntelligenceContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  try {
    const result = await executeIntelligenceTool(ctx, {
      name: parseToolName(name),
      arguments: args,
    });
    return { content: JSON.stringify(result, null, 2), isError: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn({ event: "coach.tool_failed", tool: name, error: message });
    return {
      // Phrased for the model, which is the only reader: tell it what failed and
      // what it is allowed to do next, rather than leaking a stack trace.
      content: JSON.stringify({
        error: message,
        guidance:
          "This tool call failed. Do not retry it more than once. Answer using the tools that did succeed, and say plainly which information you could not retrieve.",
      }),
      isError: true,
    };
  }
}
