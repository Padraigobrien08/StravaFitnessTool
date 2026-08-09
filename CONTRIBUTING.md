# Contributing to StrideIQ

Thanks for your interest in improving StrideIQ! This guide covers local setup, the checks we run, and how to propose changes.

## Ground rules

- Read [AGENTS.md](AGENTS.md) before non-trivial changes — it explains the product split (Dashboard / Intelligence / Coach) and the core code rules (no raw Strava CSV in UI, LLMs call tools, running vs. ecosystem, etc.).
- Be kind and constructive. This project follows a [Code of Conduct](CODE_OF_CONDUCT.md).

## Local setup

```bash
git clone https://github.com/Padraigobrien08/strideiq.git
cd strideiq
npm install
npm run dev            # http://localhost:3000 — click "Try the demo" (zero setup)
```

For the full stack (Strava OAuth + Coach), see **Quick start → Path B** in the [README](README.md#quick-start): `npm run setup`, then a local Postgres via `docker compose up -d` + `npm run db:migrate`, or a hosted database in `DATABASE_URL`.

## Before you open a PR

Run the gate locally — CI runs the same thing:

```bash
npm run check   # tsc --noEmit + eslint + vitest
npm run build   # production build
```

- **Types and lint must pass** (`npm run check` exits 0). New warnings are discouraged.
- **Add or update tests** for behavior changes. Tests live next to code in `__tests__/`.
- A handful of tests read a local, git-ignored Strava export fixture and **self-skip** when it's absent — that's expected in CI.

### Database tests

The suites in `lib/db/__tests__/` round-trip against a real Postgres and **`DELETE`
rows**, so they are opt-in and skip by default. They are gated on `TEST_DATABASE_URL`
— deliberately _not_ `DATABASE_URL`, which usually points at a real database — and a
non-local host makes them **fail loudly** rather than skip:

```bash
docker compose up -d
TEST_DATABASE_URL=postgresql://strideiq:strideiq@localhost:5432/strideiq npx vitest run lib/db
```

Never point `TEST_DATABASE_URL` at a database whose data you care about.

CI runs them on every PR against a throwaway `postgres:17` service, so a change that
breaks the persistence layer fails the build rather than passing quietly. Skipping is
now the local default, not the CI default — if you change SQL, expect CI to check it.

### Tests that expire

Three suites have turned `main` red for no reason but the passage of time — a fixture
anchored to a fixed date while the code measures against `Date.now()`, so the test has an
expiry date rather than a bug. CI now runs the whole suite as if it were a year from now:

```bash
npm run test:time-travel                        # +1 year
PROBE_NOW=2028-02-29T23:59:00Z npx vitest run   # a specific instant
```

If your test fails under time travel and passes normally, it depends on when it runs. Pin
the clock with `vi.useFakeTimers({ toFake: ["Date"] })` and `vi.setSystemTime(...)`, anchored
to the same date your fixtures use. Do not pin where the date is incidental — an unnecessary
pin hides real drift.

### Component tests

The suite runs as two Vitest **projects**, because the two kinds of test need different
environments:

| Project | Environment | Covers                                                  |
| ------- | ----------- | ------------------------------------------------------- |
| `node`  | node        | Everything under `lib/`, `app/api/`, `stores/` — no DOM |
| `ui`    | jsdom       | `components/**/*.test.tsx`, plus `app/**/*.ui.test.tsx` |

```bash
npx vitest run --project ui     # components only
npx vitest run --project node   # everything else
npx vitest run                  # both, which is what `npm run check` does
```

The split is deliberate rather than incidental. Several modules under `lib/` guard on
`typeof window === "undefined"` to stay safe during SSR; giving them a jsdom global
would quietly stop exercising the server path those guards exist for. It also keeps the
node project fast, since jsdom costs roughly a second of setup per file.

`test/ui-setup.ts` handles what every component test needs: `jest-dom` matchers,
cleanup between tests, and no-op `ResizeObserver` / `IntersectionObserver` (jsdom
implements no layout, so components that measure elements would otherwise crash on
mount rather than fail an assertion).

**Test what the component sends, not how it looks.** The valuable assertions are the
arguments handed to a store or callback, and the accessible state a screen reader
reads (`aria-pressed`, roles, labels). Class names and colours change constantly and
pinning them buys nothing. Query by role and label rather than by test id, so the test
fails when the component becomes unusable, not when it is restyled.

## Coding conventions

- TypeScript, `strict` mode. No `any` unless unavoidable (and commented).
- Keep parsing in `lib/strava`; features consume `lib/domain` and view models — never raw CSV shapes in the UI.
- Numbers come from `lib/analytics` / `lib/reasoning` / `lib/intelligence`; language layers (Coach, MCP) orchestrate tools and must not invent metrics.
- Match the style of the surrounding code (naming, comment density, structure).

## Pull requests

1. Branch off `main` (`feat/…`, `fix/…`, `docs/…`, `chore/…`).
2. Keep PRs focused; large mechanical changes (e.g. formatting) belong in their own PR.
3. Fill out the PR template. Describe what changed, why, and how you verified it.
4. Ensure CI is green before requesting review.

## Reporting bugs / requesting features

Use the [issue templates](https://github.com/Padraigobrien08/strideiq/issues/new/choose). For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
