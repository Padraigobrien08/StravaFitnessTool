import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanWeekBoard } from "../plan-week-board";
import { calendarWeekFixture } from "@/test/plan-fixtures";

/**
 * The week board — where a plan stops being a document and becomes something the
 * athlete edits.
 *
 * Every mutation here leaves through a callback, so that is what the tests assert:
 * the exact patch handed upward. A board that renders beautifully and sends
 * `{ distanceKm: NaN }` is worse than one that looks wrong, because the damage lands
 * in the saved week and shows up later as a broken volume total.
 *
 * Pure props, no mocking — the component takes a week and some handlers.
 */

const onPatchWorkout = vi.fn();
const onDeleteWorkout = vi.fn();
const onSwapWorkouts = vi.fn();

beforeEach(() => {
  onPatchWorkout.mockReset();
  onDeleteWorkout.mockReset();
  onSwapWorkouts.mockReset();
});

function board(props: Partial<React.ComponentProps<typeof PlanWeekBoard>> = {}) {
  const week = props.week ?? calendarWeekFixture();
  render(
    <PlanWeekBoard
      week={week}
      editable
      onPatchWorkout={onPatchWorkout}
      onDeleteWorkout={onDeleteWorkout}
      onSwapWorkouts={onSwapWorkouts}
      {...props}
    />,
  );
  return week;
}

const editButtons = () => screen.queryAllByRole("button", { name: /^edit$/i });

/**
 * The board renders a mobile list and a desktop grid together, hiding one with CSS,
 * so every control exists twice in the DOM. These take the first match — which of the
 * two responds is a layout question, not a behavioural one.
 */
const firstButton = (name: RegExp) => screen.getAllByRole("button", { name })[0];
const firstTextbox = () => screen.getAllByRole("textbox")[0];
const firstDistance = () => screen.getAllByPlaceholderText("km")[0];

/** Open the edit panel for the first editable workout. */
async function openFirstEditor() {
  await userEvent.click(editButtons()[0]);
}

describe("rendering the week", () => {
  it("shows every planned session", () => {
    board();
    expect(screen.getAllByText(/Easy 8k/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tempo 6k/).length).toBeGreaterThan(0);
  });

  // The mapper fills the untouched days, and a board that only rendered the two
  // planned sessions would quietly hide the rest of the week.
  it("lays out all seven days, not only the ones with a session", () => {
    const week = board();
    expect(week.workouts.length).toBeGreaterThanOrEqual(7);
  });
});

describe("who is allowed to edit", () => {
  it("offers no editing when the week is read-only", () => {
    board({ editable: false });
    expect(editButtons()).toHaveLength(0);
  });

  it("offers editing when it is not", () => {
    board({ editable: true });
    expect(editButtons().length).toBeGreaterThan(0);
  });
});

describe("marking a session", () => {
  it.each([
    ["Done", "completed"],
    ["Skip", "skipped"],
  ])("%s patches status to %s", async (label, status) => {
    board();
    await openFirstEditor();
    await userEvent.click(firstButton(new RegExp(`^${label}$`, "i")));

    expect(onPatchWorkout).toHaveBeenCalledWith(expect.any(String), { status });
  });

  it("closes the editor afterwards", async () => {
    board();
    await openFirstEditor();
    await userEvent.click(firstButton(/^done$/i));
    expect(screen.queryAllByRole("button", { name: /^save$/i })).toHaveLength(0);
  });
});

