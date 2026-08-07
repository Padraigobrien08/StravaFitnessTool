import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanPlanningContext } from "../plan-planning-context";
import { PLAN_CONTEXT_MAX_CHARS, PLAN_CONTEXT_SUGGESTIONS } from "@/lib/plan/planContextConstants";

/**
 * Free-text planning context — the field where an athlete says "I just raced" or
 * "traveling Thursday", which then steers the LLM plan.
 *
 * Two behaviours carry real weight. The draft has to survive a reload, because losing
 * a paragraph someone typed before generating a plan is the kind of thing that stops
 * them bothering a second time. And the length cap has to hold on every path into the
 * field, since the text is interpolated into a prompt.
 */

const loadPlanContextDraft = vi.fn();
const savePlanContextDraft = vi.fn();
vi.mock("@/lib/plan/planContextStorage", () => ({
  loadPlanContextDraft: () => loadPlanContextDraft(),
  savePlanContextDraft: (v: string) => savePlanContextDraft(v),
}));

beforeEach(() => {
  loadPlanContextDraft.mockReset().mockReturnValue(null);
  savePlanContextDraft.mockReset();
});

/** A controlled parent, matching how `PlanWorkspace` actually holds this state. */
function ControlledHost({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <PlanPlanningContext value={value} onChange={setValue} />;
}

/** Render as a controlled field the way the plan workspace does. */
function setup(initial = "") {
  const onChange = vi.fn();
  let current = initial;
  const { rerender } = render(<PlanPlanningContext value={current} onChange={onChange} />);
  // Reflect changes back, so the component sees the value it asked for.
  onChange.mockImplementation((next: string) => {
    current = next;
    rerender(<PlanPlanningContext value={current} onChange={onChange} />);
  });
  return { onChange, value: () => current };
}

const field = () => screen.getByRole("textbox");

describe("the draft", () => {
  it("restores what was typed before a reload", () => {
    loadPlanContextDraft.mockReturnValue("Traveling all week");
    const onChange = vi.fn();
    render(<PlanPlanningContext value="" onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith("Traveling all week");
  });

  it("does not announce a change when there is no draft", () => {
    const onChange = vi.fn();
    render(<PlanPlanningContext value="" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("saves as the athlete types", async () => {
    setup();
    await userEvent.type(field(), "hi");
    expect(savePlanContextDraft).toHaveBeenCalledWith("hi");
  });

  /**
   * Ordering matters: the save effect must not fire before hydration, or mounting
   * with an empty parent value would write "" over the stored draft and destroy it
   * before the load could restore it. The `hydrated` flag is what prevents that.
   *
   * Driven through a real controlled parent rather than a bare `vi.fn()`. A mock that
   * accepts `onChange` and never updates `value` does make this fail — but that models
   * a parent which ignores its own controlled input, which `PlanWorkspace` is not, so
   * the failure would be an artifact of the double rather than a defect. Verified both
   * ways before writing it this way round.
   */
  it("never overwrites a stored draft with an empty value on mount", () => {
    loadPlanContextDraft.mockReturnValue("something worth keeping");
    render(<ControlledHost />);
    expect(savePlanContextDraft.mock.calls.map((c) => c[0])).not.toContain("");
  });

  it("keeps the restored draft as the field's value", () => {
    loadPlanContextDraft.mockReturnValue("Traveling all week");
    render(<ControlledHost />);
    expect(screen.getByRole("textbox")).toHaveValue("Traveling all week");
  });
});

describe("suggestions", () => {
  it("offers every canned starter", () => {
    setup();
    for (const s of PLAN_CONTEXT_SUGGESTIONS) {
      expect(screen.getByRole("button", { name: s })).toBeInTheDocument();
    }
  });

  it("fills an empty field with the suggestion alone", async () => {
    const { value } = setup("");
    await userEvent.click(screen.getByRole("button", { name: PLAN_CONTEXT_SUGGESTIONS[0] }));
    expect(value()).toBe(PLAN_CONTEXT_SUGGESTIONS[0]);
  });

  // Appending rather than replacing: the athlete's own words are the valuable part.
  it("adds to existing text on a new line instead of replacing it", async () => {
    const { value } = setup("My own note");
    await userEvent.click(screen.getByRole("button", { name: PLAN_CONTEXT_SUGGESTIONS[1] }));
    expect(value()).toBe(`My own note\n${PLAN_CONTEXT_SUGGESTIONS[1]}`);
  });

  it("does not leave a blank line when the field holds only whitespace", async () => {
    const { value } = setup("   ");
    await userEvent.click(screen.getByRole("button", { name: PLAN_CONTEXT_SUGGESTIONS[0] }));
    expect(value()).toBe(PLAN_CONTEXT_SUGGESTIONS[0]);
  });

  // The cap has to hold here too — this path bypasses the textarea's maxLength.
  it("truncates at the limit rather than exceeding it", async () => {
    const { value } = setup("x".repeat(PLAN_CONTEXT_MAX_CHARS - 5));
    await userEvent.click(screen.getByRole("button", { name: PLAN_CONTEXT_SUGGESTIONS[0] }));
    expect(value().length).toBe(PLAN_CONTEXT_MAX_CHARS);
  });
});

describe("the character budget", () => {
  it("shows how much room is left", () => {
    setup("hello");
    expect(screen.getByText(/5 \/ 2,000 characters/)).toBeInTheDocument();
  });

  it("caps typed input at the limit", () => {
    setup();
    expect(field()).toHaveAttribute("maxlength", String(PLAN_CONTEXT_MAX_CHARS));
  });
});

describe("field size", () => {
  it("grows and shrinks on request", async () => {
    setup();
    const before = field().getAttribute("rows");
    await userEvent.click(screen.getByRole("button", { name: /longer field/i }));
    const after = field().getAttribute("rows");
    expect(Number(after)).toBeGreaterThan(Number(before));

    await userEvent.click(screen.getByRole("button", { name: /shorter field/i }));
    expect(field().getAttribute("rows")).toBe(before);
  });

  // Clicking a suggestion expands the field, since the text it just added is likely
  // to be edited rather than left as-is.
  it("expands when a suggestion is used", async () => {
    setup();
    const before = Number(field().getAttribute("rows"));
    await userEvent.click(screen.getByRole("button", { name: PLAN_CONTEXT_SUGGESTIONS[0] }));
    expect(Number(field().getAttribute("rows"))).toBeGreaterThan(before);
  });
});

describe("while a plan is generating", () => {
  it("locks the field and the suggestions", () => {
    render(<PlanPlanningContext value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: PLAN_CONTEXT_SUGGESTIONS[0] })).toBeDisabled();
  });
});
