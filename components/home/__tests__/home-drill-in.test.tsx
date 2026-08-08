import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every surface must be reachable by clicking.
 *
 * `components/nav.tsx` carries five destinations on purpose and sends the rest to depth,
 * which is a defensible console layout — but it only works if the depth is actually
 * linked from somewhere. It was not: `/training`, `/report` and `/context` had no inbound
 * link anywhere in the app, and `/performance` was linked only from `/training`, which
 * was itself unreachable. The command palette was the only way in, and a route reachable
 * by one keyboard shortcut is a route most people never find.
 *
 * This reads the source rather than rendering, because the claim is about the app's
 * navigation graph as a whole, not about one component's output. Rendering Home would
 * need the full analytics fixture and would still say nothing about `/training`'s own
 * outbound links.
 */

const root = join(__dirname, "..", "..", "..");

function sourceOf(...parts: string[]): string {
  return readFileSync(join(root, ...parts), "utf8");
}

describe("depth surfaces are reachable by clicking, not only by ⌘K", () => {
  const home = sourceOf("components", "home", "console", "home-console.tsx");

  it("links Home to the training load detail", () => {
    expect(home).toMatch(/href="\/training"/);
  });

  it("links the change feed to the printable report", () => {
    expect(home).toMatch(/href="\/report"/);
  });

  it("keeps the existing race drill-in", () => {
    // Guards against a refactor quietly dropping the one link that already worked.
    expect(home).toMatch(/href="\/goals"/);
  });

  it("reaches performance from the training page", () => {
    const load = sourceOf("components", "training", "load-intelligence-panel.tsx");
    const adaptation = sourceOf("components", "training", "adaptation-signals-panel.tsx");
    expect(load + adaptation).toMatch(/href="\/performance"/);
  });

  it("still offers the palette by click, not only by shortcut", () => {
    // The whole IA rests on the palette being discoverable, so pin the visible button.
    const shell = sourceOf("components", "workspace", "shell.tsx");
    expect(shell).toMatch(/onClick=\{openCommandPalette\}/);
    expect(shell).toMatch(/⌘K/);
  });

  it("routes every primary nav destination to a page that exists", () => {
    const nav = sourceOf("components", "nav.tsx");
    const hrefs = [...nav.matchAll(/href: "(\/[a-z]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(() => sourceOf("app", href.slice(1), "page.tsx"), `${href} has no page`).not.toThrow();
    }
  });
});
