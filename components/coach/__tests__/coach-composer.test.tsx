import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoachComposer } from "../coach-composer";

/**
 * The Coach input.
 *
 * Almost all of this component's behaviour is one predicate — `canSend` — and one
 * keyboard rule. Both are the kind of thing that looks obviously right and breaks
 * quietly: a composer that sends on Shift+Enter makes multi-line questions impossible,
 * and one that sends while loading double-posts to a paid API.
 */

function setup(props: Partial<React.ComponentProps<typeof CoachComposer>> = {}) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  render(<CoachComposer value="" onChange={onChange} onSubmit={onSubmit} {...props} />);
  return { onChange, onSubmit };
}

const box = () => screen.getByRole("textbox");
const send = () => screen.getByRole("button", { name: /send message/i });

describe("when sending is allowed", () => {
  it("refuses an empty message", () => {
    setup({ value: "" });
    expect(send()).toBeDisabled();
  });

  // Whitespace looks like input but is not a question.
  it("refuses whitespace only", () => {
    setup({ value: "   \n  " });
    expect(send()).toBeDisabled();
  });

  it("allows real text", () => {
    setup({ value: "How is my fitness?" });
    expect(send()).toBeEnabled();
  });

  it.each([
    ["loading", { loading: true }],
    ["disabled", { disabled: true }],
  ])("refuses while %s, even with text", (_label, extra) => {
    setup({ value: "a question", ...extra });
    expect(send()).toBeDisabled();
  });
});

describe("the keyboard contract", () => {
  it("sends on Enter", async () => {
    const { onSubmit } = setup({ value: "a question" });
    await userEvent.type(box(), "{Enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  // The rule that makes multi-line questions possible at all.
  it("does not send on Shift+Enter", async () => {
    const { onSubmit } = setup({ value: "a question" });
    await userEvent.type(box(), "{Shift>}{Enter}{/Shift}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not send an empty message on Enter", async () => {
    const { onSubmit } = setup({ value: "  " });
    await userEvent.type(box(), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /**
   * The expensive one. Every Coach turn is a paid multi-round LLM call, so a second
   * Enter while the first is still running bills twice and races two replies into the
   * same thread.
   */
  it("does not send again while a reply is in flight", async () => {
    const { onSubmit } = setup({ value: "a question", loading: true });
    await userEvent.type(box(), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("typing", () => {
  it("reports each keystroke upward", async () => {
    const { onChange } = setup({ value: "" });
    await userEvent.type(box(), "hi");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("is not typeable while loading", () => {
    setup({ value: "", loading: true });
    expect(box()).toBeDisabled();
  });
});

describe("what the athlete is told", () => {
  it("uses a default prompt", () => {
    setup();
    expect(box()).toHaveAttribute("placeholder", expect.stringMatching(/follow-up/i));
  });

  it("lets the caller override it, since the two surfaces ask for different things", () => {
    setup({ placeholder: "Ask about this run" });
    expect(box()).toHaveAttribute("placeholder", "Ask about this run");
  });

  it("clicking send submits", async () => {
    const { onSubmit } = setup({ value: "a question" });
    await userEvent.click(send());
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
