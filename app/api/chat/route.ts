import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { intelligenceContextFromRequest } from "@/lib/intelligence/auth";
import { runCoachChat, type ChatMessage } from "@/lib/intelligence/chat";
import type { IntelligenceBrief } from "@/lib/intelligence/types";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(8000),
    })
  ),
  clientBrief: z.custom<IntelligenceBrief>().optional(),
});

export async function POST(req: NextRequest) {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (!hasOpenAI && !hasAnthropic) {
    return NextResponse.json(
      {
        error:
          "Coach chat requires OPENAI_API_KEY or ANTHROPIC_API_KEY in server environment. See .env.example.",
      },
      { status: 503 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ctx = await intelligenceContextFromRequest(req);
  if (!ctx) {
    if (!body.clientBrief) {
      return NextResponse.json(
        {
          error:
            "Connect Strava (Import page) or sign in for server intelligence. Local-only mode can pass clientBrief later.",
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Server session required for coach tools. Connect Strava API and sync data.",
      },
      { status: 401 }
    );
  }

  try {
    const { reply, toolsUsed } = await runCoachChat(
      ctx,
      body.messages as ChatMessage[]
    );
    return NextResponse.json({ reply, toolsUsed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 500 }
    );
  }
}
