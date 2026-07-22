# Production deployment (Vercel + Neon + Strava)

StrideIQ is a Next.js 16 app. Production hosting is designed around **Vercel** for the web app and **Neon** for Postgres when using Strava OAuth, Coach, and webhooks.

---

## Prerequisites

| Service                                               | Purpose                                          |
| ----------------------------------------------------- | ------------------------------------------------ |
| [Vercel](https://vercel.com)                          | Host Next.js (`app/`, API routes)                |
| [Neon](https://neon.tech)                             | Postgres for activities, sessions, coach threads |
| [Strava API app](https://www.strava.com/settings/api) | OAuth + optional webhooks                        |

Local-only (export CSV) builds do **not** require Neon or Strava API keys.

---

## 1. Neon database

1. Create a Neon project and copy the **pooled** connection string (`postgresql://…?sslmode=require`).
2. Run migrations in order (Neon SQL editor or `psql`):

   ```bash
   psql "$DATABASE_URL" -f db/migrations/001_initial.sql
   psql "$DATABASE_URL" -f db/migrations/002_coach.sql
   psql "$DATABASE_URL" -f db/migrations/003_route_geometry.sql
   ```

3. Set `DATABASE_URL` in Vercel (see below).

---

## 2. Strava API application

In [Strava → My API Application](https://www.strava.com/settings/api):

| Field                             | Production value                                                 |
| --------------------------------- | ---------------------------------------------------------------- |
| **Authorization Callback Domain** | Your Vercel hostname only (e.g. `strideiq.vercel.app`) — no path |
| **Website**                       | Marketing URL or repo (optional)                                 |

Environment variables (Vercel → Settings → Environment Variables):

| Variable               | Example (production)                           |
| ---------------------- | ---------------------------------------------- |
| `STRAVA_CLIENT_ID`     | From Strava app                                |
| `STRAVA_CLIENT_SECRET` | From Strava app                                |
| `STRAVA_REDIRECT_URI`  | `https://YOUR_DOMAIN/api/auth/strava/callback` |

**Must match exactly** what Strava accepts for the callback domain + path.

### Webhooks (optional auto-sync)

| Variable                      | Value                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Random string you choose (Strava subscription + challenge) |
| `STRAVA_WEBHOOK_CALLBACK_URL` | `https://YOUR_DOMAIN/api/webhooks/strava`                  |

After deploy:

1. Open **Settings** in the app (while connected via OAuth).
2. Use **Enable auto-sync** (calls `POST /api/webhooks/strava/subscribe`).

Strava will send `GET` challenge and `POST` activity events to `/api/webhooks/strava`.

---

## 3. Vercel project

### Import repo

1. Vercel → **Add New Project** → import Git repository.
2. Framework preset: **Next.js** (default).
3. Build command: `npm run build` (default).
4. Install command: `npm install` (default).

### Environment variables

Copy from [`.env.example`](../.env.example). Minimum for **full** MVP:

| Variable                      | Required        | Notes                   |
| ----------------------------- | --------------- | ----------------------- |
| `DATABASE_URL`                | OAuth / Coach   | Neon pooled URL         |
| `SESSION_SECRET`              | OAuth / Coach   | `openssl rand -hex 32`  |
| `STRAVA_CLIENT_ID`            | OAuth           |                         |
| `STRAVA_CLIENT_SECRET`        | OAuth           |                         |
| `STRAVA_REDIRECT_URI`         | OAuth           | Production callback URL |
| `OPENAI_API_KEY`              | Coach + AI plan | Or `ANTHROPIC_API_KEY`  |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Webhooks        | Optional                |
| `STRAVA_WEBHOOK_CALLBACK_URL` | Webhooks        | Optional                |

Optional:

| Variable                                        | Purpose                                  |
| ----------------------------------------------- | ---------------------------------------- |
| `OPENAI_MODEL`                                  | Coach model (default `gpt-4o-mini`)      |
| `OPENAI_WEEKLY_PLAN_MODEL`                      | Weekly plan generation                   |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`         | Coach fallback                           |
| `STRIDEIQ_API_KEY` + `STRIDEIQ_API_KEY_USER_ID` | MCP / automation                         |
| `NEXT_PUBLIC_FORECAST_LAB=1`                    | Expose `/dev/forecast-lab` in production |

Apply to **Production** (and Preview if you want OAuth on preview deployments — use a separate Strava callback or ngrok for previews).

### Domains

1. Assign production domain (e.g. `strideiq.app` or `*.vercel.app`).
2. Update `STRAVA_REDIRECT_URI` and `STRAVA_WEBHOOK_CALLBACK_URL` to that host.
3. Redeploy after env changes.

---

## 4. Post-deploy verification

Run the [smoke test checklist](SMOKE_TEST.md) against production URL.

Quick API checks:

```bash
curl -sS "https://YOUR_DOMAIN/api/health"
```

Expect a healthy response when the app is up.

---

## 5. Local production-like testing

Use ngrok (or similar) when testing OAuth/webhooks against `npm run dev`:

```bash
ngrok http 3000
```

Set:

- `STRAVA_REDIRECT_URI=https://xxxx.ngrok-free.app/api/auth/strava/callback`
- `STRAVA_WEBHOOK_CALLBACK_URL=https://xxxx.ngrok-free.app/api/webhooks/strava`

Add the ngrok hostname to Strava **Authorization Callback Domain** (hostname only).

---

## Security checklist

- [ ] `.env.local` never committed (see `.gitignore`)
- [ ] `SESSION_SECRET` unique per environment
- [ ] Strava client secret only in Vercel env, not in repo
- [ ] `STRIDEIQ_API_KEY` rotated if leaked
- [ ] Neon credentials use least-privilege role where possible

---

## Related

- [README.md](../README.md) — quick start
- [RELEASE_MVP.md](RELEASE_MVP.md) — what ships in MVP vs API-dependent features
- [SMOKE_TEST.md](SMOKE_TEST.md) — manual QA paths