describe("editing a session", () => {
  it("sends the new title and marks it modified", async () => {
    board();
    await openFirstEditor();

    const title = firstTextbox();
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed session");
    await userEvent.click(firstButton(/^save$/i));

    expect(onPatchWorkout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: "Renamed session", status: "modified" }),
    );
  });

  it("sends a numeric distance, not the raw string", async () => {
    board();
    await openFirstEditor();

    const distance = firstDistance();
    await userEvent.clear(distance);
    await userEvent.type(distance, "12.5");
    await userEvent.click(firstButton(/^save$/i));

    expect(onPatchWorkout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ distanceKm: 12.5 }),
    );
  });

  /**
   * The one that would land silently. `Number(distanceKm)` on unparseable text yields
   * NaN, which serialises to null in the saved week and quietly removes that session
   * from every volume total that follows.
   */
  it("never sends NaN when the distance is not a number", async () => {
    board();
    await openFirstEditor();

    const distance = firstDistance();
    await userEvent.clear(distance);
    await userEvent.type(distance, "abc");
    await userEvent.click(firstButton(/^save$/i));

    const patch = onPatchWorkout.mock.calls[0]?.[1] as { distanceKm?: number };
    expect(Number.isNaN(patch?.distanceKm)).toBe(false);
  });

  it("treats an emptied distance as cleared rather than zero", async () => {
    board();
    await openFirstEditor();

    await userEvent.clear(firstDistance());
    await userEvent.click(firstButton(/^save$/i));

    const patch = onPatchWorkout.mock.calls[0]?.[1] as { distanceKm?: number };
    expect(patch?.distanceKm).toBeUndefined();
  });

  it("removes a session on request", async () => {
    board();
    await openFirstEditor();
    await userEvent.click(firstButton(/^remove$/i));
    expect(onDeleteWorkout).toHaveBeenCalledWith(expect.any(String));
  });

  it("offers no remove when the caller cannot handle it", async () => {
    board({ onDeleteWorkout: undefined });
    await openFirstEditor();
    expect(screen.queryAllByRole("button", { name: /^remove$/i })).toHaveLength(0);
  });
});

describe("reordering by drag", () => {
  /** The draggable elements, which carry the workout id. */
  const draggables = () => Array.from(document.querySelectorAll<HTMLElement>('[draggable="true"]'));

  /**
   * jsdom supplies no `dataTransfer`, and the component's dragstart handler writes to
   * it before recording the drag — so without this stub the handler throws and the
   * drag never starts, which looks exactly like a broken swap.
   */
  const dataTransfer = () => ({ effectAllowed: "", setData: vi.fn(), getData: () => "" });

  it("is off unless the board is editable, draggable and can swap", () => {
    board({ draggable: true, editable: false });
    expect(draggables()).toHaveLength(0);
  });

  it("is off without a swap handler, even when draggable", () => {
    board({ draggable: true, editable: true, onSwapWorkouts: undefined });
    expect(draggables()).toHaveLength(0);
  });

  it("is on when all three conditions hold", () => {
    board({ draggable: true, editable: true });
    expect(draggables().length).toBeGreaterThan(0);
  });

  it("swaps two sessions", () => {
    board({ draggable: true, editable: true });
    const items = draggables();

    // fireEvent, not dispatchEvent: React's drag handlers are synthetic, and a plain
    // Event never reaches them.
    fireEvent.dragStart(items[0], { dataTransfer: dataTransfer() });
    fireEvent.dragOver(items[1]);
    fireEvent.drop(items[1]);

    expect(onSwapWorkouts).toHaveBeenCalled();
    const [from, to] = onSwapWorkouts.mock.calls[0];
    expect(from).not.toBe(to);
  });

  // Dropping a card on itself is the commonest accidental drag, and swapping a
  // session with itself would bump the revision for no change.
  it("does not swap a session with itself", () => {
    board({ draggable: true, editable: true });
    const items = draggables();

    fireEvent.dragStart(items[0], { dataTransfer: dataTransfer() });
    fireEvent.drop(items[0]);

    expect(onSwapWorkouts).not.toHaveBeenCalled();
  });
});

describe("highlighting", () => {
  it("renders without complaint when told to highlight nothing", () => {
    expect(() => board({ highlightWorkoutIds: [] })).not.toThrow();
  });

  it("accepts ids that are no longer in the week", () => {
    expect(() => board({ highlightWorkoutIds: ["gone"] })).not.toThrow();
  });
});

describe("compact variant", () => {
  it("still lists the sessions", () => {
    board({ variant: "compact" });
    expect(screen.getAllByText(/Easy 8k/).length).toBeGreaterThan(0);
  });

  it("does not offer editing when not editable", () => {
    board({ variant: "compact", editable: false });
    expect(editButtons()).toHaveLength(0);
  });
});

describe("an empty week", () => {
  it("renders rest days rather than nothing", () => {
    const week = calendarWeekFixture([]);
    render(<PlanWeekBoard week={week} />);
    expect(within(document.body).getAllByText(/rest/i).length).toBeGreaterThan(0);
  });
});
