import type { IntelligenceContext } from "../types";
import { runAnthropicCoachChat } from "./anthropic";
import { runOpenAICoachChat } from "./openai";
import { resolveCoachProvider, type ChatMessage } from "./types";

export { COACH_SYSTEM, resolveCoachProvider, type ChatMessage } from "./types";

export async function runCoachChat(
  ctx: IntelligenceContext,
  messages: ChatMessage[],
): Promise<{ reply: string; toolsUsed: string[] }> {
  const { provider, apiKey } = resolveCoachProvider();
  if (provider === "openai") {
    return runOpenAICoachChat(ctx, messages, apiKey);
  }
  return runAnthropicCoachChat(ctx, messages, apiKey);
}
