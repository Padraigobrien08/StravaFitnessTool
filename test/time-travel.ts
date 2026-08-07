import { afterAll, vi } from "vitest";

/**
 * Opt-in clock displacement, for finding tests that will fail on a future date.
 *
 * Three suites have gone red in production CI simply because time passed
 * (§D-8, #117, and two since). Each was found the same way: `main` broke at a
 * particular hour and someone went looking. This makes that check something you can
 * run on purpose:
 *
 *     npm run test:time-travel                 # one year ahead
 *     PROBE_NOW=2028-02-29T23:59:00Z npm test  # a specific instant
 *
 * Only `Date` is faked, so `setTimeout` and friends still work and suites that use
 * their own fake timers are unaffected.
 *
 * **The faking happens at module top level, deliberately.** Fixtures are usually
 * module-level constants built from `Date.now()`, and those are evaluated when the
 * test file is imported. Faking inside `beforeAll` would run too late: the fixtures
 * would capture the real clock while the code under test saw the fake one, and every
 * recency check in the suite would fail for a reason that cannot occur in production.
 * That mistake produced 7 false positives the first time this was written.
 */
const at = process.env.PROBE_NOW;

if (at) {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) {
    throw new Error(`PROBE_NOW is not a valid date: ${at}`);
  }
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(when);
  afterAll(() => vi.useRealTimers());
}
