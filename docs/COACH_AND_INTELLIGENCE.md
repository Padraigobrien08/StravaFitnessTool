# Coach and Intelligence

StrideIQ splits **what the system believes** from **what you investigate**.

| Surface                    | Route           | Metaphor                                               |
| -------------------------- | --------------- | ------------------------------------------------------ |
| Athlete Intelligence Model | `/intelligence` | Persistent belief state — curated, read-first          |
| Coach                      | `/coach`        | Conversational investigation — ask, challenge, compare |

Both read the same underlying data via `hooks/useAthleteIntelligence()` → `lib/intelligence/athleteState.ts` → `lib/coach/activeIntelligence.ts`.

## Athlete Intelligence Model (`/intelligence`)

**Purpose:** Answer _“What does StrideIQ currently believe about me?”_

### Page structure (top → bottom)

1. **Hero** — Current belief, primary action, readiness/freshness/confidence/profile, meta (run count, data source).
2. **State evolution strip** — How readiness, freshness, efficiency, volume, and intensity are moving (sparklines + interpretation).
3. **Prioritized signal board** — One primary signal, secondary compact cards, amber watchlist.
4. **Decision support** — Risks, opportunities, primary action (bullet list), each with “Investigate with Coach”.
5. **Athlete memory + training ecosystem** — Side-by-side on desktop; memory as learned patterns; ecosystem interpretation-first with collapsed interference detail.
6. **Investigate with Coach** — Action cards with “why it matters” → deep links.

### Key files

```
app/intelligence/page.tsx
components/intelligence/intelligence-page.tsx
components/intelligence/intelligence-hero.tsx
components/intelligence/intelligence-sections.tsx
lib/intelligence/presentation.ts    # belief copy, signal prioritization, evolution strip
lib/intelligence/athleteState.ts      # selectors shared with Coach
```

### Deep links to Coach

`lib/coach/domainLinks.ts`:

- `coachUrl({ domain, q, investigate })`
- `topicCoachLink(topic, query)` → `/coach?topic=…&q=…&investigate=1`

Intelligence CTAs use these; Coach reads `domain`, `q`, and `investigate` search params on load.

## Coach (`/coach`)

**Purpose:** Answer _“Why?”, “What if?”, “Compare…”, “What should I do?”_ with tool-backed reasoning.

### Layout

- **Viewport-locked** chat shell (no document scroll; only the thread scrolls).
- **Left sidebar** (~260px) — new investigation, recent threads, pinned, domain rows.
- **Center** — conversation thread + sticky composer.
- **Right context rail** (~280px, collapsible) — focus, readiness, freshness, race, risk/opportunity snapshot.

### Conversation UX

- User messages: compact right-aligned bubbles.
- Assistant messages: analytical prose (summary → recommendation → evidence → grounding meta).
- Empty thread: investigation starters from workspace state (not a fake preloaded report).
- Loading: phased messages + optional tool names; smart scroll (only auto-scroll when near bottom).

### Key files

```
app/coach/page.tsx
components/coach/coach-reasoning-workspace.tsx
components/coach/coach-reasoning-panel.tsx
components/coach/coach-conversation-turn.tsx
components/coach/coach-composer.tsx
components/coach/coach-workspace-sidebar.tsx
components/coach/coach-mini-context.tsx
hooks/use-coach-thread.ts
lib/coach/threadStorage.ts          # localStorage threads
lib/coach/parseResponse.ts          # structured ## sections from LLM
lib/coach/activeIntelligence.ts     # workspace state builder
app/api/chat/route.ts               # POST → runCoachChat
```

### Requirements for full Coach

1. Strava connected and synced (`POST /api/sync/strava` or webhook).
2. `GET /api/me/status` shows connected + runs > 0.
3. `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env.local`.
4. Migration `002_coach.sql` applied (preferences / race goals).

Without server data, the UI renders but chat is disabled with an explanatory banner.

## Shared intelligence state

`CoachWorkspaceState` (`lib/coach/types.ts`) includes:

- `snapshot` — readiness, freshness, TSB, race countdown, confidence
- `observations` — active signals (tone, domain, confidence)
- `domains` — coaching domains with suggested queries
- `memory` — longitudinal snippets (best block, intensity pattern, etc.)
- `risksAndOpportunities` — risk vs opportunity items
- `investigations` — suggested opening questions

Built in `buildCoachWorkspaceState()` from `DashboardInsights` + insights + race goal.

## LLM + tools flow

```
User message (Coach UI)
    → POST /api/chat { messages }
    → intelligenceContextFromRequest (session)
    → runCoachChat (OpenAI or Anthropic)
    → tool calls → executeIntelligenceTool()
    → deterministic engines / reasoning primitives
    → structured reply → parseCoachResponse()
```

The system prompt enforces tool use before claims and requires confidence/limitations in structured sections.

## MCP parity

`packages/strideiq-mcp` calls the same tools via `GET /api/me/intelligence?section=…` with session cookie or `STRIDEIQ_API_KEY`.

Use the same race goal and sync discipline as the web app for consistent answers.

## Product rules (integrity)

- **Do not** duplicate the full Intelligence dashboard inside Coach.
- **Do not** treat non-run modalities as direct predictors of race time without calibration language.
- **Do** route users from Intelligence → Coach for any “why” or “investigate” action.
- **Do** keep analytics deterministic; UI copy may summarize but numbers come from engines.
