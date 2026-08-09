import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Coach tool-calling loop, at ~3% coverage — the core product surface.
 *
 * Both providers run the same shape: call the API, execute whatever tools the model
 * asked for, feed the results back, repeat until it stops. The parts worth pinning are
 * the ones that only happen when something goes wrong, because those are the paths a
 * live LLM run never exercises on a good day and the ones an athlete meets on a bad
 * one.
 *
 * Two defects these were written against:
 *
 * 1. Tool execution was unguarded. `parseToolName` throws on any name outside the
 *    registry and the executor hits Postgres on every call, so a hallucinated tool or
 *    a database blip threw past the loop and the athlete got a 500 instead of a reply.
 *
 * 2. A `max_tokens` stop fell through to "I hit the tool loop limit, try a simpler
 *    question" — discarding text the model had already written, and misdiagnosing a
 *    truncated response as an overlong conversation.
 *
 * The HTTP layer is mocked; everything from the response body inwards is real.
 */

const executeIntelligenceTool = vi.fn();
vi.mock("@/lib/intelligence/tools", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  executeIntelligenceTool: (...a: unknown[]) => executeIntelligenceTool(...a),
}));

vi.mock("../coachingContextPrompt", () => ({
  buildCoachSystemWithContext: async () => "SYSTEM",
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const fetchMock = vi.fn();
const ctx = { userId: "athlete-1" } as never;
const ask = [{ role: "user" as const, content: "How is my fitness?" }];

/** A real tool name, so `parseToolName` accepts it. */
const REAL_TOOL = "get_coach_brief";

function anthropicReply(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

const textBlock = (text: string) => ({ type: "text", text });
const toolBlock = (name: string, id = "tu_1") => ({ type: "tool_use", id, name, input: {} });

const anthropicTurn = (content: unknown[], stop_reason: string) =>
  anthropicReply({ content, stop_reason });

const openaiTurn = (message: Record<string, unknown>, finish_reason: string) =>
  anthropicReply({ choices: [{ message, finish_reason }] });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  executeIntelligenceTool.mockReset().mockResolvedValue({ fitness: "good" });
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

async function runAnthropic() {
  const { runAnthropicCoachChat } = await import("../anthropic");
  return runAnthropicCoachChat(ctx, ask, "sk-ant-test");
}

async function runOpenAI() {
  const { runOpenAICoachChat } = await import("../openai");
  return runOpenAICoachChat(ctx, ask, "sk-test");
}

/** The JSON body of the nth outbound request. */
const bodyOf = (n: number) => JSON.parse(fetchMock.mock.calls[n][1].body as string);

describe("Anthropic: the happy path", () => {
  it("returns the model's text when it stops on its own", async () => {
    fetchMock.mockResolvedValueOnce(anthropicTurn([textBlock("You are fit.")], "end_turn"));
    await expect(runAnthropic()).resolves.toEqual({ reply: "You are fit.", toolsUsed: [] });
  });

  it("runs a tool, feeds the result back, and answers", async () => {
    fetchMock
      .mockResolvedValueOnce(anthropicTurn([toolBlock(REAL_TOOL)], "tool_use"))
      .mockResolvedValueOnce(anthropicTurn([textBlock("Fitness is trending up.")], "end_turn"));

    const result = await runAnthropic();
    expect(result).toEqual({ reply: "Fitness is trending up.", toolsUsed: [REAL_TOOL] });
    expect(executeIntelligenceTool).toHaveBeenCalledOnce();

    // The tool result must come back as a user turn carrying the matching id.
    const followUp = bodyOf(1).messages.at(-1);
    expect(followUp.role).toBe("user");
    expect(followUp.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
  });

  it("executes every tool in a multi-tool turn", async () => {
    fetchMock
      .mockResolvedValueOnce(
        anthropicTurn([toolBlock(REAL_TOOL, "a"), toolBlock("get_readiness", "b")], "tool_use"),
      )
      .mockResolvedValueOnce(anthropicTurn([textBlock("Done.")], "end_turn"));

    const result = await runAnthropic();
    expect(result.toolsUsed).toEqual([REAL_TOOL, "get_readiness"]);
    expect(bodyOf(1).messages.at(-1).content).toHaveLength(2);
  });

  it("joins multiple text blocks", async () => {
    fetchMock.mockResolvedValueOnce(
      anthropicTurn([textBlock("First."), textBlock("Second.")], "end_turn"),
    );
    expect((await runAnthropic()).reply).toBe("First.\nSecond.");
  });

  it("falls back when the model returns no text at all", async () => {
    fetchMock.mockResolvedValueOnce(anthropicTurn([], "end_turn"));
    expect((await runAnthropic()).reply).toBe("I couldn't generate a response.");
  });
});

describe("Anthropic: a failing tool must not end the conversation", () => {
  // The defect. Both of these threw straight past the loop before.
  it("survives a tool that throws and still answers", async () => {
    executeIntelligenceTool.mockRejectedValue(new Error("database unavailable"));
    fetchMock
      .mockResolvedValueOnce(anthropicTurn([toolBlock(REAL_TOOL)], "tool_use"))
      .mockResolvedValueOnce(anthropicTurn([textBlock("I could not check that.")], "end_turn"));

    await expect(runAnthropic()).resolves.toMatchObject({ reply: "I could not check that." });
  });

  it("survives a tool name the model invented", async () => {
    fetchMock
      .mockResolvedValueOnce(anthropicTurn([toolBlock("get_imaginary_metric")], "tool_use"))
      .mockResolvedValueOnce(anthropicTurn([textBlock("No such tool.")], "end_turn"));

    await expect(runAnthropic()).resolves.toMatchObject({ reply: "No such tool." });
    expect(executeIntelligenceTool).not.toHaveBeenCalled();
  });

  it("marks the failure as an error so the model can react to it", async () => {
    executeIntelligenceTool.mockRejectedValue(new Error("database unavailable"));
    fetchMock
      .mockResolvedValueOnce(anthropicTurn([toolBlock(REAL_TOOL)], "tool_use"))
      .mockResolvedValueOnce(anthropicTurn([textBlock("ok")], "end_turn"));

    await runAnthropic();
    const toolResult = bodyOf(1).messages.at(-1).content[0];
    expect(toolResult.is_error).toBe(true);
    expect(JSON.parse(toolResult.content).error).toMatch(/database unavailable/);
  });

  it("does not mark a successful result as an error", async () => {
    fetchMock
      .mockResolvedValueOnce(anthropicTurn([toolBlock(REAL_TOOL)], "tool_use"))
      .mockResolvedValueOnce(anthropicTurn([textBlock("ok")], "end_turn"));

    await runAnthropic();
    expect(bodyOf(1).messages.at(-1).content[0].is_error).toBeUndefined();
  });

  /**
   * This assertion used to read the other way — "still counts a failed tool as used,
   * since it was called" — and it was wrong on the premise, not the mechanics.
   *
   * `toolsUsed` has exactly one consumer: `describeGrounding`, which turns it into the
   * "Grounded in readiness, volume" chips under a Coach answer. Those chips exist to
   * tell the reader the numbers came from the engines. A call that threw returned no
   * numbers, so listing it certifies the opposite of what happened: the model is
   * correctly told the call failed and answers around it, while the badge tells the
   * reader that failure was the evidence.
   *
   * "It was called" is true and irrelevant. The badge is not an audit log of attempts.
   */
  it("does not count a failed tool as grounding", async () => {
    executeIntelligenceTool.mockRejectedValue(new Error("nope"));
    fetchMock
      .mockResolvedValueOnce(anthropicTurn([toolBlock(REAL_TOOL)], "tool_use"))
      .mockResolvedValueOnce(anthropicTurn([textBlock("ok")], "end_turn"));

    expect((await runAnthropic()).toolsUsed).toEqual([]);
  });

  it("does not count a hallucinated tool name as grounding", async () => {
    fetchMock
      .mockResolvedValueOnce(anthropicTurn([toolBlock("get_imaginary_metric")], "tool_use"))
      .mockResolvedValueOnce(anthropicTurn([textBlock("ok")], "end_turn"));

    expect((await runAnthropic()).toolsUsed).toEqual([]);
  });

  // The mixed turn is the one that matters: dropping the failure must not drop the
  // success alongside it, or a partial outage silently un-grounds a good answer.
  it("keeps the tools that succeeded when one of several fails", async () => {
    executeIntelligenceTool
      .mockRejectedValueOnce(new Error("nope"))
      .mockResolvedValueOnce({ readiness: 81 });
    fetchMock
      .mockResolvedValueOnce(
        anthropicTurn(
          [toolBlock(REAL_TOOL, "tu_1"), toolBlock("get_readiness", "tu_2")],
          "tool_use",
        ),
      )
      .mockResolvedValueOnce(anthropicTurn([textBlock("ok")], "end_turn"));

    expect((await runAnthropic()).toolsUsed).toEqual(["get_readiness"]);
  });
});

describe("Anthropic: truncated and unusual stops", () => {
  /**
   * The second defect: this returned "I hit the tool loop limit, try a simpler
   * question" and dropped the text entirely.
   */
  it("keeps a max_tokens response instead of discarding it", async () => {
    fetchMock.mockResolvedValueOnce(
      anthropicTurn([textBlock("Your fitness is trending")], "max_tokens"),
    );
    const { reply } = await runAnthropic();
    expect(reply).toContain("Your fitness is trending");
    expect(reply).toMatch(/cut short/);
    expect(reply).not.toMatch(/tool loop limit/);
  });

  it("returns partial text for any other stop reason", async () => {
    fetchMock.mockResolvedValueOnce(anthropicTurn([textBlock("Partial answer.")], "refusal"));
    expect((await runAnthropic()).reply).toBe("Partial answer.");
  });

  it("falls back to the loop-limit message only when there is nothing to show", async () => {
    fetchMock.mockResolvedValueOnce(anthropicTurn([], "refusal"));
    expect((await runAnthropic()).reply).toMatch(/tool loop limit/);
  });

  it("stops after the round cap when the model keeps calling tools", async () => {
    fetchMock.mockResolvedValue(anthropicTurn([toolBlock(REAL_TOOL)], "tool_use"));
    const result = await runAnthropic();
    expect(result.reply).toMatch(/tool loop limit/);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

describe("Anthropic: transport errors", () => {
  it("throws with the status when the API rejects the request", async () => {
    fetchMock.mockResolvedValue(anthropicReply("rate limited", false, 429));
    await expect(runAnthropic()).rejects.toThrow(/429/);
  });

  it("sends the API key and version headers", async () => {
    fetchMock.mockResolvedValueOnce(anthropicTurn([textBlock("hi")], "end_turn"));
    await runAnthropic();
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      "x-api-key": "sk-ant-test",
      "anthropic-version": "2023-06-01",
    });
  });
});

describe("OpenAI: the same guarantees", () => {
  it("returns content when the model stops", async () => {
    fetchMock.mockResolvedValueOnce(
      openaiTurn({ role: "assistant", content: "All good." }, "stop"),
    );
    await expect(runOpenAI()).resolves.toEqual({ reply: "All good.", toolsUsed: [] });
  });

  it("runs a tool and feeds the result back on a tool message", async () => {
    fetchMock
      .mockResolvedValueOnce(
        openaiTurn(
          {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: REAL_TOOL, arguments: "{}" } },
            ],
          },
          "tool_calls",
        ),
      )
      .mockResolvedValueOnce(openaiTurn({ role: "assistant", content: "Answer." }, "stop"));

    const result = await runOpenAI();
    expect(result).toEqual({ reply: "Answer.", toolsUsed: [REAL_TOOL] });
    expect(bodyOf(1).messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "c1" });
  });

  it("survives a tool that throws", async () => {
    executeIntelligenceTool.mockRejectedValue(new Error("database unavailable"));
    fetchMock
      .mockResolvedValueOnce(
        openaiTurn(
          {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: REAL_TOOL, arguments: "{}" } },
            ],
          },
          "tool_calls",
        ),
      )
      .mockResolvedValueOnce(
        openaiTurn({ role: "assistant", content: "Could not check." }, "stop"),
      );

    await expect(runOpenAI()).resolves.toMatchObject({ reply: "Could not check." });
    expect(JSON.parse(bodyOf(1).messages.at(-1).content).error).toMatch(/database unavailable/);
  });

  // Same guarantee as the Anthropic loop: the grounding badge must not certify a call
  // that returned nothing. The two loops had the identical defect and identical fix.
  it("does not count a failed tool as grounding", async () => {
    executeIntelligenceTool.mockRejectedValue(new Error("nope"));
    fetchMock
      .mockResolvedValueOnce(
        openaiTurn(
          {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: REAL_TOOL, arguments: "{}" } },
            ],
          },
          "tool_calls",
        ),
      )
      .mockResolvedValueOnce(openaiTurn({ role: "assistant", content: "ok" }, "stop"));

    expect((await runOpenAI()).toolsUsed).toEqual([]);
  });

  /**
   * A `length` finish alongside tool calls means the arguments JSON was cut off
   * mid-write. Parsing it yields `{}`, so the tool would have run on empty inputs and
   * returned a confident answer to a question the model never asked.
   */
  it("does not execute tool calls whose arguments were truncated", async () => {
    fetchMock.mockResolvedValueOnce(
      openaiTurn(
        {
          role: "assistant",
          content: "Looking at your ",
          tool_calls: [
            { id: "c1", type: "function", function: { name: REAL_TOOL, arguments: '{"dist' } },
          ],
        },
        "length",
      ),
    );

    const { reply } = await runOpenAI();
    expect(executeIntelligenceTool).not.toHaveBeenCalled();
    expect(reply).toContain("Looking at your");
    expect(reply).toMatch(/cut short/);
  });

  it("throws when the API returns no choices", async () => {
    fetchMock.mockResolvedValueOnce(anthropicReply({ choices: [] }));
    await expect(runOpenAI()).rejects.toThrow(/no choices/);
  });
});

describe("provider selection", () => {
  it("prefers OpenAI when both keys are set", async () => {
    process.env.OPENAI_API_KEY = "sk-openai";
    const { resolveCoachProvider } = await import("../types");
    expect(resolveCoachProvider()).toMatchObject({ provider: "openai", apiKey: "sk-openai" });
  });

  it("falls back to Anthropic", async () => {
    const { resolveCoachProvider } = await import("../types");
    expect(resolveCoachProvider()).toMatchObject({ provider: "anthropic" });
  });

  it("treats a whitespace-only key as absent", async () => {
    process.env.OPENAI_API_KEY = "   ";
    const { resolveCoachProvider } = await import("../types");
    expect(resolveCoachProvider().provider).toBe("anthropic");
  });

  it("explains what is missing when neither key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { resolveCoachProvider } = await import("../types");
    expect(() => resolveCoachProvider()).toThrow(/OPENAI_API_KEY or ANTHROPIC_API_KEY/);
  });
});
