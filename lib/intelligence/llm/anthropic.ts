import { INTELLIGENCE_TOOL_DEFINITIONS } from "../tools";
import type { IntelligenceContext } from "../types";
import { buildCoachSystemWithContext } from "./coachingContextPrompt";
import { executeToolForModel } from "./toolExecution";
import type { ChatMessage } from "./types";

/** Text blocks the model produced so far, joined. */
function textFrom(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n")
    .trim();
}

export async function runAnthropicCoachChat(
  ctx: IntelligenceContext,
  messages: ChatMessage[],
  apiKey: string,
): Promise<{ reply: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = [];
  const systemPrompt = await buildCoachSystemWithContext(ctx);
  const anthropicMessages: Array<{
    role: "user" | "assistant";
    content: unknown;
  }> = messages.map((m) => ({ role: m.role, content: m.content }));

  const maxRounds = 6;
  for (let round = 0; round < maxRounds; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        tools: INTELLIGENCE_TOOL_DEFINITIONS,
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      >;
      stop_reason: string;
    };

    anthropicMessages.push({ role: "assistant", content: data.content });

    if (data.stop_reason === "end_turn") {
      const text = textFrom(data.content);
      return { reply: text || "I couldn't generate a response.", toolsUsed };
    }

    if (data.stop_reason === "tool_use") {
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const block of data.content) {
        if (block.type !== "tool_use") continue;
        const outcome = await executeToolForModel(ctx, block.name, block.input ?? {});
        // Only a call that returned data counts as grounding. See `describeGrounding`.
        if (!outcome.isError) toolsUsed.push(block.name);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: outcome.content,
          ...(outcome.isError ? { is_error: true } : {}),
        });
      }

      anthropicMessages.push({ role: "user", content: toolResults });
      continue;
    }

    /**
     * Any other stop reason — `max_tokens` above all, but also `refusal` and
     * `pause_turn` — used to fall through to the loop-limit message below. That threw
     * away whatever the model had already written and replaced it with a wrong
     * diagnosis: the athlete was told to simplify their question when the real cause
     * was a truncated response.
     */
    const partial = textFrom(data.content);
    if (partial) {
      return {
        reply:
          data.stop_reason === "max_tokens"
            ? `${partial}\n\n_(Response cut short at the length limit.)_`
            : partial,
        toolsUsed,
      };
    }
    break;
  }

  return {
    reply: "I hit the tool loop limit, try a simpler question.",
    toolsUsed,
  };
}
