# Contributing to StrideIQ

Thanks for your interest in improving StrideIQ! This guide covers local setup, the checks we run, and how to propose changes.

## Ground rules

- Read [AGENTS.md](AGENTS.md) before non-trivial changes — it explains the product split (Dashboard / Intelligence / Coach) and the core code rules (no raw Strava CSV in UI, LLMs call tools, running vs. ecosystem, etc.).
- Be kind and constructive. This project follows a [Code of Conduct](CODE_OF_CONDUCT.md).

## Local setup

```bash
git clone https://github.com/Padraigobrien08/StravaFitnessTool.git
cd StravaFitnessTool
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

Use the [issue templates](https://github.com/Padraigobrien08/StravaFitnessTool/issues/new/choose). For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
