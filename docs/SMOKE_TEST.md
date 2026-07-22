# MVP smoke test checklist

Run after `npm install` (local) or after a production deploy. Mark each item pass/fail.

**Automated gate (run first):**

```bash
npm test && npm run build
# or: ./scripts/verify.sh
```

---

## Path A — Export only (no Strava API, no LLM)

No `.env.local` required (or empty aside from optional vars).

| #   | Step                                                         | Expected                                                      |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| A1  | `npm run dev` → open `/`                                     | Redirects or lands on app shell                               |
| A2  | **Import** → upload Strava export (`activities.csv` minimum) | Quality summary; run count shown                              |
| A3  | Optional: upload `activities/` FIT folder (step 2)           | FIT matched count increases                                   |
| A4  | **Home** (`/home`)                                           | Hero, KPIs or empty-state; no crash                           |
| A5  | **Training**                                                 | Volume / blocks render from CSV data                          |
| A6  | **Goals** → set race goal (distance + date)                  | Saves; readiness/prediction panels load                       |
| A7  | **Plan** → add planning context → **Generate plan**          | Week board preview appears                                    |
| A8  | **Plan** → **Save week**                                     | Saved state; refresh page — week still present (localStorage) |
| A9  | **Runs**                                                     | Table lists imported activities                               |
| A10 | Open one run → **Route** (if streams exist)                  | Map or graceful empty state                                   |
| A11 | **Intelligence**                                             | Belief / signals UI (may be sparse without API memory)        |
| A12 | **Coach**                                                    | Empty or limited state without server LLM (no `DATABASE_URL`) |
| A13 | **Settings** → theme toggle                                  | Light/dark switches                                           |
| A14 | **Report**                                                   | Printable report generates                                    |
| A15 | **Clear data** (Settings) → confirm dialog                   | Data cleared; Home shows import prompt                        |

---

## Path B — Strava OAuth + Coach (full stack)

Requires `.env.local` or Vercel env: `DATABASE_URL`, `SESSION_SECRET`, `STRAVA_*`, `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`). Migrations applied.

| #   | Step                                                       | Expected                                              |
| --- | ---------------------------------------------------------- | ----------------------------------------------------- |
| B1  | **Import** → **Connect Strava**                            | OAuth completes; redirect to import success           |
| B2  | Sync activities (import UI or API)                         | Run count matches Strava (approx.)                    |
| B3  | **Home**                                                   | Data from server merge; header shows source           |
| B4  | **Goals** → race goal                                      | Server preferences persist after refresh              |
| B5  | **Plan** → generate + save                                 | Same as Path A8                                       |
| B6  | **Coach** → send: `Why did my readiness change this week?` | Thread reply; tool-backed content (not instant error) |
| B7  | **Intelligence**                                           | Richer state when server bundle available             |
| B8  | **Settings** → enable webhooks (if `STRAVA_WEBHOOK_*` set) | Success message; subscription listed                  |
| B9  | `GET /api/health` (curl)                                   | OK on deployed host                                   |

---

## Path C — Production deploy spot-check

After [DEPLOYMENT.md](DEPLOYMENT.md) setup:

| #   | Step                                        | Expected                               |
| --- | ------------------------------------------- | -------------------------------------- |
| C1  | HTTPS loads without certificate errors      |                                        |
| C2  | OAuth uses production `STRAVA_REDIRECT_URI` | No redirect_uri mismatch               |
| C3  | Session persists across refresh after login |                                        |
| C4  | Coach chat works on production URL          |                                        |
| C5  | Webhook challenge (if enabled)              | Strava subscription active in Settings |

---

## Known MVP limitations (not failures)

| Item              | Note                                                          |
| ----------------- | ------------------------------------------------------------- |
| Unit preference   | Saved in Settings; charts still display km until next release |
| Plan persistence  | Browser `localStorage` only — not synced to Neon per user     |
| Coach without API | Export-only users get analytics; chat needs server + LLM keys |
| Webhook UI        | Client does not live-push; manual refresh after events        |
| Forecast Lab      | Hidden in production unless `NEXT_PUBLIC_FORECAST_LAB=1`      |

---

## Sign-off

| Environment | Tester | Date | Path A | Path B | Path C |
| ----------- | ------ | ---- | ------ | ------ | ------ |
| Local       |        |      | ☐      | ☐      | —      |
| Production  |        |      | ☐      | ☐      | ☐      |
