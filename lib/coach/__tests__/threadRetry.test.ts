import { describe, it, expect } from "vitest";
import { isAbortError, retryTargetFromMessages } from "@/lib/coach/threadRetry";
import type { CoachMessage } from "@/lib/coach/types";

const msg = (role: CoachMessage["role"], content: string, id = content): CoachMessage => ({
  id,
  role,
  content,
  createdAt: "2026-07-29T12:00:00.000Z",
});

describe("isAbortError", () => {
  it("recognises a real AbortController abort", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
  });

  it("recognises an Error carrying the AbortError name", () => {
    const e = new Error("aborted");
    e.name = "AbortError";
    expect(isAbortError(e)).toBe(true);
  });

  it("does not swallow genuine failures", () => {
    expect(isAbortError(new Error("500 Internal Server Error"))).toBe(false);
    expect(isAbortError(new TypeError("fetch failed"))).toBe(false);
    expect(isAbortError("boom")).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe("retryTargetFromMessages", () => {
  it("returns null when there is nothing to retry", () => {
    expect(retryTargetFromMessages([])).toBeNull();
    expect(retryTargetFromMessages([msg("assistant", "hello")])).toBeNull();
  });

  it("re-runs the only question against an empty history", () => {
    const target = retryTargetFromMessages([msg("user", "Am I ready?")]);
    expect(target).toEqual({ text: "Am I ready?", base: [] });
  });

  // The bug this guards: re-sending without trimming the thread first leaves the
  // question in the history AND appends it again.
  it("drops the trailing question so a retry cannot duplicate it", () => {
    const messages = [
      msg("user", "first"),
      msg("assistant", "answer"),
      msg("user", "second"),
      msg("assistant", "partial"),
    ];
    const target = retryTargetFromMessages(messages);
    expect(target?.text).toBe("second");
    expect(target?.base.map((m) => m.content)).toEqual(["first", "answer"]);
    expect(target?.base.some((m) => m.content === "second")).toBe(false);
  });

  it("keeps the earlier conversation intact for context", () => {
    const messages = [
      msg("user", "q1"),
      msg("assistant", "a1"),
      msg("user", "q2"),
      msg("assistant", "a2"),
      msg("user", "q3"),
    ];
    const target = retryTargetFromMessages(messages);
    expect(target?.text).toBe("q3");
    expect(target?.base).toHaveLength(4);
  });

  it("ignores a blank trailing question", () => {
    expect(retryTargetFromMessages([msg("user", "   ")])).toBeNull();
  });
});
