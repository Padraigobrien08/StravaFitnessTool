# Screenshots

These are committed and referenced from the main [README](../../README.md):

| File               | Route           | Source           | Size      |
| ------------------ | --------------- | ---------------- | --------- |
| `home.png`         | `/home`         | live Strava acct | 1430×950  |
| `coach.png`        | `/coach`        | live Strava acct | 1350×950  |
| `intelligence.png` | `/intelligence` | demo athlete     | 2880×1800 |
| `goals.png`        | `/goals`        | demo athlete     | 2880×1800 |

All dark theme (the app default).

Home and Coach are captured from a real synced account, because Coach chat cannot run on the
demo: the demo is client-side only, and `/api/chat` needs a server session plus a database
bundle for its tools. A demo-mode capture shows the gate banner instead of an answer, which
defeats the point of the screenshot. Those two are 1× browser captures rather than 2× headless
ones, so they are slightly softer than the other pair; at the ~850px GitHub renders README
images to, the difference is small.

## Regenerating

`npm run build && npm run start` first — the production build renders the same as dev and is
much lighter on memory than Turbopack (see [Troubleshooting](../../README.md#troubleshooting)).
Stop the server when you are done; do not leave one running.

**Demo-athlete shots (`intelligence`, `goals`)** can be fully automated. Drive the browser
headlessly so the framing stays reproducible: load `/import`, click **Try the demo**, wait for
`/home`, then visit each route. The demo seeds `localStorage` + IndexedDB client-side, so a cold
one-shot load captures the empty state instead — the click is required. Allow ~3–4s per route
after `networkidle` for charts to settle, and set `reducedMotion` so Recharts animations do not
land mid-transition.

**Live-account shots (`home`, `coach`)** need a real session. A headless run can mint one with
the scheme in `lib/auth/session.ts` (`userId.exp.hmac`, signed with `SESSION_SECRET`, set as
`strideiq_session` with `secure:false` over http), but it must be minted for the user id that
actually holds the synced data — which is not necessarily `STRIDEIQ_API_KEY_USER_ID`, since that
variable is set by hand and goes stale the moment a fresh OAuth creates a new user row. Check
before assuming: `/api/me/status` answering `{"connected":false}` for a session you just minted
means the id is wrong, not that the sync failed.

Trim any browser chrome that bleeds into a hand-taken capture:
`sips -c <h-10> <w> --cropOffset 0 0 shot.png --out shot.png`.

Keep the filenames stable — the main README references them directly, and a rename silently
turns the landing page back into a broken image.
