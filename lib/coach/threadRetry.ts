import type { CoachMessage } from "./types";

/**
 * Pure decisions behind stopping and retrying a Coach turn. They live here
 * rather than inside the hook so they can be tested without a DOM: the retry
 * rule in particular is easy to get subtly wrong (re-sending the question
 * without dropping it first duplicates it in the thread).
 */

/**
 * True when a rejection came from us calling `AbortController.abort()`.
 * Cancelling on purpose is not a failure and must not surface as an error.
 */
export function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException) return e.name === "AbortError";
  // Some runtimes reject with a plain Error carrying the same name.
  return e instanceof Error && e.name === "AbortError";
}

export interface RetryTarget {
  /** The question to re-send. */
  text: string;
  /** The thread as it stood *before* that question, to rebuild from. */
  base: CoachMessage[];
}

/**
 * Work out what "ask again" should re-run: the most recent user message, plus
 * the history preceding it. Anything after that point (a failed or partial
 * assistant turn) is dropped, so a retry replaces the exchange instead of
 * appending a second copy of the question.
 *
 * Returns null when there is nothing to retry.
 */
export function retryTargetFromMessages(messages: CoachMessage[]): RetryTarget | null {
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIndex === -1) return null;
  const text = messages[lastUserIndex].content.trim();
  if (!text) return null;
  return { text, base: messages.slice(0, lastUserIndex) };
}
