import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RouteError from "../error";
import GlobalError from "../global-error";

/**
 * The two crash boundaries.
 *
 * These render only after something has already gone wrong, which makes them the
 * worst code in the app to leave untested: a defect here converts a recoverable error
 * into a blank page, and it does so precisely when the athlete is least able to tell
 * you what happened. Nothing else in the app can catch a broken error boundary.
 *
 * `global-error.tsx` replaces the root layout and so renders its own `<html>`/`<body>`.
 * Testing Library mounts into a div and React will not render nested document elements
 * there, so that shell is asserted against the source rather than the DOM — a
 * `container.querySelector("html")` check passes vacuously and proves nothing.
 */

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const error = (overrides: Partial<Error & { digest?: string }> = {}) =>
  Object.assign(new Error("Cannot read properties of undefined"), overrides);

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("the route-level boundary", () => {
  it("says something went wrong in plain language", () => {
    render(<RouteError error={error()} unstable_retry={vi.fn()} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  // Support cannot act on "an error occurred"; the message is the only clue an
  // athlete can copy into a bug report.
  it("shows the underlying message", () => {
    render(<RouteError error={error()} unstable_retry={vi.fn()} />);
    expect(screen.getByText(/Cannot read properties of undefined/)).toBeInTheDocument();
  });

  it("shows the digest as a reference when React supplies one", () => {
    render(<RouteError error={error({ digest: "abc123" })} unstable_retry={vi.fn()} />);
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("omits the reference line when there is no digest", () => {
    render(<RouteError error={error()} unstable_retry={vi.fn()} />);
    expect(screen.queryByText(/^Reference:/)).not.toBeInTheDocument();
  });

  it("renders even when the error carries no message at all", () => {
    const bare = Object.assign(new Error(), { message: "" });
    expect(() => render(<RouteError error={bare} unstable_retry={vi.fn()} />)).not.toThrow();
  });

  /**
   * The retry is the whole point of a route boundary rather than a blank page, and
   * it is a prop React supplies — so a rename upstream would silently leave a button
   * that does nothing.
   */
  it("retries when asked", async () => {
    const retry = vi.fn();
    render(<RouteError error={error()} unstable_retry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  // The escape hatch when retrying does not help: reload the data.
  it("offers a way out to Import", () => {
    render(<RouteError error={error()} unstable_retry={vi.fn()} />);
    expect(screen.getByRole("link", { name: /import/i })).toHaveAttribute("href", "/import");
  });

  it("logs the error so it reaches the console and any log capture", () => {
    render(<RouteError error={error()} unstable_retry={vi.fn()} />);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("the global boundary", () => {
  /**
   * This one replaces the root layout, so it renders its own `<html>`/`<body>`.
   * Testing Library mounts into a div, and React does not render nested document
   * elements there — so the shell is asserted by reading the source rather than the
   * DOM. A structural assertion through `container` would silently pass on a
   * boundary that had lost its shell.
   */
  it("brings its own document shell", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("app/global-error.tsx", "utf8");
    expect(src).toMatch(/<html/);
    expect(src).toMatch(/<body/);
  });

  it("still explains itself without the app shell", () => {
    render(<GlobalError error={error()} unstable_retry={vi.fn()} />);
    expect(screen.getByText(/unexpected error stopped the app/i)).toBeInTheDocument();
  });

  it("retries when asked", async () => {
    const retry = vi.fn();
    render(<GlobalError error={error()} unstable_retry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again|reload/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  /**
   * It cannot use the app's providers or CSS — it renders when the root layout has
   * failed — so its colours are inline. Without them the fallback is black text on a
   * black background, which is indistinguishable from the blank page it exists to
   * prevent.
   */
  it("carries its own colours rather than relying on the stylesheet", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("app/global-error.tsx", "utf8");
    expect(src).toMatch(/background:\s*"#/);
  });

  it("renders with no digest", () => {
    expect(() => render(<GlobalError error={error()} unstable_retry={vi.fn()} />)).not.toThrow();
  });
});
