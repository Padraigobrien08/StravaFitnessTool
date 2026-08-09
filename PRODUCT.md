# StrideIQ — Product Contract

## Positioning

|               |                                                                            |
| ------------- | -------------------------------------------------------------------------- |
| **Was**       | Strava export viewer (tabs of charts)                                      |
| **Is**        | Private training intelligence dashboard for runners                        |
| **Principle** | Every screen answers one user question — not an open-ended chart warehouse |

## User questions → surfaces

| Question                               | Surface                                     |
| -------------------------------------- | ------------------------------------------- |
| Am I improving?                        | Home insights, Trends, Performance, Records |
| Am I training correctly?               | Training, Effort, intensity insights        |
| Am I ready for my goal?                | Goals, Readiness, Race predictions          |
| What should I do next?                 | Home recommendations, Goals                 |
| What changed recently?                 | Home, Reports                               |
| What does the system believe about me? | **Intelligence** (`/intelligence`)          |
| Why / compare / investigate?           | **Coach** (`/coach`)                        |

See [docs/COACH_AND_INTELLIGENCE.md](docs/COACH_AND_INTELLIGENCE.md).

## Architecture rules

1. **UI never parses raw Strava CSV** — `lib/strava` → `lib/domain` → features/charts
2. **Insights before charts** — narrative cards with evidence + confidence
3. **Defensible analytics** — data quality panel on every major view
4. **Privacy-first** — local parse by default; cloud is V2

## Domain model (normalized)

See `lib/domain/activity.ts`. Strava-specific fields stay in the parser layer only.

## Insight shape

```ts
type Insight = {
  id: string;
  question: "improving" | "training" | "ready" | "next" | "changed";
  title: string;
  severity: "positive" | "neutral" | "warning";
  evidence: string[];
  recommendation?: string;
  confidence: "low" | "medium" | "high";
};
```

## Roadmap phases (this repo)

- [x] Phase 0 — Product contract (this doc)
- [x] Phase 1 — Domain layer, Zustand settings, feature-oriented components
- [x] Phase 2 — Home hub, insight cards, data quality, runs search/sort
- [x] Phase 3 — Import quality validation
- [x] Phase 4 — Customer-facing IA (Home, Training, Performance, Goals, Reports, Settings)
- [x] Phase 5 — Insight engine v1
- [x] Phase 5b — Strava OAuth + Neon sync, webhooks, FIT streams
- [x] Phase 5c — Coach chat + MCP + reasoning tools (`lib/reasoning/`)
- [x] Phase 5d — Intelligence page + Coach workspace split
- [ ] Phase 6 — Auth, billing, Sentry, PostHog, E2E (V2 hosted)
- [ ] Phase 7 — **Differentiation:** deeper athlete memory, causality, adaptive goals (see [docs/internal/DIFFERENTIATION_NORTH_STAR.md](docs/internal/DIFFERENTIATION_NORTH_STAR.md))

## Differentiation (north star)

Not: dashboard + chat over metrics.  
**Is:** interactive endurance reasoning + personal adaptation intelligence.

Priority moat features: conversational **why** (reasoning tools), **training memory**, **causality**, **adaptive goals**, memory-weighted **planning**, **comparative self** phases.  
See `docs/internal/DIFFERENTIATION_NORTH_STAR.md`.
