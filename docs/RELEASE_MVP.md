# StrideIQ MVP release notes

**Tag suggestion:** `v0.1.0-mvp`  
**Audience:** Private beta — runners with Strava export and/or Strava OAuth.

---

## Summary

StrideIQ MVP is a **local-first training intelligence dashboard**: import Strava data, get deterministic analytics and narrative insights, explore an **Athlete Intelligence Model**, generate and save an **adaptive weekly plan**, and investigate training questions with a **tool-grounded Coach** when server credentials are configured.

---

## What ships in MVP

### Data

- Strava bulk **export** import (CSV + optional FIT `activities/`)
- **Strava OAuth** sync to Neon Postgres
- Optional **webhooks** for background activity sync
- Client snapshot in `localStorage`; FIT streams in IndexedDB

### Product surfaces

| Area                       | Highlights                                                           |
| -------------------------- | -------------------------------------------------------------------- |
| **Home**                   | Operating-system layout: hero, week board, intelligence feed         |
| **Plan**                   | Planning context, generate/save week, execution vs Strava, DnD board |
| **Goals**                  | Race briefing V2, readiness, forecasts, mission control              |
| **Training / Performance** | Volume, blocks, efficiency, projections, records                     |
| **Runs**                   | Explorer, session intelligence, route replay                         |
| **Intelligence**           | Persistent belief model (not a chat UI)                              |
| **Coach**                  | Investigation workspace with tool-use loop                           |
| **Report**                 | Printable change summary                                             |
| **Import / Settings**      | Quality panel, units (stored), webhooks, clear data                  |

### Engineering

- 1,022 Vitest tests, production `next build`
- shadcn/ui component layer + premium typography (DM Sans + Syne)
- Docs: [FEATURES.md](FEATURES.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [SMOKE_TEST.md](SMOKE_TEST.md)

---

## What requires Strava API / server env

These features need `DATABASE_URL`, `SESSION_SECRET`, and Strava OAuth env vars (see [`.env.example`](../.env.example)):

| Feature                                  | Without server              |
| ---------------------------------------- | --------------------------- |
| Connect Strava / live sync               | ❌ Export only              |
| Coach chat (`/coach`)                    | ❌ No tool loop             |
| `GET /api/me/intelligence` (full bundle) | ❌ Limited client analytics |
| MCP package against hosted API           | ❌                          |
| Webhooks auto-sync                       | ❌                          |
| Server-side coach memory API             | ❌                          |

**Export-only path still provides:** Home, Training, Performance, Goals (predictions from CSV), Plan (local), Runs, Report, Intelligence (client-derived), Import quality.

---

## What requires LLM keys

| Feature                                        | Env                                         |
| ---------------------------------------------- | ------------------------------------------- |
| Coach replies                                  | `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` |
| AI weekly plan (when not using fallback rules) | `OPENAI_API_KEY`                            |

Fallback rule-based plan generation works without OpenAI when the API route allows it.

---

## Explicitly out of MVP (V1.1+)

- Hosted user auth / billing (Phase 6 in [PRODUCT.md](../PRODUCT.md))
- Unit conversion on all charts (preference saved only)
- Plan week synced to Neon (plan is `localStorage` today)
- Deep differentiation roadmap ([internal/DIFFERENTIATION_NORTH_STAR.md](internal/DIFFERENTIATION_NORTH_STAR.md))
- Legacy route removal (`/dashboard`, `/trends`, …)

---

## Upgrade / deploy notes

1. Apply DB migrations `001` → `003` before first OAuth user.
2. Set production `STRAVA_REDIRECT_URI` to `https://<host>/api/auth/strava/callback`.
3. Run [SMOKE_TEST.md](SMOKE_TEST.md) Path A locally, Path B with keys, Path C on Vercel.

---

## Changelog (high level)

- Adaptive **Plan workspace** with calendar board, planning context, planned vs actual
- **Home OS** layout with compact week calendar
- **Athlete Intelligence** + **Coach** split
- Forecasting V2 + goals race briefing
- Strava sync, webhooks, FIT pipeline, route replay
- UI: shadcn components, typography system

For file-level history, see git log on `main` / release branch.
