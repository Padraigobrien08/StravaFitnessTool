# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Local Postgres via `docker compose`, with a DB client that auto-selects the
  `postgres` driver for local/self-hosted URLs and Neon's driver for `*.neon.tech`.
- `npm run setup`, `npm run db:migrate`, `npm run db:reset`, `npm run dev:lan`,
  and `npm run lan` helper scripts; a real `.env.example`.
- Device access: Strava OAuth `redirect_uri` is derived from the request host
  (honoring `X-Forwarded-*`), so the app works from a LAN IP or a tunnel.
- Route-level `error.tsx` / `global-error.tsx` / `not-found.tsx`; `/api/health`
  reports what's configured and whether the database is reachable.
- Quality gate: `npm run check` (typecheck + lint + tests) and GitHub Actions CI;
  test coverage tooling (`npm run test:coverage`); CodeQL scanning.
- Community health: Contributing guide, Code of Conduct, Security policy, issue
  and PR templates, Dependabot.

### Fixed

- Runs with a missing/invalid date are dropped at parse time — previously an
  invalid date reached `date-fns` in a render path above the error boundary and
  white-screened the whole app.
- `computeInsights` and the mount-time status fetch are guarded so bad input or a
  down server degrades gracefully instead of crashing.
- A corrupt optional `goals.csv` / `general_preferences.csv` no longer discards a
  valid activities import.
- Pinned Turbopack's workspace root to the project to avoid a stray home-directory
  lockfile making the dev server index the entire home folder.

### Changed

- Cleared all lint errors and type errors; removed dead code across the tree.
