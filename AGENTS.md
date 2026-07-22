# Agent guide — StrideIQ

Read this before making non-trivial changes.

## Product split

| Surface      | Route                   | Do                                |
| ------------ | ----------------------- | --------------------------------- |
| Dashboard    | `/home`, `/training`, … | Question-led charts + insights    |
| Intelligence | `/intelligence`         | Curated belief model (read-first) |
| Coach        | `/coach`                | Threaded investigation chat       |

Do **not** merge Intelligence into Coach or duplicate full dashboards in either surface.

## Code rules

1. **No raw Strava CSV in UI** — `lib/strava` → `lib/domain` → features.
2. **LLMs call tools** — numbers come from `lib/analytics`, `lib/reasoning`, `lib/intelligence/tools.ts`.
3. **Running vs ecosystem** — race predictions from runs; gym/bike/swim affect fatigue/interference context.
4. **Coach layout** — viewport-locked; only `.coach-reasoning-scroll` scrolls; composer is `shrink-0`.

## Key entry points

```
hooks/useTrainingIntelligence.ts     # Most dashboard pages
hooks/useAthleteIntelligence.ts      # Intelligence + Coach
lib/coach/activeIntelligence.ts      # Workspace state builder
lib/intelligence/athleteState.ts     # Shared selectors
app/api/chat/route.ts                # Coach POST
lib/intelligence/tools.ts            # Tool registry
```

## Docs

- [README.md](README.md) — setup, env, routes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, APIs, migrations
- [docs/COACH_AND_INTELLIGENCE.md](docs/COACH_AND_INTELLIGENCE.md) — two surfaces
- [PRODUCT.md](PRODUCT.md) — product contract

## Commands

```bash
npm run dev
npm test
npm run build
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
