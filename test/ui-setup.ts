import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Shared setup for component tests.
 *
 * Loaded via the `ui` project in `vitest.config.ts`, so it applies to
 * `components/**` and `app/**` test files and nothing else — the ~1250 node-environment
 * tests keep running without a DOM, which is both faster and a real constraint (they
 * cover server code that must not depend on browser globals).
 *
 * What lives here is only the things every component test needs. Anything specific to
 * one component belongs in that component's test file.
 */

// React Testing Library does not auto-clean when globals are off.
afterEach(() => cleanup());

/**
 * jsdom implements no layout, so these return zeroes or throw. Components that
 * measure or observe elements would crash on mount rather than fail an assertion,
 * which makes for confusing failures a long way from the cause.
 */
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

vi.stubGlobal("ResizeObserver", NoopObserver);
vi.stubGlobal("IntersectionObserver", NoopObserver);

if (!window.matchMedia) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

// Radix and other primitives call these during open/close transitions.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
