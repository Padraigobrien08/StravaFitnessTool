# Screenshots

These are committed and referenced from the main [README](../../README.md):

| File               | Route           | Viewport  |
| ------------------ | --------------- | --------- |
| `home.png`         | `/home`         | 1440×1260 |
| `intelligence.png` | `/intelligence` | 1440×900  |
| `goals.png`        | `/goals`        | 1440×900  |
| `coach.png`        | `/coach`        | 1440×900  |

All four are the built-in demo athlete, dark theme (the app default), `deviceScaleFactor: 2`.
Home uses a taller viewport on purpose: its left column is shorter than the right, so at 900px
the projected-finish and change-feed blocks fall below the fold and the frame looks half-empty.

## Regenerating

1. `npm run build && npm run start` — the production build renders the same as dev and is much
   lighter on memory than Turbopack (see [Troubleshooting](../../README.md#troubleshooting)).
2. Drive it headlessly rather than screenshotting by hand, so the framing stays reproducible:
   load `/import`, click **Try the demo**, wait for `/home`, then visit each route. The demo
   seeds `localStorage` + IndexedDB client-side, so a cold one-shot load of `/home` captures the
   empty state instead — the click is required.
3. Allow ~3–4s per route after `networkidle` for charts to settle, and set `reducedMotion` so
   Recharts animations do not land mid-transition.
4. Stop the server afterwards. Do not leave one running.

Keep the filenames stable — the main README references them directly, and a rename silently
turns the landing page back into a broken image.
