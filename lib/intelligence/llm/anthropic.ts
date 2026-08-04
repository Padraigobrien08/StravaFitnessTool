import { INTELLIGENCE_TOOL_DEFINITIONS } from "../tools";
import { executeIntelligenceTool, parseToolName } from "../tools";
import type { IntelligenceContext } from "../types";
import { buildCoachSystemWithContext } from "./coachingContextPrompt";
import type { ChatMessage } from "./types";

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
      const text = data.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return { reply: text || "I couldn't generate a response.", toolsUsed };
    }

    if (data.stop_reason === "tool_use") {
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];

      for (const block of data.content) {
        if (block.type !== "tool_use") continue;
        toolsUsed.push(block.name);
        const result = await executeIntelligenceTool(ctx, {
          name: parseToolName(block.name),
          arguments: block.input ?? {},
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result, null, 2),
        });
      }

      anthropicMessages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return {
    reply: "I hit the tool loop limit, try a simpler question.",
    toolsUsed,
  };
}
