import { INTELLIGENCE_TOOL_DEFINITIONS } from "../tools";
import type { IntelligenceContext } from "../types";
import { buildCoachSystemWithContext } from "./coachingContextPrompt";
import { executeToolForModel } from "./toolExecution";
import type { ChatMessage } from "./types";

const openaiTools = INTELLIGENCE_TOOL_DEFINITIONS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

export async function runOpenAICoachChat(
  ctx: IntelligenceContext,
  messages: ChatMessage[],
  apiKey: string,
): Promise<{ reply: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = [];
  const systemPrompt = await buildCoachSystemWithContext(ctx);
  const openaiMessages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content?: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
  }> = [{ role: "system", content: systemPrompt }, ...messages];

  const maxRounds = 6;
  for (let round = 0; round < maxRounds; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        max_tokens: 2048,
        messages: openaiMessages,
        tools: openaiTools,
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices: Array<{
        message: {
          role: string;
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
    };

    const choice = data.choices[0];
    if (!choice) {
      throw new Error("OpenAI returned no choices");
    }

    const msg = choice.message;
    openaiMessages.push({
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls,
    });

    if (choice.finish_reason === "stop" || !msg.tool_calls?.length) {
      return {
        reply: msg.content?.trim() || "I couldn't generate a response.",
        toolsUsed,
      };
    }

    // A `length` finish with tool calls means the arguments JSON was cut mid-write.
    // Parsing it yields `{}` and the tool then runs on the wrong inputs, which is
    // worse than not running: the model gets a confident answer to a question it did
    // not ask. Return what was written instead.
    if (choice.finish_reason === "length") {
      return {
        reply: msg.content?.trim()
          ? `${msg.content.trim()}\n\n_(Response cut short at the length limit.)_`
          : "My response was cut short before I could finish. Try a narrower question.",
        toolsUsed,
      };
    }

    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      const outcome = await executeToolForModel(ctx, tc.function.name, args);
      // Only a call that returned data counts as grounding. See `describeGrounding`.
      if (!outcome.isError) toolsUsed.push(tc.function.name);
      openaiMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: outcome.content,
      });
    }
  }

  return {
    reply: "I hit the tool loop limit, try a simpler question.",
    toolsUsed,
  };
}
