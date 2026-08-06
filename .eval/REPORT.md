# StrideIQ — Verification & Quality Audit

**Date:** 2026-08-05
**Auditor role:** senior software engineer, independent verification pass
**Repo state:** branch `main`, clean, HEAD `1aa1d4c`
**Scope:** assessment only — no production code was modified **during the audit
itself**. D-1, D-2, D-3, R-1, F-6, F-8, G-2, G-3, remediation items #5 (effort-set
semantics) and #7 (API-route coverage), and the three defects that fixing those surfaced
(D-5, D-6, D-7) were subsequently fixed on operator instruction and merged to `main`; see the remediation addendum immediately below. All findings in
Sections A–H describe the pre-fix state at HEAD `1aa1d4c` and are left unedited as the
historical record — **including §F-10, whose stated hypothesis the R-1 fix disproved.**
That correction is recorded in the addendum rather than by rewriting the finding.

> **Input caveat — the inventory document does not exist.** The task specified a
> three-way diff against a code-derived inventory at `{INVENTORY_PATH}`, but that
> placeholder arrived unsubstituted and no such document exists in the repo
> (`find . -iname "*inventory*"` excluding `node_modules`/`.git` → no matches;
> `.eval/` did not exist before this audit). Per the operator's explicit
> instruction ("no inventory doc exists, proceed two-way"), **Section C is a
> two-way diff: `docs/FEATURES.md` vs the code.** Every drift row below is
> therefore doc-vs-code only; no third source was consulted or invented.

---

## Remediation addendum — D-1 – D-8, R-1, F-6, F-8, G-1 – G-4, #5, DD-1 and #21 fixed (post-audit)

_Every High- and Medium-severity finding in this report is now fixed and merged, across 12
PRs (#107 – #118)._

Fixed on operator instruction after the audit closed. Findings above are unchanged.

### D-1 — R² computation (`lib/analytics/predictions.ts`)

`ssRes` now reduces over `xs` (log-distance) instead of `ys` (log-time), so
residuals are measured against the fitted line at each point's predictor.

| Metric (demo athlete, 227 points)     | Before       | After      |
| ------------------------------------- | ------------ | ---------- |
| `regression.rSquared`                 | **−143.078** | **0.947**  |
| User-facing prose                     | "R²=-143.08" | "R²=0.95"  |
| Perfect-power-law probe (must be 1.0) | −79.451      | **1.0** ✅ |

**⚠️ Behaviour change worth reviewing.** The `confidence = "high"` gate at
`predictions.ts:327` (`rSquared > 0.9`) was previously **unreachable dead code**;
with a valid R² it now fires, and the demo athlete's race prediction flipped from
`"medium"` to **`"high"`**. That is the correct consequence of the fix, but the
underlying effort set still contains easy runs and the fitted `exponent` is still
**0.991** (implausibly linear — no pace fade). So the label is now reachable but
arguably overconfident: R²=0.947 confirms the line fits the easy-run cloud, not
that race capability is well modelled. **This is remediation item #5
(effort-set semantics), which is a product decision and was deliberately left
untouched.** Until it is resolved, consider whether the `>0.9` threshold should be
raised or additionally gated on effort quality.

### D-2 — Forecast scoring (`lib/forecasting-v2/calibration.ts`)

Added a race-plausibility filter: an effort may score a forecast only if
`timeSec <= p90Sec * (1 + RACE_ATTEMPT_MAX_SLOWDOWN_VS_P90)`, with the constant
exported at 0.15 for tuning.

**Deliberate departure from the report's stated direction.** §DD-3 recommended
"select the fastest rather than the earliest." On implementation I kept
**earliest** selection, because `calibration.test.ts:35` explicitly asserts
earliest-match and the function's docstring documents it — that is a deliberate,
tested design decision, and the fitness-drift argument supports it (a forecast
should be graded by the race nearest its issuance, not one three months later).
The defect was that _training runs_ qualified at all, not earliest-vs-fastest, so
the filter alone resolves it with no semantic change.

| Scenario                                                      | Before                                                         | After                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| Easy 21 km (2:10) 3 days post-issue, then real race (1:29:50) | scored the **easy run**: 40 min optimistic, 0% within interval | scores the **race**: −10 s, within interval ✅ |
| Easy 19.7 km trudge (2:20) only                               | accepted as an HM result                                       | left **pending** ✅                            |
| Genuine bad race (1:44:10)                                    | counted as a miss                                              | still counted as a miss ✅                     |

The third row matters: the filter is tuned to exclude training runs (25–45%
slower than race pace) without hiding real misses (a bad race lands within ~15%
of p90), so calibration does not become self-flattering.

### D-3 — Medical-language defense (3 files + 1 new shared module)

Root cause was two-dimensional: a **narrow vocabulary** and **incomplete field
coverage**, with the integrity layer additionally keeping **two divergent copies**
of `MEDICAL_PATTERNS` (8 patterns in `safetyChecks.ts`, a different 4 in
`evaluateRecommendation.ts`).

New single source of truth: **`lib/safety/medicalLanguage.ts`** — a leaf module, so
neither package's existing mutual imports get worse. It is deliberately asymmetric:

- `softenMedicalLanguage()` — 28 rewrites with clean grammatical substitutions
  (inflected forms handled separately, so "treats" → "supports" not "support"),
  now also **case-preserving** so a sentence-initial term is not lower-cased
  ("Healing the calves" → "Recovery the calves").
- `containsMedicalClaim()` — **broader than rewriting by design.** 14 named
  clinical conditions + 18 claim patterns. A claim about a named condition cannot
  be regex-rewritten into safety, so it is flagged rather than patched.

**The escalation path is what actually makes this safe,** and it already existed —
DD-2 proved the ladder works. A flagged claim fails integrity, survives repair
(the words are still there), fails the second integrity check, and
`buildSafeFallbackWeeklyPlan` replaces the plan wholesale with in-house prose.

Field coverage widened on both sides to every athlete-readable field —
`rationale.*`, `alternatives[]`, workout `title`/`type`/`constraintsApplied` were
previously scrubbed by neither layer. Structural fields (`day`, `weekStart`,
`modality`, `intensity`) are deliberately untouched.

**False-positive control.** Two allowlists prevent the wider net from misfiring:
the disclaimers the system itself generates on repair ("Not medical advice:
consult a professional…" — otherwise a correctly-repaired plan would be flagged
again and needlessly discarded), and the benign coaching idiom "treat this/the
long run as …", shielded from both rewriting and detection.

| Scenario                                                                                                           | Before                                                                                                         | After                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `evaluateRecommendation`: "treat and cure your stress fracture, heal your tendinitis, rehab your IT band syndrome" | **passed, 100/100, severity none**                                                                             | **fails, 75, high** ✅                                                            |
| Plan pipeline with medical text in every field                                                                     | `source: "repaired"`, text intact: _"…assess and **treat** your **stress fracture** and **cure** your injury"_ | `source: "fallback"` — **0 of 11 clinical terms present** anywhere in the plan ✅ |
| "Keep runs easy, treat this as a recovery week, add achilles mobility"                                             | passed                                                                                                         | still passes (no false positive) ✅                                               |
| System's own repair disclaimer                                                                                     | passed                                                                                                         | still passes ✅                                                                   |

### R-1 / F-10 — Strava webhook signature (2 files + 2 new test files, 3 docs)

**My audit hypothesis was wrong, and the defect was real anyway.** §F-10 flagged
this as explicitly _unverified_ and hypothesised that "Strava does not sign webhook
payloads." That hypothesis is **incorrect** — Strava does sign them. The
_consequence_ I flagged is confirmed: the handler required a header Strava never
sends, so `verifyWebhookSignature` returned false for every genuine delivery and the
endpoint answered 403 to all of them. **Push auto-sync had never worked.**

Verifying it was not clean, and one source was actively misleading:

| Source                                                                                  | Said                                                                                                                                   | Verdict                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Strava webhooks overview](https://developers.strava.com/docs/webhooks/)                | No signature mechanism at all                                                                                                          | **Incomplete** — this is what produced my wrong hypothesis                                                                                                                                          |
| Web search summary                                                                      | `X-Strava-Signature` with `t=`/`v1=` and 300s tolerance                                                                                | **Discarded as unreliable**: its cited links were all GitHub/Meta docs, and the scheme it described is verbatim _Stripe's_ `Stripe-Signature` format. It looked like confabulation by pattern-match |
| [Strava's reference implementation](https://developers.strava.com/docs/webhookexample/) | Verifies `X-Strava-Signature`, `t=`/`v1=`, HMAC over `` `${t}.${rawBody}` ``, hex, 300s, `timingSafeEqual`, dedicated `SIGNING_SECRET` | **Authoritative** — Strava-authored code                                                                                                                                                            |

The search's _conclusion_ turned out correct while its reasoning was untrustworthy; I
acted only on the Strava-authored code. Note the two official pages genuinely
contradict each other, and neither states where the signing secret is surfaced.

Four things were wrong in `lib/strava/webhooks/verify.ts`:

|                   | Was                                              | Is                                                                                               |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Header            | `x-hub-signature-256` (a GitHub/Meta convention) | `x-strava-signature`                                                                             |
| Signed payload    | raw body alone                                   | `` `${t}.${rawBody}` ``                                                                          |
| Key               | OAuth **client secret**                          | dedicated `STRAVA_WEBHOOK_SIGNING_SECRET`                                                        |
| Replay protection | none                                             | timestamp age ≤ 300s (the timestamp is inside the signed payload, which is what makes this work) |

Still fails closed when the secret is unset — the handler's delete branch removes an
athlete's activity, so a spoofed event would be destructive, not merely noisy. The
observable behaviour is unchanged (403), but the reason is now logged
(`[strava webhook] rejected: …`); a silent 403 on every delivery is exactly what hid
this. **Breaking for existing webhook users:** `STRAVA_WEBHOOK_SIGNING_SECRET` is now
required, and is documented in `.env.example`, `docs/DEPLOYMENT.md` and the README.

**What remains unverified.** Live delivery still cannot be exercised here — it needs a
public HTTPS callback and a real Strava subscription. The scheme is now implemented
against Strava's own code and covered by tests, but the first genuine webhook after
the secret is configured is the actual proof. The GET subscription-challenge flow was
already correct and is unchanged (tests added).

### F-8 — `npm test` could delete production rows (4 test files + 1 new guard, 2 docs)

The only finding in this set that was a **process** hazard rather than a wrong result,
and the one that could have destroyed real user data.

The four suites in `lib/db/__tests__/` round-trip against a real Postgres and `DELETE`
rows. They were gated on `!!process.env.DATABASE_URL` — the same variable `.env.local`
points at a live Neon instance. **They skipped only because Vitest does not load
`.env.local`: luck, not design.** Anyone who exported `DATABASE_URL` to run a migration
and then ran `npm test` in that shell would have deleted from production, as would any
future change teaching `vitest.config.ts` to load `.env.local`. Blast radius was bounded
to fixed test UUIDs, but it included `DELETE FROM users`.

Two protections, since either alone leaves a hole:

1. **A separate variable** — gating moved to `TEST_DATABASE_URL`, which no ambient
   production credential can supply. When set it also overrides any inherited
   `DATABASE_URL` for the test process, so the client cannot reach anywhere else.
2. **A host allowlist that throws** (`lib/db/__tests__/testDatabase.ts`) — a non-local
   host **fails loudly** rather than skipping. Silently skipping would hide exactly the
   misconfiguration worth shouting about.

Verified across every gate state:

| Environment                       | Result                                                     |
| --------------------------------- | ---------------------------------------------------------- |
| nothing set                       | 11 skipped — unchanged default                             |
| `DATABASE_URL=<neon-shaped>`      | **11 skipped** ← the regression, closed                    |
| `TEST_DATABASE_URL=<localhost>`   | 28 passed against Docker Postgres                          |
| both, test URL local              | 28 passed **against localhost** — production value ignored |
| `TEST_DATABASE_URL=<neon-shaped>` | **throws**, names the host, lists what is allowed          |

**17 tests cover the guard itself** — the suffix trick (`localhost.evil.com`), private
ranges (`10.x`, `192.168.x`), IPv6 bracket stripping, case folding, unparseable strings,
and the exact URL shape sitting in `.env.local`. Testing it directly matters because
everything it protects is skipped by default, so a regression in the guard would stay
invisible until it deleted something.

Documented in `CONTRIBUTING.md` (new "Database tests" section) and `.env.example`. CI is
unaffected — it sets neither variable. One deliberate consequence: a bad
`TEST_DATABASE_URL` fails _every_ file in `lib/db`, the guard's own test file included,
because the check throws at module load. That is the intended loudness, but the failure
reads broader than it is.

**Note for anyone reproducing this audit:** §B's validation commands are now stale.
`DATABASE_URL=<local> npx vitest run lib/db` no longer runs those suites — use
`TEST_DATABASE_URL` instead.

### #5 — Effort-set semantics (3 files + 2 V2 call sites)

The audit's remediation item #5, and §H.3's open product question. **The codebase
already contained the answer** — `lib/analytics/workoutType.ts` classifies every run
(`race`/`tempo`/`interval`/`easy`/`recovery`/`long`), `computeInsights` already computed
those labels at `index.ts:299`, and `physiology.ts` already set the precedent for
threading them in with graceful degradation. No new threshold had to be invented; the
fix was to _use_ the existing authority. Investigating before implementing is what
turned a product decision into an engineering one.

`collectEffortPoints` admitted **any** whole activity 3–30 km run at 8:00/km or better,
then called the result "race-quality efforts". Whole activities are now admitted only
when classified as raced, tempo or interval work. `easy` and `recovery` are excluded as
obviously not efforts; **`long` is excluded deliberately** — a long run is
distance-relevant but aerobic, and durability is modelled separately by
`durabilityModel`. Callers without labels keep the pace gate alone, and the explanation
text now describes whichever filter actually applied instead of claiming race quality
either way.

| Demo athlete     | Before                     | After                      |
| ---------------- | -------------------------- | -------------------------- |
| efforts          | 227                        | **64**                     |
| slowest admitted | 6:00/km easy run           | **4:54/km tempo**          |
| fitted exponent  | 0.991 (implausibly linear) | **1.063** — Riegel to 2 dp |
| R² / points      | 0.947 / 227                | 0.964 / 64                 |

The exponent landing on Riegel's 1.06 is the strongest evidence the filter is right: it
was not tuned toward that value, it fell out of excluding easy running.

**This closes the loop opened by D-1.** The `confidence = "high"` label that fixing the
R² bug made _reachable_ is now **earned** — a clean fit over 64 genuine efforts with a
physiologically plausible exponent — rather than asserted over a cloud of easy running.
The concern raised in the D-1 section above is resolved.

**One shared predicate.** V2 carried two divergent inline copies of its race-like test
and V1 had none; there is now a single exported `isRaceLikeEffort`. It also gains a case
both copies missed — _a whole activity that was actually raced_. Previously only FIT lap
blocks and best-effort windows qualified, so the demo athlete's **22 race-like efforts
were recorded as 0**. V2's headline is unchanged at 1:37:48: the metadata was wrong, not
the engine.

**Honest trade-off:** athletes with no classified quality work now have too few points
for a curve (`fitPowerLawRegression` needs ≥3) and correctly get "Not enough efforts for
a reliable personalized curve" rather than a confident wrong one.

#### Two further defects found while fixing this (new — not in the original audit)

**D-5 (Medium) — `predictMultiAnchor` never sorted.** `predictions.ts` compared
`a.timeSec / a.distanceKm - b.timeSec / b.timeSec`; the second term is always `1`, so
the comparator returned `pace(a) - 1` and never compared the two efforts. "Top 3 efforts
by speed" picked arbitrarily. **Fixed** in the same change, with a test asserting the
model now anchors on the fastest efforts.

**D-6 (High) — the Cameron model is badly wrong.** (Fixed subsequently in #111; the
numbers below are the pre-fix state that fixing the effort set exposed.) With the effort
set corrected, the residual V1/V2 disagreement resolves almost entirely to one model:

| Model                   | HM prediction |
| ----------------------- | ------------- |
| Riegel                  | 1:33:45       |
| Personalised regression | 1:42:54       |
| Multi-anchor            | 1:34:29       |
| **Cameron**             | **2:30:23**   |
| V1 consensus            | 1:50:23       |
| **Forecast V2**         | **1:37:48**   |

`predictCameron` uses `T2 = T1 · (D2/D1) · (2 - D1/D2)`. As the extrapolation grows the
final factor tends to **2**, so it roughly doubles predicted pace for a 5 km → half
marathon projection. Its only test asserts it exceeds Riegel — which that inflation
guarantees, so the test passes while the model is wrong. The other three models agree at
1:33–1:43, and V2 sits with them.

**This was the largest known numerical error in the product**, and user-reachable: the
consensus feeds `/performance` and the `get_predictions` tool, which is exposed via MCP.
**Fixed in #111 — see the D-6 section below.** My initial call to defer it ("a modelling
decision, not the filtering change that was asked for") was wrong, and is corrected
there.

### D-6 — The Cameron model (1 file)

**Correction to my own judgement.** I deferred this as "a modelling decision, not a
filtering change" (see the #5 section above). That was wrong. The model is presented to
the athlete as **"Cameron (1982)"**, a named published equivalence model, and implemented
`T₂ = T₁ · (D₂/D₁) · (2 − D₁/D₂)` — which is not Cameron's model, or any published model.
Code that claims a specific named model and implements something else is a **bug**;
_removing_ the model would have been the product decision I was guarding against.

Cameron's published form is `T₂ = T₁ · (D₂/D₁) · (a(D₁)/a(D₂))` with
`a(d) = 13.49681 − 0.048865·d + 2.438936/d^0.7905` and **d in miles** — the coefficients
are fitted to imperial distances and give nonsense in kilometres, so the conversion is
now explicit.

**Validated against external references, not against the implementation:**

| From      | To       | This code | Published tables |
| --------- | -------- | --------- | ---------------- |
| 20:00 5K  | 10K      | 41:40     | ~41:35–41:45     |
| 20:00 5K  | HM       | 1:31:51   | ~1:32–1:33       |
| 20:00 5K  | marathon | 3:15:11   | ~3:14–3:16       |
| 50:00 10K | marathon | 3:54:16   | ~3:52–3:56       |

It also stays slower than Riegel at marathon distance, which is the conservatism this
model exists to contribute.

| Demo athlete               | Before       | After           |
| -------------------------- | ------------ | --------------- |
| Cameron HM                 | 2:30:22      | **1:33:34**     |
| V1 consensus               | 1:50:23      | **1:36:10**     |
| spread across models       | 57 min       | **9 min**       |
| consensus vs legacy Riegel | 26 min apart | **35 s apart**  |
| consensus vs Forecast V2   | 13 min apart | **2 min apart** |

**This closes §DD-5's "two engines in the same `DashboardInsights` object disagree by 26
minutes".** Three separate defects were compounding into that one wrong number: the R²
statistic (D-1), the effort set (#5), and this. All four V1 models plus V2 now sit inside
a 9-minute band. V2's fixture gate still passes, 0 errors and the same 2 pre-existing
warnings.

Left alone deliberately: the `"(1982)"` in the model name. I could not confirm the date —
Cameron's formula is more commonly dated 1998 — and it is not part of this defect. The
displayed formula string _was_ part of it (it documented the wrong equation) and is
corrected.

**User-visible:** predicted race times on `/performance` and via `get_predictions` change
for every athlete. They were wrong before.

### G-1 / #7 — API-route coverage (6 new test files, 1 route change)

The one item in this set that was a **coverage** gap rather than a defect — and it turned
up a defect anyway.

All **26 API routes were at 0%**, and `lib/auth` at 0% beside them. For an app whose
entire server surface is `/api/me/*`, the property everything else rests on — _you cannot
read another athlete's data without credentials_ — was asserted nowhere. 107 tests now
cover it, in four groups:

| Group                  | What it pins                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth enforcement**   | All 26 protected handlers return 401 unauthenticated. Runs the **real** auth code against an empty cookie jar rather than mocking `getSessionUserId`, so it exercises the path a caller hits. A length assertion fails if a route is added without an entry.                    |
| **Session tokens**     | Round-trip; tampered user id, expiry and signature; wrong-length signature; a token signed under a different secret; expiry either side of the boundary; refusal to run without a usable `SESSION_SECRET`.                                                                      |
| **Dual auth path**     | §F-2's escalation invariant — five attempts to redirect a valid API key at another athlete via query params and headers, all resolving to the env-configured user; a session not overridden by an injected key header; the raw cookie-header fallback still verifying the HMAC. |
| **Validation + OAuth** | 400 on unparseable bodies, 422 on schema violations, reads scoped to the session user; and the handshake — state is 128 bits of hex, persisted, per-request, consumed on use, with **every** failure past the state check asserted to leave no session behind.                  |

A deliberate consequence of using real auth: **no database mocks were needed**, because a
route that rejects properly returns before touching persistence. That turned into a
diagnostic — a route that _needed_ a mock would be telling us it does work before checking
who is asking. Two did, and both are recorded below.

|                    | Before       | After       |
| ------------------ | ------------ | ----------- |
| API routes at 0%   | **26 of 26** | **0 of 26** |
| `lib/auth`         | 0%           | **91%**     |
| overall statements | 50.65%       | 52.9%       |

Individual routes now sit between 10% and 96%. The uncovered remainder is mostly
authenticated happy paths needing substantial database fixtures; the security-relevant
branches are the ones covered. Chasing the rest needs a seeded test database and is worth
its own change rather than inflating this one — so **G-1 is closed for the API surface but
remains open for pages and components, still at 0%.**

#### D-7 (Medium, security) — unauthenticated `GET /api/webhooks/strava/subscribe`, fixed

Found by the auth sweep on its first run. The `GET` handler had **no auth check at all**,
while the `POST` beside it in the same file has always required a session. Any caller
could read the app's push subscriptions — callback URL and subscription ids — and make
StrideIQ spend Strava API quota on request (an unauthenticated outbound-call trigger as
well as an information disclosure).

Fixed to match its sibling. No product decision was involved: the POST already established
the intended policy for the same resource. **The new test was verified to fail against the
old handler** by stashing the fix and re-running, rather than assumed to.

#### Two ordering findings left unfixed (both Low, disclosure of config not data)

- **`/api/chat` returns 503 for missing LLM configuration before checking auth**, so an
  anonymous caller learns whether a key is configured. The tests set a dummy key so the
  auth assertion is actually reached rather than short-circuiting on config.
- **`/api/me/status` answers 200 with `{connected:false}` to anyone.** This is
  **deliberate and correct** — the client calls it to decide whether to show "Connect
  Strava", so 401 would be the wrong contract. My first draft asserted 401 and was wrong.
  It is now tested for the real contract plus an explicit assertion that none of the five
  authenticated fields appear.

### F-6 — Merge-layer precedence (1 file)

Filed as an untested **risk**. Testing it found an active defect: **syncing Strava after
importing an export silently deleted five fields** from every activity the two sources
shared.

`mergeStravaImports` replaced whole run records on an id collision
(`runsById.set(run.id, run)`). But the sources are not interchangeable —
`lib/strava/api/mapActivity.ts` hard-codes `trainingLoad`, `gradeAdjustedPaceSecPerKm`,
`totalSteps` and `weatherTempC` to `null` and **never sets `fitFilename`**, because the
Strava API does not expose them; the CSV export populates all five. Overlaying therefore
did not _update_ those fields, it **erased** them.

**`trainingLoad` is the costly one.** `weeklyLoadSeries` switches to a distance-derived
proxy once more than half the runs lack it, so losing it moves the whole acute-chronic
model and everything downstream — readiness, freshness, forecast freshness, plan
guardrails. Measured over 30 runs carrying real load:

|                 | With load | After the wipe |
| --------------- | --------- | -------------- |
| CTL             | 295       | **335**        |
| ATL             | 145       | **165**        |
| TSB             | 150       | **170**        |
| `usesProxyLoad` | false     | **true**       |

The snapshot's own evidence line flips to _"Load estimated from distance (training load
missing on many runs)."_ Separately, `fitFilename` is how `activities/<id>.fit.gz` is
matched to an activity, so losing it breaks FIT enrichment for those runs.

**The trigger is the documented flow.** Both call sites pass the newer import as the
overlay, so precedence was _"whichever import ran most recently wins wholesale"_. Import an
export then connect Strava — README **Path A → Path B** — and the export fields go. Sync
first and import second and they survive. Same account, same activities, different data
depending on the order.

Records present in both sources are now merged **field by field**: the overlay wins on
every field it carries, the base is kept where the overlay has nothing to say. That is how
`profile` has always been merged a few lines below **in the same function**, which is a fair
sign the record-level replacement was an oversight rather than a decision.

Trade-off, stated in the code: a source can no longer express "this value has been
cleared", so an older value survives. That is the right way round — the alternative deletes
data only one source carries.

**Not changed:** `mapActivity`'s nulls are honest (training load and grade-adjusted pace are
not in the public activity payload; `fitFilename` is not an API concept). The defect was
only ever in the merge. And the "three-way" merge is really **two-way plus an id list** —
`enrichImportWithFitDetails` unions FIT _ids_ only, with stream detail living in IndexedDB
and joined downstream, so the FIT leg was never at risk. A test pins that.

**No automatic repair.** An athlete who has already synced has already-wiped values in
`localStorage`; re-importing the export restores them and they now stick, but until then
that account's fatigue numbers run on the proxy.

**Still open and structurally identical: D-4** (§DD-4). The leg-feel store's
`mergeFromServer` also loses information on merge — it ignores `reportedAt` and discards a
newer server report. Same class of bug, different module.

### G-2 / G-3 — MCP tool parity and package tests (3 new files, 3 changed)

Two findings with one root cause. **G-2:** 28 of 44 registered tools were unreachable via
`/api/me/intelligence`. **G-3:** the 664-LOC MCP package had zero tests. `FEATURES.md` §12
meanwhile advertised _"tool parity: same deterministic outputs as web Coach"_.

The package exposed 15 tools and **could not have exposed more** — the route gated every
call through a hand-written `section` map of 16 entries, so 28 tools were unreachable over
HTTP by _any_ client, including **every ecosystem tool**, the whole adaptive stack, forecast
accuracy, recommendation outcomes and today's-session. Two hand-maintained lists, one
lagging the other, with nothing to catch it.

|                     | Before | After  |
| ------------------- | ------ | ------ |
| Reachable over HTTP | 16     | **44** |
| Exposed by MCP      | 15     | **44** |
| MCP package tests   | **0**  | **29** |

**Route:** any registry name now resolves via `?tool=` (or `?section=`), arguments passed as
JSON so no per-tool query-parameter plumbing has to be written and forgotten again. The 16
aliases stay, for existing MCP builds and bookmarked URLs. `?section=tools` lists the
registry so a client can enumerate rather than guess.

**Package:** registers from a declarative table rather than 15 hand-written blocks. The table
is **pure data** — no SDK, no zod — specifically so the main repo can import it and assert
parity. That is the only mechanism available: the package is standalone, with its own
dependencies and `tsconfig`, and cannot import the registry. **9 parity tests** require the
names to match exactly in both directions and the argument names, types and enums to agree
with each tool's `input_schema`. Verified by drifting one name and watching it fail with
`MCP table is missing: get_athlete_memory`.

**20 client tests** cover URL and argument assembly, credentials for both the API key and the
session cookie (bare token and full cookie string), base-URL override, server error messages
preferred over bare status codes, and the Strava proxy's GET/POST conventions. **58 route
tests** assert all 44 resolve, the aliases still work, legacy per-section parameters still
parse, malformed `args` is rejected before execution, and discovery returns the registry.

#### A defect in my own fix, caught by one assertion

`?tool=` alone did not work in the first cut: `section` defaults to `"brief"`, so it took the
brief branch and never reached tool resolution. **All 44 reachability tests passed anyway** —
a resolved tool and the brief branch fail identically without a database. The _unknown-tool_
case exposed it, returning 500 instead of 400 and proving resolution was never reached.
`?tool=` is now read before the section default, and that unknown-tool assertion is what
keeps the reachability suite honest rather than self-satisfying.

This is the **fourth** instance of §F-1's pattern in this remediation — a passing test whose
assertion is implied by the bug. The first three were in `predictions.ts` (D-1, D-5, D-6).
The fourth was mine.

Also fixed in passing: the package captured `STRIDEIQ_BASE_URL` at module load, so it was
only honoured if the environment was set before first import — fine under a launcher that
sets it up front, silently ignored anywhere else. Read per call now.

**Still not verified:** none of this has run against a live Claude Desktop client, which the
audit put out of scope and this environment cannot provide. What is verified is that every
tool is addressable over HTTP and that the two lists can no longer drift apart unnoticed.

### D-4 — Leg-feel reconciliation (2 files)

Two problems, both losing the athlete's own data.

**The merge ignored recency.** `mergeFromServer` adopted a server report only when no local
one existed for that day. `LegFeelReport` carries `reportedAt` **precisely so reports can be
ordered**, and the merge ignored it, so a newer server report lost to an older local one.
Report a morning "fresh" on a laptop and a post-run "heavy" on a phone, and the laptop keeps
showing "fresh" indefinitely: whichever device wrote first wins permanently, and the two
never converge.

**Failed saves vanished.** The POST was fire-and-forget with `.catch(() => {})`. A failure
meant the value survived on that one device and the server never learned it — so no other
device, no Coach context and no server-side fatigue calculation ever saw it.

Merging is now recency-based: ties keep the incumbent, and an unparseable timestamp cannot
win, so a malformed `reportedAt` degrades to the old presence rule rather than letting `NaN`
decide. Writes are tracked in `pendingDates` and flushed on mount — deliberately **after**
reconciliation, so a report the server already has newer data for is not pushed back over
it. A merge that adopts the server's copy clears the flag, since nothing is then left to push.

**The same failure as F-6, needing a different resolution.** Both are one side's data winning
on something other than which data is better. In the import layer the two sources carried
_complementary fields_, so the fix was field-wise coalescing (#113); here both sides carry
_the same fields at different vintages_, so the fix is recency. Filing them as two unrelated
Mediums understated the pattern — it is worth watching for wherever this codebase merges two
copies of anything.

**An upgrade hazard I checked rather than assumed.** `pendingDates` is a new key in persisted
state, and existing installs rehydrate `strideiq-feel-store-v1` without it. Zustand's default
merge (`{...current, ...persisted}`) keeps the initializer's empty array, so the real path is
safe — but a missing key does make `setFeel` throw on `.includes`, confirmed by test. Every
read coalesces, with two tests covering the rehydrated-without-the-key case. No version bump
or migration: existing `byDate` data is untouched.

**23 tests on a store that had none**, while `lib/wellness/` sat at 97.6% — the tested part
was the calibration maths, not the merge that decides which report the athlete actually sees.
These are §DD-4's four acceptance tests verbatim (newer server wins, newer local wins, a
failed save is retryable, `post_run` supersedes `morning`), plus tie and
unorderable-timestamp handling, per-day isolation, the pending-queue transitions, and a
convergence check asserting both arrival orders reach the same state. Verified to fail
against the old store.

### G-4 — Documentation drift (3 files)

The last of the drift findings, and the one this report's §C.4 wrote the remedy for. All
twelve items in that list are applied.

`FEATURES.md` had fallen ~40 commits behind. Structurally it was sound — 71 of its 72 cited
paths resolved — but it omitted roughly **12,000 lines of shipped subsystems**, and several
claims were **wrong** rather than merely absent.

**Five subsystems had no entry at all:** AI planning & the training calendar, the adaptive &
learning stack, wellness & leg-feel, return-to-running, and the demo athlete — the zero-setup
entry point named in `package.json`'s own description. The planning section now documents the
soften → validate → repair → integrity → fallback ladder explicitly, since it is the most
defensible thing in the codebase and a reader had no way to know it existed.

| Claim                    | Was                            | Now                                          |
| ------------------------ | ------------------------------ | -------------------------------------------- |
| Tool registry            | "24 tools"                     | **44**, listed by group                      |
| Tool reachability        | "used by Coach **and MCP**"    | true for all 44 — was false for 28           |
| MCP parity               | asserted                       | real, and enforced by a test                 |
| API table                | 16 of 26 routes, no auth modes | all 26, `session` vs `session + key` named   |
| `forecastV2ViewModel.ts` | `lib/forecasting-v2/`          | `lib/goals/`                                 |
| Tools "defined in"       | `types.ts`                     | `tools.ts` (only the union is in `types.ts`) |

Behaviour that had never been written down is now documented: storage and migrations
`001`–`008`, the merge precedence rules and why the two sources are not interchangeable,
webhook signature verification and its signing secret, forecast accuracy tracking end to end,
effort quality in the prediction engine, the leg-feel recency policy, and the opt-in
`TEST_DATABASE_URL` gate. Renumbered to 21 sections; all 22 TOC anchors and all 136 cited
paths verified mechanically. Test counts corrected in `README.md` and `docs/RELEASE_MVP.md`,
which both still said 218 against an actual 1,022.

#### D-8 (Medium) — two time-dependent test suites, fixed

**`main` went red overnight with no code change.** Two suites read the real clock and passed
on 5 August, failed on 6 August:

| Suite               | Failure                             | Cause                                                                                                                                                                        |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generateDemoData`  | `expected 60 to be greater than 60` | Fixture built from a pinned `NOW`, but `computeInsights` reads `new Date()` — the readiness score drifted onto the assertion boundary as real time passed the demo race date |
| `readinessCurrency` | `expected 65 to be less than 62`    | Fixtures relative to today, and the model buckets load into ISO weeks, so the weekday the suite runs on moves the bucket boundaries and therefore CTL/ATL                    |

Both now pin the system clock; the assertions are unchanged, because they were correct and
were simply being fed shifting inputs. **This was not caused by the docs commit that exposed
it** — verified by running both suites at `bfdd739`, the commit before. The docs change was
documentation-only; it was merely the first push after midnight.

Worth keeping: these had been latent all along and would have failed intermittently forever,
landing on whatever unrelated PR happened to run on the wrong calendar day.

#### A blind spot in my own verification

`FEATURES.md` cited `components/route-replay/`; the directory is `components/route/`. That
path was wrong in the **original** catalog and I carried it into the rewrite.

My path check reported "all 136 cited paths exist" — because it filtered out entries ending
in `/`, and the single broken reference in the file was the one shape the filter skipped. Re-run
without it, the file is genuinely clean. This is §F-1's pattern (an assertion that cannot fail
the way the bug fails) applied to the audit's own tooling rather than to the code.

### DD-1 — The learning loop (1 file + 12 tests)

The audit's last substantive unproven claim, and the one this report repeatedly said it
would assume broken until a test said otherwise. **That prediction was wrong, and the truth
was worse.**

The loop was not failing to close. It was closing **instantly**.
`buildAdaptiveIntelligence` calls `trackRecommendationOutcome` and then
`evaluatePendingOutcomes` in the same function, so every recommendation was judged in the
instant it was issued, against the very analytics that produced it. **Measured elapsed time
between issue and verdict: 0 ms.**

A verdict of `"supported"` therefore meant _"this advice matches the current state"_ — the
state that generated the advice — not _"this advice worked"_. And `updateBeliefsFromOutcome`
mints a belief captioned **"Historical evidence suggests: …"** on exactly that basis. The
subsystem was not failing to learn; it was fabricating history and showing it to the athlete.

An outcome now stays pending until at least 24 hours have elapsed since issue. Freshness,
readiness and efficiency all move on daily-or-slower timescales, so nothing before that could
be evidence of anything. `applyOutcomesToMemory` already skips an outcome with no
`evaluatedAt`, so an unjudged recommendation cannot reach a belief.

**Verified in both directions**, because a guard that merely suppressed everything would look
identical in the failing case and would have quietly disabled the feature:

| Scenario                         | Before                           | After                                  |
| -------------------------------- | -------------------------------- | -------------------------------------- |
| Issued this instant              | `supported`, beliefs **13 → 14** | `inconclusive`, profile byte-identical |
| Issued 25 h ago                  | —                                | `supported`, beliefs **13 → 14**       |
| Same outcome at +2 h, then +32 h | —                                | `inconclusive` → `supported`           |

That is §DD-1's acceptance test — a recommendation driving a measurable belief change —
finally satisfied, and satisfied only when the elapsed time is real.

One existing test needed a genuine `issuedAt`. It asserts that freshness recovering 38 → 62
strengthens the evaluation, which is about the **evaluator** rather than timing; it simply
never set an issue time, so it defaulted to now. Same shape as D-8: right assertion,
unrealistic input.

#### The loop is now correct, and inert — _superseded by #21 below_

The outcome store is an **in-memory `Map`**, so a pending outcome does not survive to the next
request. Combined with the observation window, **the loop will rarely close in a serverless
deployment**. Inert beats confidently wrong, but the honest statement is that _learning_ is
now a capability the code **supports** rather than one it **performs**.

This is documented at the store and pinned by a test named
`known limitation: the store does not persist`, so the constraint is visible rather than
assumed, and there is a test to flip when it changes.
`db/migrations/005_recommendation_log.sql` and `lib/db/recommendation-log.ts` already provide
durable storage — moving this store onto them is what would let the loop genuinely learn, and
is **the single highest-value open item** (remediation #21).

**That item is now closed — see the next section.** Two things above are worth reading as
written rather than quietly corrected. The store did **not** move onto
`recommendation_log`: that table's `record` column is typed as `LoggedRecommendation` by
`getRecommendations`, so a second record shape would have broken adherence evaluation. It
moved onto a new table instead. And the promised _"test to flip"_ was not flipped by #119
itself — that took a follow-up commit, `451947c`; see §Verification.

Two smaller things found while tracing and left alone, neither reachable in a harmful way:
`buildAdaptiveSnapshotFromBundle` falls back to keying the store by
`analytics.summary.runCount.toString()`, so on the client path an athlete's key changes every
time they log a run — but that path passes `trackPrimaryRecommendation: false`, so nothing is
tracked under it. The three server paths correctly pass `ctx.userId`.

### #21 — Outcome-store persistence (2 new modules + 1 migration, 3 call sites, 14 tests)

The item DD-1's own fix created, and the only finding in this report opened by remediation
rather than by the audit. #118 and #119 are really one fix in two halves: the observation
window made the loop **correct**, and in the same stroke made it **inert**. An outcome must
now wait a day to be judged — but the store was a per-process `Map`, so the pending record
never survived to the request that could judge it. The window closed the fabrication; it did
not make the loop learn.

Outcomes now persist in `recommendation_outcome_log` (migration
`db/migrations/009_recommendation_outcome_log.sql`, `lib/db/recommendation-outcome-log.ts`).
The three server call sites hydrate the working set before building the adaptive snapshot and
write it back after, so **a recommendation issued on Monday is judged on Tuesday**.

| Decision                                                 | Why                                                                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A **new table**, not `recommendation_log`                | `getRecommendations` types that `record` column as `LoggedRecommendation`; a second shape would hand adherence evaluation rows it cannot read                     |
| The `Map` **stays** as the working set                   | `buildAdaptiveIntelligence` is synchronous _and_ browser-reachable; an async store would have rippled through four call sites and broken the client path outright |
| Both bridge functions **swallow** errors                 | A learning-loop failure must not take down the plan, the Coach reply, or the page being built. Worst case the loop does not close this cycle — where it started   |
| Hydration merges stored records **under** in-flight ones | So a fresher in-memory outcome is never clobbered by an older stored copy                                                                                         |

Persistence is therefore two `await`s at boundaries that were already `async`
(`app/api/me/coach/memory/route.ts`, `app/api/me/learning/observability/route.ts`,
`lib/ai-planning/planTool.ts`), via `lib/recommendation-learning/persistence.ts`. The client
path passes `trackPrimaryRecommendation: false` and behaves exactly as before.

#### A layering mistake the build caught, and I did not

Exporting `./persistence` from `lib/recommendation-learning/index.ts` **pulled the Postgres
driver into the client bundle** — that barrel is reachable via
`buildAdaptiveIntelligence → adaptiveState → use-athlete-intelligence` — and `next build`
failed with `Can't resolve 'fs'`.

Keeping the client path working was the _explicit reason_ for the synchronous design, and I
broke it one step later with a convenience export. It was caught by the build rather than by
me, and only because the driver happens to need a Node built-in; a pure-JS dependency would
have shipped silently. Three tests in
`lib/recommendation-learning/__tests__/clientSafety.test.ts` now assert the barrel and the
four modules reachable from it stay free of `lib/db`. **Verified to fail when the bad export
is restored**, not assumed.

This is the second time in this remediation that a fix's _own_ safety property was the thing
it broke (D-1 briefly made §DD-5's unearned `confidence = "high"` reachable). Both were caught
by an independent check rather than by the reasoning that introduced them.

#### Deployment

**Migration 009 has been applied to the Neon production database** — reported by the repo
owner as having applied cleanly, via `npm run db:migrate`, after the merge of #119.

**Recorded precisely, because I did not observe it.** The permission classifier blocked both
`npm run db:migrate` and a read-only pre-flight against production, so this line rests on the
owner's report rather than on output I saw. Two things follow. The pre-flight would have
listed what else was pending — the runner applies _every_ unapplied migration, not only 009 —
so **whether 001–008 were already applied on production is unverified here**; I flagged the
skip lines to watch for before the run, and no anomaly was reported back. And the post-state
(table present, index present, `_migrations` carrying a 009 row) is likewise unconfirmed by
direct inspection.

Had it been missed, the failure mode would have been degradation rather than breakage:
`ensureRecommendationOutcomeLogSchema` creates the table on first use, matching how 005 and
007 already behave. But the **index** lives only in the migration, so the fallback path leaves
hydration reading unindexed and `_migrations` without a 009 row. Everything is
`IF NOT EXISTS`, so the migration repairs both whenever it runs.

Export-only mode has no database, so the loop stays inert there **by design** — the same as
every other server-backed feature.

### Verification

5 regression tests added for D-1/D-2 — 2 in `lib/analytics/__tests__/predictions.test.ts`
(perfect-fit R² ≈ 1; R² bounded in [0,1]), 3 in
`lib/forecasting-v2/__tests__/calibration.test.ts` (easy run ignored; real race
scored despite an earlier easy run; bad race still counted).

**58 further tests added for D-3**, treating the vocabulary as the safety denylist
it is — a 31-phrase must-flag corpus (every clinical verb, all 14 conditions,
diagnosis/prescription, medical certainty) and a 16-phrase must-not-flag corpus
(ordinary coaching language, the benign idiom, the system's own disclaimers), plus
field-coverage tests for `stripMedicalLanguage` (which previously had **no tests at
all**) and rationale/alternatives detection tests.

**29 tests added for R-1**, on a path that had **0% coverage**. 18 unit tests cover
the real header shape, whitespace and reordered parts, wrong secret, tampered body,
replay beyond tolerance, future timestamps, and seven malformed headers — including an
explicit hex-shape check, because `Buffer.from(x, "hex")` truncates silently and would
otherwise let a malformed signature compare as a short buffer. The other **11 are
route-level**, because the defect was a _wiring_ mismatch no unit test of the verifier
could catch: both sides agreed with each other and disagreed with Strava. One signs a
payload and asserts it is rejected under `x-hub-signature-256` and accepted under
`x-strava-signature`; two assert an unsigned `delete` never reaches
`deleteActivityForUser`. These are also the **first route-level tests in the repo**,
against §F-1's finding that all 26 routes sat at 0%.

**14 tests added for #21.** Six cover the request boundary itself
(`lib/recommendation-learning/__tests__/outcomePersistence.test.ts`): a recommendation
tracked, the store cleared the way a cold start clears it, then hydrated and judged — with
the belief count moving **13 → 14**, which is §DD-1's acceptance test satisfied _across a
process restart_ rather than within one call. The contrast case (no hydration, outcome
silently gone) is kept alongside it as the pre-fix behaviour, so the test file shows both
sides of the fix. Four more pin the merge order, idempotency, and that an already-judged
outcome stays judged. **Five** are opt-in DB round-trips
(`lib/db/__tests__/recommendation-outcome-log.test.ts`) under the F-8 local-only guard,
including a pending outcome upserting into a judged one **without duplicating the row** —
the write path the loop depends on. **Three** are the client-bundle guards above.

Every added test fails against the pre-fix code (for F-8, "fails" means the destructive
suites would have run).

| Check                             | Result                                                  |
| --------------------------------- | ------------------------------------------------------- |
| `npx tsc --noEmit`                | ✅ 0 errors                                             |
| `npx prettier --check .`          | ✅ clean                                                |
| `npx eslint`                      | ✅ 0 errors (23 pre-existing warnings)                  |
| `npx vitest run`                  | ✅ **1032 passed / 16 skipped (1048)** — no regressions |
| Full suite w/ `TEST_DATABASE_URL` | ✅ **1048 / 1048**                                      |
| `npm run build`                   | ✅ compiled (only after the layering fix above)         |
| Migration 009 vs local Postgres   | ✅ applied cleanly alongside 001–008, table round-trips |

Test count across the code changes: **649 → 1048** (+399; the suite is now 1.62× its original
size). #116 was documentation-only and #117 changed no production code — it made two existing
suites deterministic. The MCP package also typechecks independently (`tsc --noEmit` inside
`packages/strideiq-mcp`).

**A promise in this report went briefly unkept, and is now kept.** §DD-1 above said the
persistence limitation was pinned by a test that would be _"a test to flip when it changes"_.
It changed, and #119 shipped without flipping it:
`lib/recommendation-learning/__tests__/learningLoop.test.ts` still read
`known limitation: the store does not persist`, and its comment still pointed at
`lib/db/recommendation-log.ts` — the wrong table, and the one #119 deliberately avoided.

Fixed in `451947c` (committed directly to `main`; test-only, no assertions touched). The
describe now reads **`the in-memory store is per-process by design`**, and the test name says
what the assertion actually shows: a cold start empties the working set, which is why callers
hydrate. The test was worth keeping rather than deleting — it pins the reason the persistence
layer exists — but its name asserted something false about the system while its `expect`s
asserted something true about the store. **Stale framing is a test defect**: a reader trusting
the name would have concluded the loop still could not close.

**The V2 10-fixture production gate still passes** after the effort-set change — 0
errors and the same **2 warnings, confirmed pre-existing by stashing the change and
re-running against `main`** rather than assumed. Fixtures construct efforts directly, so
they never exercised the modified path.

Files changed — D-1/D-2: `lib/analytics/predictions.ts`,
`lib/forecasting-v2/calibration.ts`. D-3: new `lib/safety/medicalLanguage.ts`,
`lib/ai-planning/repairWeeklyPlan.ts`,
`lib/recommendation-integrity/safetyChecks.ts`,
`lib/recommendation-integrity/evaluateRecommendation.ts`. R-1:
`lib/strava/webhooks/verify.ts`, `app/api/webhooks/strava/route.ts`, plus
`.env.example`, `docs/DEPLOYMENT.md`, `README.md`. F-8: new
`lib/db/__tests__/testDatabase.ts`, the four `lib/db/__tests__/*.test.ts` guards, plus
`CONTRIBUTING.md`. #5: `lib/analytics/predictions.ts`, `lib/analytics/index.ts`,
`lib/forecasting-v2/capabilityModels.ts`, `lib/forecasting-v2/buildInput.ts`. D-6:
`lib/analytics/predictions.ts`. Ten test files in total. F-8 touched only test scaffolding, so it carries no runtime risk; the
others are all runtime changes.

### Merge status

All thirteen changes are merged to `main`, post-merge CI green (CI + CodeQL on each). Two
exceptions, both recorded honestly: #116's post-merge run was **red**, from the pre-existing
time-dependent tests described above rather than from the change itself, and #117 restored it;
and **#119 was merged with no CI run at all** — GitHub Actions queued nothing on that branch
in ~25 minutes of waiting, and nothing repo-wide since #118. That reads as an Actions-side
delay rather than anything about the branch, but the honest statement is that **#119 rests on
local verification only**: `npm run check` clean, `npm run build` compiling, and 1048/1048
with the database suites enabled, re-run on `main` after the merge.

| PR                                                                                    | Merge                                                            | On `main`                                     |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| [#107](https://github.com/Padraigobrien08/StravaFitnessTool/pull/107) — D-1, D-2, D-3 | merge commit, to keep the three commits independently revertable | `d31d5e3` (+ `aac6c79`, `6d448fd`, `f93e813`) |
| [#108](https://github.com/Padraigobrien08/StravaFitnessTool/pull/108) — R-1           | squash                                                           | `66f0531`                                     |
| [#109](https://github.com/Padraigobrien08/StravaFitnessTool/pull/109) — F-8           | squash                                                           | `aa19bed`                                     |
| [#110](https://github.com/Padraigobrien08/StravaFitnessTool/pull/110) — #5, D-5       | squash                                                           | `d168682`                                     |
| [#111](https://github.com/Padraigobrien08/StravaFitnessTool/pull/111) — D-6           | squash                                                           | `320237d`                                     |
| [#112](https://github.com/Padraigobrien08/StravaFitnessTool/pull/112) — G-1/#7, D-7   | squash                                                           | `6d82595`                                     |
| [#113](https://github.com/Padraigobrien08/StravaFitnessTool/pull/113) — F-6           | squash                                                           | `3a4f612`                                     |
| [#114](https://github.com/Padraigobrien08/StravaFitnessTool/pull/114) — G-2, G-3      | squash                                                           | `0d3161a`                                     |
| [#115](https://github.com/Padraigobrien08/StravaFitnessTool/pull/115) — D-4           | squash                                                           | `bfdd739`                                     |
| [#116](https://github.com/Padraigobrien08/StravaFitnessTool/pull/116) — G-4           | squash                                                           | `020c9ff`                                     |
| [#117](https://github.com/Padraigobrien08/StravaFitnessTool/pull/117) — D-8           | squash                                                           | `7f8a7cc`                                     |
| [#118](https://github.com/Padraigobrien08/StravaFitnessTool/pull/118) — DD-1          | squash                                                           | `6e0ffd4`                                     |
| [#119](https://github.com/Padraigobrien08/StravaFitnessTool/pull/119) — #21           | squash (**no CI run**)                                           | `8aa6344`                                     |

Each merged state was verified locally, including the combinations no individual PR was
tested in: `npm run check` clean, build compiles, and 1048/1048 with the database suites
deliberately enabled.

### Note on remaining related risk

**Resolved: D-1's fix briefly made §DD-5's open question load-bearing, and #5 closed
it.** Fixing R² made the `confidence = "high"` gate reachable while the exponent was
still 0.991 — reachable but unearned. The effort-set fix moved the exponent to 1.063
over 64 genuine efforts, so the label is now justified. One fix created the risk and the
next retired it; neither would have been safe alone.

**The race-prediction chain is now internally consistent.** D-1, #5 and D-6 were three
defects compounding into one wrong number; with all three fixed, the four V1 models and
Forecasting V2 agree inside a 9-minute band and the consensus sits 35 s from the legacy
Riegel projection. No known numerical disagreement remains in this area.

D-3 hardens the text layer only. Detection is a denylist, so novel phrasings will
still get through — the durable protection is the fallback ladder, not the regex list.

R-1 is implemented against Strava's own reference code but **not yet proven against a
live delivery** (see above).

F-8 hardens the _test harness_, not the application — it touched no runtime code. It
removes a way to destroy data by accident; it does not make the database layer itself
safer, and `lib/db` remains at 3% coverage (§F-1).

**The learning loop is now closed end-to-end, and deployed.** §DD-1's verification gap — the
audit's longest-standing unproven claim — is resolved in two steps: #118 stopped the instant
grading, #21 gave the pending outcome somewhere to live. The acceptance test now passes across
a process restart, and migration 009 is applied to production (reported by the owner; see the
addendum for what that does and does not establish).

**The remaining gap is observational, and it is the interesting one.** No run of this loop
against real athlete data over a real 24-hour window has been observed — only against pinned
clocks and a local database. Every piece is proven in isolation and proven at the seam; what
is unproven is the whole thing running on wall-clock time in production. The first genuine
evidence will be a `recommendation_outcome_log` row whose `evaluated_at` is a day later than
its `issued_at`, with a belief in the athlete's memory profile that traces to it. **That is
the check worth running a few days from now**, and it is the one thing this audit could never
perform from inside a test suite.

**Effort-set semantics** (§DD-5) remains open by design, still requiring the product decision
in §H.

---

## A. Executive summary

### Readiness verdict

**Not production-ready as a whole; the analytical core is genuinely strong.**

StrideIQ is a substantially more complete and better-tested system than its own
documentation claims. The deterministic engine layer — analytics, Forecasting V2,
the insight engine, and the AI-planning safety scaffolding — is real, exercised,
and in several places impressively rigorous about its own uncertainty. Three
confirmed correctness defects and one systematic test-coverage hole (the entire
HTTP and UI surface is at 0%) keep it short of shippable.

The single most important finding is that **the deterministic guardrail layer
around the LLM works**: under five injected failure modes the weekly-plan path
never once shipped an unsafe plan. That is the hardest thing in this codebase to
get right, and it is right. The defects that remain are localized and fixable,
not architectural.

### Weighted overall score: **3.30 / 5** (66.0%)

| ID  | Subsystem                            |       W | Score |     W×S |
| --- | ------------------------------------ | ------: | ----: | ------: |
| S1  | Analytics engines                    |      16 |     3 |      48 |
| S2  | Forecasting V2 + goals/race brief    |      14 |     4 |      56 |
| S3  | Coach + reasoning + coaching-context |       9 |     3 |      27 |
| S4  | Adaptive/learning stack              |       9 |     3 |      27 |
| S5  | AI planning + training calendar      |       9 |     4 |      36 |
| S6  | Ingestion & merge                    |       7 |     3 |      21 |
| S7  | Intelligence tool registry           |       7 |     3 |      21 |
| S8  | Ecosystem (multi-sport)              |       5 |     4 |      20 |
| S9  | App routes / UX                      |       5 |     3 |      15 |
| S10 | Storage & migrations                 |       4 |     3 |      12 |
| S11 | Insight engine                       |       4 |     4 |      16 |
| S12 | API surface + auth                   |       3 |     2 |       6 |
| S13 | Return-to-running                    |       2 |     4 |       8 |
| S14 | Wellness / leg-feel                  |       2 |     3 |       6 |
| S15 | Session intelligence                 |       1 |     3 |       3 |
| S16 | Route intelligence / replay          |       1 |     2 |       2 |
| S17 | MCP package                          |       1 |     2 |       2 |
| S18 | Engineering / ops                    |       1 |     4 |       4 |
|     | **Total**                            | **100** |       | **330** |

**Calculation:** Σ(W×S) = 330. Maximum = 100 × 5 = 500. **330 / 500 = 0.660 → 3.30 / 5.**

### Status counts

| Status                      | Count |
| --------------------------- | ----: |
| Complete                    |     1 |
| Partially complete          |    13 |
| Implemented but unverified  |     4 |
| Defective (subsystem level) |     0 |
| Not implemented             |     0 |
| Not assessable              |     0 |

No subsystem is wholly defective; three **components** are confirmed defective
inside otherwise-working subsystems (D-1, D-2, D-3 below).

### Top working capabilities (all runtime-verified)

1. **Forecasting V2 fixture gate** — `evaluateAllForecastFixtures()` returns
   `productionReady: true` across all 10 synthetic athletes, 0 errors, 0 warnings.
2. **AI-planning guardrail/repair/fallback ladder** — verified under 5 injected
   faults; a schema-valid but dangerous plan (7 hard sessions, 240 km) was
   repaired to 1 hard session / 23.8 km, inside guardrails.
3. **Demo athlete end-to-end** — 230 runs / 294 activities / 12-month span →
   analytics → **16 insights, every one carrying evidence**.
4. **Epistemic honesty in the analytical layer** — critical-speed fit self-reports
   `confidence: "low"` at R²=0.33; causal reasoning returns "Insufficient context
   for causal attribution" for `execution` and `pacing` rather than fabricating.
5. **Auth design** — HMAC-SHA256 sessions with `timingSafeEqual`; the
   `STRIDEIQ_API_KEY` path **cannot escalate across users** (see F-2).
6. **Test suite** — **649 tests, 649 passing** (with Postgres available).

### Top defects and gaps

| ID  | Finding                                                                                                                                                  | Severity               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D-1 | `fitPowerLawRegression` R² is mathematically wrong (returns −79 where 1.0 is correct); printed verbatim to users; gates an unreachable confidence branch | **High**               |
| D-2 | `scoreForecast` matches the _earliest_ run in a ±7% distance band with no race-like filter — reports a perfect forecast as 40 min off                    | **High**               |
| D-3 | Medical-language defense misses `treat`/`cure`/`heal`/`rehab` and all named conditions in **both** layers; clinical claims score 100/100                 | **High**               |
| G-1 | Entire HTTP + UI surface at **0% coverage** — 26 API routes, 16 pages, 210 components (API half fixed in #112; UI still 0%)                              | **High**               |
| G-2 | 28 of 44 registry tools unreachable via `/api/me/intelligence`, therefore unreachable from MCP                                                           | **Medium**             |
| G-3 | MCP package (664 LOC) has **zero tests**                                                                                                                 | **Medium**             |
| D-4 | `mergeFromServer` ignores `reportedAt` — a newer server leg-feel report loses to an older local one; no retry queue (fixed in #115)                      | **Medium**             |
| R-1 | Webhook handler requires `x-hub-signature-256`, which Strava is not believed to send — **unverified**, could mean no webhook ever processes              | **High if confirmed**  |
| G-4 | `docs/FEATURES.md` omits ~16 subsystems (~12k LOC) and understates tests by 3× (fixed in #116)                                                           | **Medium** (doc drift) |

> **Post-audit:** D-1, D-2, D-3, R-1, F-8 and effort-set semantics are fixed and merged
> (see addendum), clearing **every High-severity item in the remediation table's
> foundational block**. R-1 was **confirmed High** — but not for the reason stated in its
> row above: Strava does sign webhooks, just not with that header. G-1 (0% route
> coverage) is partially addressed — R-1 added the repo's first 11 route-level tests.
> G-2, G-3, G-4 and D-4 remain open.
>
> Three further defects were found _during_ remediation, none in the original audit, and
> all fixed: **D-5** (multi-anchor comparator never sorted, #110), **D-6** (the Cameron
> model predicting 2:30:23 where three other models agreed at 1:33–1:43, #111), and **D-7**
> (an unauthenticated `GET /api/webhooks/strava/subscribe` exposing the app's push
> subscriptions, #112). None was a regression — D-6 was masked by the effort-set noise that
> fixing item 5 removed, and D-7 surfaced on the first run of the new auth sweep.
>
> **G-1 is closed for the API surface** — all 26 routes off 0%, `lib/auth` 0% → 91% (#112)
> — but **remains open for pages and components, still at 0%**. **F-6** (#113) turned out to
> be an active defect rather than the risk it was filed as. **G-2 and G-3** (#114) closed the
> MCP surface: 44 of 44 tools reachable, up from 16, with parity enforced by a test.
>
> **Every finding in this report is now fixed and merged** — 17 findings across 13 PRs, with
> the suite going 649 → 1048 tests. Fixing DD-1 opened one new item, **#21**: the observation
> window made the loop correct and simultaneously inert, because a per-process `Map` could not
> carry a pending outcome to the request that would judge it. That is now closed too — outcomes
> persist in `recommendation_outcome_log`, and a recommendation issued on Monday is judged on
> Tuesday. **Migration 009 is applied to production**, so the loop is live rather than merely
> merged — though it has not yet been _watched_ closing over a real 24-hour window, which is
> now the only meaningful unknown left in this subsystem. What else remains is smaller
> (Zod on three routes, downsampling volume, pages and components at 0%) or unprovable in this
> environment (live webhook delivery, MCP against a real Claude Desktop client).
>
> **A calibration note on this report.** Four items filed as risks or as decisions turned out,
> on inspection, to be defects: **D-6** (I deferred it as a modelling decision; the code named
> a published model and implemented another), **G-1** (a coverage gap that exposed a live
> unauthenticated endpoint on the sweep's first run), **F-6** (an untested "risk" that was
> deleting training load on the documented import flow), and **G-2** (filed as a reachability
> gap; the section map made 28 tools uncallable by any client while the docs claimed parity).
> The pattern is consistent — where this audit could not execute something, it tended to
> _understate_. The remaining unexecuted items — **F-7** (downsampling and IndexedDB volume),
> **DD-1** (the learning loop), live webhook delivery, and MCP against a real client — should
> be read with that in mind rather than as reassurance.
>
> The same caution applies to the remediation itself, twice. While fixing G-2 I shipped a route
> that did not work, and **all 44 of my new reachability tests passed on it**, because the
> broken path and the working path failed identically without a database; one assertion on the
> unknown-tool case caught it. And when rewriting `FEATURES.md` I reported that all 136 cited
> paths resolved, from a check that **filtered out exactly the shape of the one broken path**
> it should have caught.
>
> That is §F-1's pattern — an assertion that cannot fail the way the bug fails — five times in
> this session. Three were in the code under audit; two were in the audit's own work, one of
> them in its verification tooling. The lesson generalises past this codebase: a check is only
> worth its ability to fail.
>
> **DD-1 is the sharpest case of the understatement, and it inverts the usual reading.** This
> report filed the learning loop as an _unproven_ capability and said repeatedly it should be
> assumed broken. It was not broken — it closed in 0 ms, grading each recommendation against
> the state that produced it and minting beliefs captioned "Historical evidence suggests…".
> The failure mode was not absence but fabrication, which no amount of "is it wired?" checking
> would have surfaced. Four of this session's findings passed that question and failed the
> harder one: **does the wiring mean anything?**

### Main confidence limiters

- **No live-service validation possible** — Strava OAuth, API sync, and webhooks
  were out of scope by instruction and are capped at "Implemented but unverified."
- **No browser/UI verification performed.** I did not run a dev server (a stored
  project constraint forbids leaving one running). UI evidence is limited to
  `next build` and Next's static prerender, which does execute page components.
- **LLM output quality is out of scope by design** — I assessed only the
  deterministic scaffolding (schema, guardrails, repair, fallback, integrity).
- **`lib/intelligence/llm` at 0% coverage** — the tool-calling orchestration loop
  is entirely unexercised by tests.

---

## B. Environment and validation summary

### Versions

| Item          | Value                                                               |
| ------------- | ------------------------------------------------------------------- |
| Node (local)  | **v24.9.0**                                                         |
| `.nvmrc` / CI | **22** ⚠️ skew — audit ran on a Node major the project does not pin |
| npm           | 11.6.0                                                              |
| Next.js       | 16.2.10                                                             |
| React         | 19.2.7                                                              |
| Vitest        | 4.1.10                                                              |
| TypeScript    | ^5                                                                  |

### Commands executed

| Command                                         | Result                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                              | ✅ **PASS** — exit 0, zero errors                                                                       |
| `npx prettier --check .`                        | ✅ **PASS** — "All matched files use Prettier code style!"                                              |
| `npx eslint`                                    | ✅ **PASS** — exit 0, **0 errors, 23 warnings**                                                         |
| `npx vitest run`                                | ✅ **PASS** — 102 files, **638 passed / 11 skipped (649)**, 9.11 s                                      |
| `npm run build`                                 | ✅ **PASS** — 16 pages + 26 API routes compiled; 11 pages statically prerendered                        |
| `npm run test:coverage`                         | ✅ completed — Stmts **50.65%**, Branch **41.45%**, Funcs **44.47%**, Lines **50.9%**                   |
| `docker compose up -d`                          | ✅ Postgres 17 container `strideiq-db` started                                                          |
| `DATABASE_URL=<local> node scripts/migrate.mjs` | ✅ migrations 004–008 applied; 001–003 correctly skipped as already-applied (**idempotency confirmed**) |
| `DATABASE_URL=<local> npx vitest run lib/db`    | ✅ **PASS** — **11/11** previously-skipped tests pass                                                   |

**With Postgres available the suite is 649/649 passing.** The 11 skips in the
default run are the four `lib/db/__tests__` files, gated on
`describe.skipIf(!process.env.DATABASE_URL)`.

### Actual vs claimed test counts

| Source                   |               Claim |  Actual | Verdict         |
| ------------------------ | ------------------: | ------: | --------------- |
| `README.md:105`          | "218+ Vitest tests" | **649** | Understated ~3× |
| `docs/RELEASE_MVP.md:39` |  "218 Vitest tests" | **649** | Understated ~3× |

Doc drift in the _conservative_ direction — the repo is better tested than it
claims. Test **files**: 102 (all under `lib/`). The 242 raw `*.test.ts*` matches
include 140 vendored Zod tests under `packages/strideiq-mcp/node_modules`.

### Safety note on the live database

`.env.local` contains a `DATABASE_URL` pointing at a **live Neon production
instance** (`ep-odd-frost-…-pooler.c-3.us-east-2.aws.neon.tech`), and the
`lib/db` tests issue `DELETE` statements. Vitest does **not** load `.env.local`,
which is why those tests skip by default. I ran them **only** against the local
Docker container, invoking `scripts/migrate.mjs` directly to bypass
`npm run db:migrate`'s `--env-file-if-exists=.env.local` flag. **No command in
this audit touched the Neon database.** This is a latent footgun: any contributor
who exports `DATABASE_URL` from `.env.local` and runs `npm test` will delete rows
from production (see F-8).

> **Resolved post-audit.** The footgun is closed — the suites now gate on
> `TEST_DATABASE_URL` and refuse any non-local host. Consequently **the commands
> recorded in this section no longer reproduce**: `DATABASE_URL=<local> npx vitest run
lib/db` now skips. Use `TEST_DATABASE_URL=postgresql://strideiq:strideiq@localhost:5432/strideiq`.

### Artifacts created

All harnesses were written under `./.eval/scratch/` and **deleted before
completion**, per the integrity rules. Only `./.eval/REPORT.md` remains.

| Harness                        | Purpose                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `h1-demo-pipeline.test.ts`     | Demo athlete → `computeInsights` → `generateInsights` → quality |
| `h2-forecast.test.ts`          | Prediction/record fields; 10-athlete forecast fixture gate      |
| `h3-probe.test.ts`             | Prediction consensus/anchor/effort-set inspection               |
| `h4-regression.test.ts`        | Isolated numeric proof of the R² defect (D-1)                   |
| `h5-plan-fallback.test.ts`     | 6-case fault injection on the planning ladder                   |
| `h6-forecast-accuracy.test.ts` | `scoreForecast` matching semantics (D-2)                        |
| `h7-wellness-adaptive.test.ts` | `feel-store` merge semantics (D-4)                              |
| `h8-adaptive.test.ts`          | Athlete memory, adaptation signals, causal reasoning            |
| `h9-integrity.test.ts`         | Recommendation-integrity medical vocabulary (D-3)               |

One Postgres side effect remains on the local machine (not in the repo): the
`strideiq-db` volume now has migrations 004–008 applied (it already had 001–003).
The container pre-existed in a stopped state, was started for this audit, and has
been **returned to stopped**. Restart with `docker compose up -d` if wanted.

### Corrections to my own intermediate findings

Per the integrity rules, two mid-audit conclusions were wrong and are corrected:

1. I initially recorded `predictionAnalysis: null` and `records: undefined` on the
   demo athlete and suspected missing analytics. **That was my error** — the real
   field names are `racePredictionAnalysis` and `personalRecords`, and both are
   fully populated. No defect.
2. Three `h7`/`h8` harness cases first failed with `TypeError`. **That was my
   error too** — I passed object-wrapped arguments to functions taking positional
   ones (`buildAthleteMemoryProfile(analytics, athleteId)`,
   `inferLikelyCauses(analytics, phenomenon)`). Re-run with correct signatures,
   all passed. No defect.

---

## C. Documentation drift findings (two-way: `docs/FEATURES.md` vs code)

> **Resolved post-audit (#116).** Every item in the §C.4 list below is applied: five missing
> subsystems documented, the tool count and reachability claims corrected, the API table
> expanded to all 26 routes with auth modes, and the test counts fixed in `README.md` and
> `RELEASE_MVP.md`. The drift tables are left as written — they are the record of what was
> wrong, and the §C.4 list doubles as the changelog for what was done about it.

`docs/FEATURES.md` (595 lines) is a well-structured catalog that has fallen
roughly 40 commits behind. Structurally it is accurate — **71 of 72 cited file
paths resolve.** Its problem is omission, not error.

### C.1 Documented and present

All 9 analytics engine groups, the insight engine, all 11 Forecasting V2 model
modules, route replay, `/dev/forecast-lab`, the domain model, and the import
pipeline are documented and present. The retirement of the legacy chart routes
(`/dashboard`, `/trends`, `/effort`, `/records`, `/activity-mix`) is stated in
§5.8 and **confirmed absent** from `app/` — the doc is correct here.

### C.2 Documented but absent or wrong

|   # | Doc claim                                                                        | Reality                                                                                                                                                |
| --: | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   1 | `lib/forecasting-v2/forecastV2ViewModel.ts` (§6.3)                               | Wrong path — file is [`lib/goals/forecastV2ViewModel.ts`](../lib/goals/forecastV2ViewModel.ts)                                                         |
|   2 | Tools "Defined in `lib/intelligence/types.ts`" (§11)                             | Only the name union lives there; definitions + executors are in `lib/intelligence/tools.ts` (1432 LOC)                                                 |
|   3 | §11 lists **24** tools                                                           | Registry has **44** (`INTELLIGENCE_TOOL_DEFINITIONS`, `tools.ts:1036`)                                                                                 |
|   4 | §11: listed tools used by "Coach **and MCP** (`GET /api/me/intelligence`)"       | **False for 28 of 44.** The section map (`app/api/me/intelligence/route.ts:45`) exposes 16. All 9 documented **ecosystem tools are unreachable** there |
|   5 | §12 "Tool parity: same deterministic outputs as web Coach"                       | MCP exposes **15** intelligence tools; 29 registry tools have no MCP path                                                                              |
|   ↳ | **resolved in #114** — the package now exposes all 44, enforced by a parity test |
|   6 | §10 API table lists **16** endpoints                                             | **26** route files exist                                                                                                                               |
|   7 | §16 Testing table                                                                | Omits 20 of 30 test directories, incl. all adaptive-stack, planning, calendar, wellness, returning tests                                               |
|   8 | `README.md:105`, `RELEASE_MVP.md:39`: "218 tests"                                | **649**                                                                                                                                                |

### C.3 Present but undocumented

The bulk of the drift. ~16 subsystems totalling **~12,000 LOC** are absent from
`FEATURES.md` entirely:

| Subsystem                                                   | Path                                       |  LOC |
| ----------------------------------------------------------- | ------------------------------------------ | ---: |
| AI planning (LLM + schema + guardrails + repair + fallback) | `lib/ai-planning/` (20 files)              | 2678 |
| Coaching context                                            | `lib/coaching-context/` (19 files)         | 1873 |
| Training calendar                                           | `lib/training-calendar/` (16 files)        | 1516 |
| Athlete memory (8 inference modules)                        | `lib/athlete-memory/` (18 files)           | 1366 |
| Recommendation integrity                                    | `lib/recommendation-integrity/` (11 files) | 1160 |
| Recommendation outcomes                                     | `lib/recommendation-outcomes/`             |  732 |
| Wellness / leg-feel                                         | `lib/wellness/`, `lib/db/leg-feel.ts`      |  621 |
| Return-to-running                                           | `lib/returning/`                           |  608 |
| Demo athlete                                                | `lib/demo/generateDemoData.ts`             |  571 |
| Recommendation learning                                     | `lib/recommendation-learning/`             |  496 |
| `/plan` route + plan workspace                              | `app/plan/`, `lib/plan/`                   |  451 |
| Adaptation engine                                           | `lib/adaptation-engine/`                   |  377 |
| Session intelligence                                        | `lib/session-intelligence/`                |  338 |
| Adaptive intelligence                                       | `lib/adaptive-intelligence/`               |  320 |
| Causal reasoning                                            | `lib/causal-reasoning/`                    |  267 |
| Learning observability                                      | `lib/learning-observability/`              |   98 |
| Longitudinal analysis                                       | `lib/longitudinal-analysis/`               |   91 |

Also undocumented: **10 API routes** (`/api/me/{coach-composite, coach/memory,
coach/plan, forecast-accuracy, learning/observability, leg-feel,
recommendation-outcomes, training-calendar, weekly-plan, strava}`); **migrations
004–008** (§2 mentions no migration system at all); forecast
calibration/sensitivity/accuracy tracking; and **20 additional tools**.

### C.4 Recommended `FEATURES.md` update list

_All twelve applied in #116; item 7 was superseded by #114 making the parity claim true._

1. Add a **§ Adaptive & learning stack** covering athlete memory, adaptation
   engine, causal reasoning, and recommendation learning/integrity/outcomes.
2. Add a **§ AI planning & training calendar**, documenting the `/plan` route and
   — importantly — the guardrail → repair → integrity → fallback ladder, which is
   the most defensible thing in the codebase and currently invisible to readers.
3. Add a **§ Wellness / leg-feel**, stating the local-first "local wins"
   reconciliation policy explicitly.
4. Add a **§ Return-to-running mode**.
5. Add a **§ Demo athlete**, since it is the zero-setup entry point named in
   `package.json`'s own description.
6. Correct §11: 44 tools, not 24; list them; and **state plainly that only 16 are
   reachable via `/api/me/intelligence`**.
7. ~~Soften §12's "Tool parity" claim to reflect the 15-of-44 reality.~~ → **No longer
   needed: #114 made the claim true.** State that parity is enforced by a test, and fix the
   tool count (24 → 44).
8. Expand §10's API table to all 26 routes, annotating the auth mode of each
   (session-only vs session+API-key) — the split is currently invisible.
9. Add a **§ Storage & migrations** documenting `db/migrations/001`–`008` and
   `npm run db:migrate`.
10. Fix the `forecastV2ViewModel.ts` path and the "defined in types.ts" claim.
11. Update test counts to 649 in `README.md:105` and `docs/RELEASE_MVP.md:39`.
12. Expand §16's testing table to all 30 test directories.

---

## D. Compliance matrix

| ID  | Subsystem                            | Status                     | Score | Conf.  | Key evidence                                                                                                                                    | Validation performed                                                                                                                           | Key gaps                                                                                                                                                                   |
| --- | ------------------------------------ | -------------------------- | ----: | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Analytics engines                    | Partially complete         |     3 | High   | `lib/analytics/` (65 files, 9950 LOC), `lib/training/`, 30 test files, cov **92.78%**                                                           | Ran all analytics tests; demo pipeline end-to-end; isolated numeric probe of the regression                                                    | **D-1 confirmed defect** in `predictions.ts`; effort set feeding race prediction includes easy runs but is labelled "race-quality"; `confidence:"high"` branch unreachable |
| S2  | Forecasting V2 + goals               | Partially complete         |     4 | High   | `lib/forecasting-v2/` (32 files, 4305 LOC), `lib/goals/`, cov **88.62%**                                                                        | `evaluateAllForecastFixtures()` → `productionReady: true`, 10/10, 0 errors/warnings; calibration + sensitivity + projection-honesty tests pass | **D-2 confirmed defect** in `scoreForecast`; no live race outcomes to validate against                                                                                     |
| S3  | Coach + reasoning + coaching-context | Partially complete         |     3 | Medium | `lib/coach/` (54.75%), `lib/coaching-context/` (84.61%), `lib/reasoning/` (74.3%)                                                               | Ran `parseResponse`, `staleClaims`, `threadRetry`, `coachingContext`, `runCoachDetail` tests                                                   | **`lib/intelligence/llm` at 0% coverage** — tool-calling loop unexercised; no live LLM run                                                                                 |
| S4  | Adaptive/learning stack              | Partially complete         |     3 | Medium | `athlete-memory` 79%, `recommendation-integrity` 86.18%, `adaptation-engine` 83.78%, `causal-reasoning` 74%, `adaptive-intelligence` **38.23%** | Built memory profile (15 beliefs / 7 categories); adaptation signals; causal reasoning across all 6 phenomena; integrity checks                | **D-3 confirmed defect** (medical vocabulary); outcome→belief learning loop never verified closing end-to-end                                                              |
| S5  | AI planning + calendar               | Partially complete         |     4 | High   | `lib/ai-planning/` (2678 LOC, 61.03%), `lib/training-calendar/` (67.52%), `lib/plan/` (**26.31%**)                                              | **6-case fault injection**: no key / throw / schema-invalid / non-JSON / dangerous-but-valid / medical text                                    | D-3; `calendarCoachContext.ts` at **0%**; `/api/me/training-calendar` unreachable by API key                                                                               |
| S6  | Ingestion & merge                    | Partially complete         |     3 | Medium | `lib/strava/` (52 files, **33.33%**), `lib/import/` **0%**, `lib/data/` 51.16%                                                                  | Ran real-export tests against the present `export_105352925/` fixture (57 runs); FIT parsing; `mergeImport` (3 tests)                          | Three-way merge (export+API+FIT) thinly tested; `lib/sync/` **0%**; `lib/storage/` **0%** (IndexedDB untested)                                                             |
| S7  | Intelligence tool registry           | Partially complete         |     3 | Medium | `lib/intelligence/tools.ts` (1432 LOC), cov **31.63%**                                                                                          | **44 definitions ↔ 44 executor cases, exact match — no dead tools, no missing executors**; traced registry→LLM→section→MCP                     | **28 of 44 tools unreachable via the section API/MCP**; `tools.test.ts` asserts only names/shapes, never executes a tool                                                   |
| S8  | Ecosystem (multi-sport)              | Partially complete         |     4 | Medium | `lib/ecosystem/` (16 files, 2493 LOC, **80.56%**)                                                                                               | Demo run produced interference, cross-training, strength, and hybrid-load insight cards with evidence                                          | Only 1 test file (`modality.test.ts`) for 16 modules; interference thresholds unvalidated against real outcomes                                                            |
| S9  | App routes / UX                      | Implemented but unverified |     3 | Low    | 16 pages, 210 components (21.7k LOC)                                                                                                            | `npm run build` compiled everything; **11 pages statically prerendered**, which executes their components without throwing                     | **0% test coverage** on all pages and components; no browser/interaction verification                                                                                      |
| S10 | Storage & migrations                 | Partially complete         |     3 | Medium | `db/migrations/001`–`008`, `lib/db/` (**3.02%**)                                                                                                | Applied 004–008 against local Postgres; 001–003 correctly skipped (**idempotent**); 11/11 DB tests pass                                        | `lib/db` coverage 3%; `lib/storage/` (IndexedDB) **0%**; no volume/perf testing                                                                                            |
| S11 | Insight engine                       | Partially complete         |     4 | High   | `lib/insights/` (1088 LOC, **86.17%**)                                                                                                          | Generated **16 insights, 100% with evidence**, correct question tags and severities; `noStaleClaims` + `consistency` tests pass                | Rule thresholds not validated against athlete feedback; display path untested (0% components)                                                                              |
| S12 | API surface + auth                   | Partially complete         |     2 | Medium | 26 routes, `lib/auth/session.ts` (**0% cov**), `lib/intelligence/auth.ts`                                                                       | Static trace of both auth paths; per-route auth + zod inventory; read webhook signature verification                                           | **0% route coverage**; 6 mutating routes without zod; F-2/F-3/F-4/R-1 below                                                                                                |
| S13 | Return-to-running                    | Partially complete         |     4 | Medium | `lib/returning/` (608 LOC, **100% cov**)                                                                                                        | `returnToRunning` tests pass; demo athlete correctly yields `returning: null` (no gap)                                                         | Never exercised with an actual post-gap athlete at runtime                                                                                                                 |
| S14 | Wellness / leg-feel                  | Partially complete         |     3 | High   | `lib/wellness/` (**97.61%**), `stores/feel-store.ts` (**0%**), `app/api/me/leg-feel/`                                                           | Verified merge semantics directly; route validation read; calibration tests pass                                                               | **D-4 confirmed defect**; no retry/dirty queue; API-key path cannot reach leg-feel                                                                                         |
| S15 | Session intelligence                 | Implemented but unverified |     3 | Medium | `lib/session-intelligence/` (8 files, **84.49%**)                                                                                               | Ran `sessionIntelligence.test.ts` (2 tests)                                                                                                    | 2 tests for 8 modules; not exercised on real stream data                                                                                                                   |
| S16 | Route intelligence / replay          | Implemented but unverified |     2 | Low    | `lib/route-intelligence/` (**34.63%**), `lib/strava/downsample.ts` (**40%**)                                                                    | Ran `session.test.ts` (1 file)                                                                                                                 | Needs GPS streams unavailable here; **downsampling performance claim untested**; MapLibre never rendered                                                                   |
| S17 | MCP package                          | Implemented but unverified |     2 | Low    | `packages/strideiq-mcp/src/` (664 LOC, 5 files)                                                                                                 | Static parity trace: 15 intelligence + 9 Strava + composite tools                                                                              | **Zero tests on the package.** The 2 in-repo MCP tests cover `lib/mcp/` server helpers, not the package. Live client out of scope                                          |
| S18 | Engineering / ops                    | Complete                   |     4 | High   | `.github/workflows/ci.yml`, `codeql.yml`, `vitest.config.ts`                                                                                    | Executed the full `npm run check` chain + `build` + `coverage`                                                                                 | Node skew (.nvmrc 22 vs local 24); coverage non-blocking with **no thresholds**; F-8 below                                                                                 |

**Answer to the specific registry question posed:** the ~46-tool registry is
actually **44 tools**, and it is internally consistent — 44 definitions, 44
executor `case` branches, 44 union members, exact three-way match. **There are no
dead tools and no exposed-but-unregistered tools.** All 44 are handed to both LLM
providers (`llm/anthropic.ts:32`, `llm/openai.ts:7`), so the Coach can reach every
one. The gap is downstream: `/api/me/intelligence` maps only **16** tools to
sections, and the MCP package exposes **15**, so **28 registry tools — including
all 9 ecosystem tools that `FEATURES.md` §11 explicitly claims are MCP-reachable —
cannot be called by any MCP client.**

---

## E. Deep-dive findings

### DD-1 — Adaptive / learning stack

> **Resolved post-audit (#118) — and the finding below understated it.** This section says the
> loop is "never verified closing" and calls that unproven. Driving it end to end showed the
> loop _did_ close, in **0 ms**: every recommendation was graded in the instant it was issued,
> against the analytics that produced it, and a belief captioned "Historical evidence
> suggests…" was minted on that basis. Not an unproven capability — an actively wrong one. An
> observation window now gates it, and §DD-1's acceptance test is satisfied. The window left
> the loop correct but **inert** — a per-process `Map` could not carry a pending outcome to
> the request that would judge it — which **#21 then closed** by persisting outcomes to
> `recommendation_outcome_log`. The acceptance test now passes _across a process restart_.
> See the addendum.

**Requirement (as best understood):** learn durable per-athlete beliefs from
history, adapt recommendations accordingly, explain causally, and gate every
recommendation through an integrity layer that blocks unsupported or unsafe claims.

**Status:** Partially complete · **Score 3/5** · Confidence **Medium**

**Evidence:** `lib/athlete-memory/` (18 files), `lib/adaptation-engine/` (8),
`lib/causal-reasoning/` (5), `lib/recommendation-learning/` (7),
`lib/recommendation-integrity/` (11), `lib/recommendation-outcomes/` (7),
`lib/adaptive-intelligence/` (6), `lib/learning-observability/` (3),
`lib/longitudinal-analysis/` (3).

**Validation performed:** ran the demo athlete through
`buildAthleteMemoryProfile`, `inferAdaptationSignals`, `inferLikelyCauses` ×6
phenomena, `buildCausalNarrative`, and `evaluateRecommendation` with a real
`CoachingContext`.

**Observed behaviour (fact):**

- Memory profile returned **15 beliefs across 7 categories** (adaptationPatterns 3,
  fatiguePatterns 2, pacingPatterns 3, taperResponses 0, modalityInteractions 3,
  durabilitySignals 2, recommendationOutcomes 2). Each carries `statement`,
  `confidence`, `evidence[]`, `counterEvidence[]`, `stability`
  (`emerging`/`stable`), and `recommendedUse`.
- Language is consistently hedged: "Aerobic efficiency **appears to** improve
  during stretches of stable volume."
- `inferAdaptationSignals` downgrades confidence when evidence is thin
  (`evidenceCount < 2 && confidence === "high"` → `medium`;
  `inferAdaptationSignals.ts:15-17`).
- Causal reasoning returned drivers for readiness/fatigue/efficiency and
  **"Insufficient context for causal attribution"** for `execution` and `pacing`.
- `evaluateRecommendation` correctly flagged
  `"I diagnose overtraining and prescribe rest; this prevents injury."` →
  `passed=false, score=75, severity=high, medical_claim`.

**Interpretation:** the epistemics here are the strongest part of the codebase.
Refusing to explain `pacing` rather than inventing a driver, and carrying
`counterEvidence` alongside `evidence`, are deliberate anti-hallucination choices.

**Gaps / defects:**

- **D-3 (High)** — see below; the medical vocabulary is too narrow in both layers.
- `lib/adaptive-intelligence/` at **38.23%** and `recommendation-outcomes` at
  **53.73%** — the weakest-tested parts of the stack.
- `taperResponses: 0` on a 12-month athlete with a race goal. Plausible (no taper
  in the synthetic data) but **unconfirmed** — I could not distinguish "correctly
  found none" from "never fires."
- **The learning loop is never verified closing.** `trackRecommendationOutcome` →
  `evaluateRecommendationOutcome` → `updateBeliefsFromOutcome` exist and are unit
  tested in isolation (3 tests), but no test drives a recommendation through
  adherence scoring into a changed belief. This is the central claim of the
  subsystem and it is unproven.
- `evaluateRecommendation` throws `TypeError` on a malformed context
  (`contextEvidence.ts:15`) rather than degrading — internal API, typed input, so
  low practical risk.

**Acceptance tests that would settle it:**

1. Log a recommendation, feed 2 weeks of adherent-but-unsuccessful actuals, assert
   the corresponding belief's `confidence` or `counterEvidence` measurably changes.
2. Assert `evaluateRecommendation` rejects a corpus of ≥20 clinical phrasings
   (treat/cure/heal/rehab/manage + 8 named conditions) — currently all pass.
3. Construct an athlete with a genuine taper block and assert
   `taperResponses.length > 0`.
4. Property test: for any belief, `confidence === "high"` implies
   `evidence.length >= 2`.

**Remediation direction:** the architecture is sound; the work is closing the
loop and widening the safety net. Add one integration test that proves an outcome
mutates a belief — without it, "learning" is structural rather than demonstrated.
Then extract the medical vocabulary into a single shared, well-populated module
consumed by both `stripMedicalLanguage` and `safetyChecks`, and treat it as a
security-style denylist with a regression corpus. Raise `adaptive-intelligence`
coverage before adding features on top of it.

---

### DD-2 — AI planning + training calendar (guardrail / repair / fallback)

**Requirement:** produce a weekly plan via LLM; validate against athlete-derived
guardrails; repair violations; and fall back to a deterministic rule-based plan
whenever the LLM path fails or returns schema-invalid output. **The fallback must
produce a valid plan.**

**Status:** Partially complete · **Score 4/5** · Confidence **High**

**Evidence:** `lib/ai-planning/generateWeeklyPlan.ts:55-148` (the ladder),
`buildSafeFallbackWeeklyPlan.ts` (309 LOC), `validateWeeklyPlan.ts` (260),
`repairWeeklyPlan.ts` (129), `weeklyPlanGuardrails.ts` (158),
`weeklyPlanSchema.ts` (Zod + strict OpenAI JSON schema),
`lib/recommendation-integrity/evaluateWeeklyPlan.ts`.

**Validation performed:** six-case fault injection with `vi.stubGlobal("fetch")`.

**Observed behaviour (fact):** guardrails derived from the demo athlete were
`maxHardSessions=1, maxWeeklyRunKm=23.9, longRunMaxKm=11.7`.

| Case | Injected fault                                   | `source`   | `validation.valid` | `integrity.passed` | Result                         |
| ---- | ------------------------------------------------ | ---------- | ------------------ | ------------------ | ------------------------------ |
| A    | no `OPENAI_API_KEY`                              | `fallback` | ✅ true            | ✅ true            | 5 workouts, 1 hard, 24.3 km    |
| B    | `fetch` throws `ECONNRESET`                      | `fallback` | ✅ true            | ✅ true            | identical valid plan           |
| C    | schema-invalid JSON                              | `fallback` | ✅ true            | ✅ true            | identical valid plan           |
| D    | non-JSON prose ("I'm sorry…")                    | `fallback` | ✅ true            | ✅ true            | identical valid plan           |
| E    | **schema-valid but dangerous** (7× hard, 240 km) | `repaired` | ✅ true            | ✅ true            | **reduced to 1 hard, 23.8 km** |
| F    | medical language in a valid plan                 | `repaired` | ✅ true            | ✅ true            | ⚠️ **medical text survived**   |

**Interpretation:** this is the headline positive finding. **The rule-based
fallback demonstrably triggers on all four failure modes and produces a valid,
guardrail-respecting plan every time** — the exact question posed. Case E is
stronger still: a plan that passed Zod validation but prescribed seven consecutive
hard sessions and 240 km was caught by the _semantic_ layer and repaired down to
the athlete's actual capacity. The four independent trigger points
(`forceFallback`, missing key, `!parsed.success`, bare `catch`) plus the three-stage
`finalizePlan` ladder mean there is no path by which an unvalidated plan reaches
the user.

**Gaps / defects:**

- **D-3 (High):** in case F the final plan read _"This plan will assess and treat
  your stress fracture and cure your injury"_ with
  `validation.valid=true, integrity.passed=true`. `stripMedicalLanguage` rewrote
  only `diagnose`→`assess`.
- `stripMedicalLanguage` (`repairWeeklyPlan.ts:112-129`) cleans only `summary`,
  `workouts[].purpose`, `workouts[].reasoning`, and `limitations[]`. It does **not**
  clean `rationale.primaryGoal`, `rationale.tradeoffs`, `rationale.risksManaged`,
  `rationale.evidenceUsed`, `alternatives[]`, or workout `title`/`type` — so even
  its three in-vocabulary patterns leak through those fields.
- Case A's fallback summed to **24.3 km against a stated `maxWeeklyRunKm` of
  23.9**. My measurement summed `distanceKm` across all modalities, so this may be
  correct behaviour (non-run km excluded from the cap) — **unconfirmed**, worth a
  targeted check.
- `lib/plan/` at **26.31%** and `training-calendar/calendarCoachContext.ts` at
  **0%**.
- Integration gap: `/api/me/weekly-plan` and `/api/me/coach/plan` accept the
  API-key path, but `/api/me/training-calendar` is session-only — an automation
  client can generate a plan it cannot persist.

**Acceptance tests that would settle it:**

1. Assert the medical corpus (≥20 phrasings) is neutralised in **every** string
   field of the returned plan, `rationale` and `alternatives` included.
2. Assert `sum(distanceKm where modality==="run") <= guardrails.maxWeeklyRunKm`
   for the fallback across ≥10 athlete profiles.
3. Property test over generated adversarial-but-schema-valid plans: assert
   `validation.valid && integrity.passed` and guardrail conformance always hold.
4. Round-trip a generated plan through `/api/me/training-calendar` under the
   API-key auth path.

**Remediation direction:** the ladder itself needs no structural change — it is
well factored and provably effective. Fix D-3 by moving medical scrubbing to a
whole-object recursive string walk over a shared vocabulary, and add the property
test in (3) to lock in the case-E behaviour before the guardrail logic evolves.
Then reconcile the auth split so a plan-generating client can also persist.

---

### DD-3 — Forecast accuracy tracking (log → score → surface)

**Requirement:** log each issued forecast, later score it against actual race
results, and surface calibration quality in `/intelligence`.

**Status:** **Defective** · **Score 2/5** · Confidence **High**

**Evidence — the chain is fully wired:**

| Stage     | Location                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Log       | `lib/intelligence/tools.ts:353` → `logForecastForCalibration` → `lib/db/forecast-log.ts` (`db/migrations/007_forecast_log.sql`)                       |
| Score     | `lib/forecasting-v2/calibrationService.ts:46` → `scoreForecast` (`calibration.ts:51`) → `saveForecastEvaluation`                                      |
| Summarize | `summarizeCalibration` (`calibration.ts:83`)                                                                                                          |
| Serve     | `app/api/me/forecast-accuracy/route.ts`; tool `get_forecast_accuracy` (`tools.ts:703`)                                                                |
| Surface   | `hooks/use-forecast-accuracy.ts` → `components/intelligence/intelligence-forecast-accuracy.tsx` → `components/intelligence/intelligence-page.tsx:163` |

**Validation performed:** 11/11 `lib/db/__tests__/forecast-log.test.ts`
persistence tests pass against local Postgres (log → read back → save evaluation).
I then probed `scoreForecast`'s matching semantics directly.

**Observed behaviour (fact):** given a forecast issued 2026-05-01 predicting
1:30:00 for a half marathon (p10 5250 – p90 5550):

| Efforts supplied                                                           | Matched                  | Reported                                                                      |
| -------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| Easy 21.0 km run on 05-04 (2:10:00) **and** actual race on 06-01 (1:29:50) | the **easy run**         | `withinIntervalPct: 0`, `medianSignedErrorSec: +2400` (**40 min optimistic**) |
| Actual race only                                                           | the race                 | `withinIntervalPct: 100`, `medianSignedErrorSec: −10` (**10 s error**)        |
| Easy 19.7 km trudge (2:20:00)                                              | accepted as an HM result | `actualTimeSec: 8400`                                                         |

**Interpretation:** the persistence and presentation layers are correct and
integrated; the **scoring predicate is wrong**. `scoreForecast`
(`calibration.ts:56-63`) filters on distance within ±7% and `date > issuedAt`,
then sorts ascending by date and takes `[0]` — the **earliest** qualifying
activity, with **no race-like, pace, or effort-quality filter**. Any training run
in the distance band becomes "the athlete's race result." A model that was
essentially perfect is reported as 40 minutes optimistic with 0% interval
coverage, and the error is _systematically pessimistic_ because easy runs are
always slower than race efforts.

This compounds with S1: the `efforts` array passed in
(`app/api/me/forecast-accuracy/route.ts:15`,
`analytics.racePredictionAnalysis.efforts`) is the same set that already includes
easy runs mislabelled "race-quality efforts" (D-1 context). It also directly
contradicts the intent of commit `f4375bf` ("stop best-effort extraction reporting
times nobody ran") — that fix did not reach this consumer.

Secondary observation: `logForecastForCalibration` requires a database, so in
export-only mode nothing is ever logged and the `/intelligence` panel is
permanently empty. That is defensible for a local-first mode but is undocumented.

**Acceptance tests that would settle it:**

1. The exact scenario above: assert the **race** is matched, not the earlier easy
   run (currently fails).
2. Assert a run in the distance band whose pace is >15% slower than the forecast
   is **not** eligible to score it.
3. Assert that when several eligible efforts exist, the **fastest** (or an
   explicitly `isRaceLike` one) is selected.
4. End-to-end: log → score → `GET /api/me/forecast-accuracy` returns the expected
   `withinIntervalPct`.

**Remediation direction:** restrict candidate efforts to genuine race attempts —
prefer an explicit `isRaceLike`/`source === "PR"` flag (the `EffortPoint` type
already distinguishes sources), and when several qualify select the fastest rather
than the earliest. Tighten the band from ±7% and add a pace-plausibility guard so
a slow long run cannot be mistaken for a race. Until fixed, the forecast-accuracy
panel in `/intelligence` is not merely imprecise but **biased pessimistic**, and
would erode trust in an otherwise well-calibrated forecast engine; consider
hiding it behind a flag until the predicate is corrected.

---

### DD-4 — Wellness / leg-feel local-first + server reconciliation

> **Resolved post-audit (#115).** Both halves are fixed: `mergeFromServer` now compares
> `reportedAt` and adopts the newer report, and writes are tracked in `pendingDates` and
> flushed on mount so a failed save is retried rather than dropped. All four acceptance
> tests proposed below are implemented verbatim, plus a convergence check. `feel-store.ts`
> went from **0% to covered by 23 tests**. See the addendum.

**Requirement:** capture subjective leg-feel locally with no server dependency,
reconcile with the server when signed in, and feed it into fatigue/readiness.

**Status:** Partially complete · **Score 3/5** · Confidence **High**

**Evidence:** `stores/feel-store.ts` (zustand + `persist`, key
`strideiq-feel-store-v1`), `hooks/use-leg-feel.ts`,
`app/api/me/leg-feel/route.ts`, `lib/db/leg-feel.ts`,
`db/migrations/008_leg_feel.sql`, `lib/wellness/` (**97.61%** coverage),
`lib/analytics/fatigue.ts` + `__tests__/fatigue-legfeel.test.ts`.

**Validation performed:** drove `setFeel` / `mergeFromServer` directly; read the
route's validation; ran the wellness and fatigue-legfeel tests.

**Observed behaviour (fact):**

- Local-first works: `setFeel` writes optimistically, POST is fire-and-forget,
  and the store degrades cleanly to local-only.
- Route validation is the best in the codebase: Zod schema, `401` unauthorized,
  `400` on unparseable JSON, `422` with `error.flatten()` on schema failure,
  `yyyy-MM-dd` regex on the date parameter, `note` capped at 280 chars.
- **Merge is presence-based, not recency-based.** Desktop wrote `fresh` at
  07:00; server then held a `post_run` report of `heavy` at 18:00.
  `mergeFromServer` **kept the stale `fresh`** and discarded the newer `heavy`
  (`feel-store.ts:22`: `report && !s.byDate[date] ? adopt : ignore`).
- Store surface is exactly `byDate, setFeel, mergeFromServer, clear` — **no
  `pending`/`dirty`/`retry`/`sync` concept whatsoever.**

**Interpretation:** "local wins" is a deliberate, documented-in-comment choice
and it is right for the common case (don't clobber what the athlete just typed).
But the `LegFeelReport` type carries `reportedAt` and `source` **precisely so
reports can be ordered**, and the merge ignores both. The result is a genuine
multi-device convergence bug: a morning report on a laptop permanently shadows a
post-run report from the phone, and the two devices never reconcile. Combined
with the absent retry queue, a POST that fails while offline is lost silently —
the local value survives on that device but the server and every other device
never learn it.

**Gaps / defects:**

- **D-4 (Medium):** recency ignored on merge.
- No retry/dirty-flag queue; failed POSTs are silently dropped.
- `stores/feel-store.ts` at **0% coverage** despite `lib/wellness/` at 97.61% —
  the tested part is the calibration math, not the reconciliation logic.
- `/api/me/leg-feel` is **session-only**, so MCP/automation clients cannot read or
  write leg-feel even though `intelligenceContextFromRequest` fetches it into
  every intelligence context (`lib/intelligence/auth.ts:41`).
- No conflict is ever surfaced to the user.

**Acceptance tests that would settle it:**

1. Local `reportedAt` older than server's → assert the **server** value wins
   (currently fails).
2. Local newer than server → assert the **local** value wins (currently passes).
3. POST rejects with 500 → assert the report is queued and retried on next mount.
4. Assert `source: "post_run"` supersedes a same-day `"morning"` report.

**Remediation direction:** change `mergeFromServer` to compare `reportedAt` and
adopt the newer report, falling back to presence only when a timestamp is
missing — a small, well-contained change that turns the store into a correct
last-write-wins CRDT for this data shape. Add a `pendingDates: string[]` to the
store and flush it on mount to make the local-first promise durable rather than
best-effort. Cover `feel-store.ts` directly, since its reconciliation policy is
the actual product behaviour and currently has zero tests.

---

### DD-5 — S1 Analytics: the race-prediction defect (score ≤ 3 trigger)

> **Resolved post-audit.** Both halves are fixed: the R² computation (D-1, #107) and
> the effort-set pollution described below (#110), which moved the fitted exponent from
> 0.991 to 1.063. Fixing this also surfaced two defects not found during the audit —
> D-5 (multi-anchor never sorted) and **D-6 (the Cameron model, wrong by 57 minutes)**.
> Both are now fixed too — D-6 in #111. See the addendum.

**Status:** **Defective component** inside a strong subsystem · Confidence **High**

**D-1 (High) — `fitPowerLawRegression` computes R² incorrectly.**

`lib/analytics/predictions.ts:163-166`:

```js
const ssRes = ys.reduce((s, x, i) => {
  const pred = intercept + exponent * x; // `x` is bound to ys[i], not xs[i]
  return s + (ys[i] - pred) ** 2;
}, 0);
```

The reducer iterates `ys`, so the callback parameter named `x` is a **log-time**,
while the regression line requires the **log-distance** `xs[i]`. Classic
shadowing slip.

**Numeric proof:** on a mathematically perfect power law
(`time = 300 · d^1.06`, six points), where a correct R² is exactly **1.0**:

| Quantity                | Value                 |
| ----------------------- | --------------------- |
| `exponent`              | 1.0600000000000056 ✅ |
| `coefficient`           | 299.9999999999965 ✅  |
| **reported `rSquared`** | **−79.451** ❌        |
| correctly computed R²   | 1.0                   |

On the demo athlete: `rSquared: -143.078` over 227 points. `exponent` and
`coefficient` are unaffected, so the fitted curve itself is fine — **only the
goodness-of-fit statistic is corrupted.** Three consequences:

1. **User-facing nonsense.** `predictions.ts:339` prints it verbatim: _"The
   regression line fits time vs distance in your data (exponent 0.99,
   **R²=-143.08**)."_
2. **Unreachable branch / dead code.** `predictions.ts:327` gates
   `confidence = "high"` on `regression.rSquared > 0.9`. Since the value is always
   garbage-negative, **race-prediction confidence can never exceed `"medium"`.**
3. **Exposed via tooling.** Reached by the `get_predictions` tool, which is in the
   registry **and** exposed through MCP, and rendered on `/performance`.

**Contributing issue — the effort set is not what it claims.** `predictions.ts:334`
describes the inputs as _"227 **race-quality** efforts"_, but the set is every
full run ≥3 km. The five slowest "efforts" on the demo athlete are
`Aerobic base run` (6:00/km), `Easy shakeout` (5:58/km), and three
`Morning easy run`s (5:56–5:57/km). The consequence is a fitted `exponent` of
**0.991** — essentially linear, implying _no_ pace fade with distance, which is
physiologically implausible (Riegel ≈ 1.06). Downstream, two engines inside the
same `DashboardInsights` object disagree by **26 minutes** for the same athlete:

| Engine                                                                    | HM prediction |
| ------------------------------------------------------------------------- | ------------- |
| `racePredictions` (legacy Riegel, anchored on the real 10K race of 43:40) | **1:36:45**   |
| `racePredictionAnalysis.consensus` (regression-influenced)                | **2:02:56**   |

**Test-quality root cause.** `__tests__/predictions.test.ts` exercises
`fitPowerLawRegression` but asserts only `exponent > 1` and `curve.length > 10` —
it never asserts `rSquared`. By contrast `__tests__/physiology.test.ts:92` **does**
assert `rSquared > 0.99` on its own critical-speed fit, and that fit is correct.
The codebase knows how to test this; this one function was simply under-asserted.

**Acceptance tests:** (1) perfect power law → `rSquared` ≈ 1.0 (currently −79);
(2) `0 <= rSquared <= 1` for all inputs; (3) fitted `exponent` ∈ [1.02, 1.12] for
a realistic athlete; (4) `consensus` HM within 5% of a Riegel projection from the
athlete's best recent race.

**Remediation direction:** the one-line fix is `xs[i]` in place of `x`, but the
more valuable change is the second one — restrict the regression input to
genuinely race-like efforts (or weight by effort quality) so `exponent` lands in a
physiological range and the two prediction engines stop contradicting each other.
Add the R² bounds assertion as a property test. Given that D-1's confidence gate
is dead and D-2 shares the same polluted effort set, treat "what counts as an
effort" as one cross-cutting design decision rather than three separate bugs.

---

## F. Cross-cutting findings

### F-1 — Test quality: strong depth, categorical breadth gap (High)

649 passing tests is a real asset, and assertion strength in the numeric core is
good — `forecastTests.test.ts`, `projectionHonesty.test.ts`,
`uncertaintyEstimates.test.ts`, and `physiology.test.ts` assert on _values and
bounds_, not just shapes. But coverage is categorically uneven:

| Layer                                                                      |   Coverage | Note                               |
| -------------------------------------------------------------------------- | ---------: | ---------------------------------- |
| `lib/analytics`                                                            |     92.78% | Strong                             |
| `lib/forecasting-v2`                                                       |     88.62% | Strong                             |
| `lib/recommendation-integrity`                                             |     86.18% | Good                               |
| `lib/wellness`                                                             |     97.61% | Math only, not reconciliation      |
| `lib/intelligence`                                                         | **31.63%** | 1432-LOC registry                  |
| `lib/intelligence/llm`                                                     |     **0%** | Tool-calling loop                  |
| `lib/strava`                                                               |     33.33% | Ingestion                          |
| `lib/db`                                                                   |  **3.02%** |                                    |
| `lib/sync`, `lib/import`, `lib/storage`, `lib/auth`, `lib/strava/webhooks` |     **0%** |                                    |
| **All 26 API routes**                                                      |     **0%** | now 10–96%, see below              |
| **All 16 pages, 210 components**                                           |     **0%** |                                    |
| `stores/`                                                                  |      6.25% | `feel-store.ts` now covered (#115) |

Overall **50.65% statements / 41.45% branches**. Two specific weaknesses:
`lib/intelligence/__tests__/tools.test.ts` validates tool _metadata_ (names,
descriptions, schemas) but **never executes a tool**, so 1432 lines of executor
logic are untested; and `predictions.test.ts` under-asserted its way past D-1.

**Recommendation:** add route-level integration tests (highest value per hour —
26 routes at 0%), execute a representative sample of tool executors, and set
non-blocking coverage _thresholds_ in `vitest.config.ts` so regressions surface
(CI already runs coverage but enforces nothing).

> **Post-audit — the API-route row above is no longer true.** #112 took all 26 routes off
> 0% (now 10–96%) and `lib/auth` from 0% to 91%, adding 107 tests. The **pages and
> components rows are unchanged at 0%**, so G-1 is closed for the server surface only.
> Overall statements moved 50.65% → 52.9% — a modest number for 107 tests, which is itself
> the point: the value was in _which_ branches got covered (auth, validation, OAuth state,
> failure modes), not how many lines.
>
> **Post-audit — this finding was understated, and remediation showed why.** Fixing D-1,
> D-5 and D-6 turned up **three separate defects in a single well-covered file**,
> `lib/analytics/predictions.ts` (92.78% coverage). None was a missing test. Each hid
> behind an assertion that looked reasonable and verified almost nothing:
>
> | Defect                      | The test that let it through                                                                    |
> | --------------------------- | ----------------------------------------------------------------------------------------------- |
> | D-1 R² garbage (−143)       | `fitPowerLawRegression` asserted only `exponent > 1` and `curve.length > 10` — never `rSquared` |
> | D-5 comparator never sorted | multi-anchor had no test of ordering at all, only that predictions existed                      |
> | D-6 Cameron off by 57 min   | asserted "Cameron > Riegel for the marathon" — which inflating _everything_ trivially satisfies |
>
> D-6 is the sharpest case: a passing test guarded a model that was wrong by 57 minutes,
> because the asserted property was implied by the bug. Also note the contrast within the
> same subsystem — `physiology.test.ts:92` _does_ assert `rSquared > 0.99` on its own fit,
> and that fit was correct. The codebase knows how to test this; three functions simply
> were not.
>
> **This changes the recommendation's emphasis.** Coverage percentage and coverage
> thresholds would not have caught any of the three — the lines were all executed. The
> higher-value work is auditing _assertion strength_ in the numeric core: for every
> computed statistic, assert its value or bounds against an independently-known answer
> (a perfect-fit case, a published reference table), not merely that it exists or that a
> weak inequality holds. Route coverage (#7) remains the biggest absolute gap; this is
> the biggest gap in code that already looks tested.

### F-2 — Auth: API-key path cannot escalate across users ✅ (informational)

> **Post-audit — this is now tested, not just inspected.** The conclusion below was reached
> by reading the code. #112 added assertions for it: five attempts to redirect a valid API
> key at another athlete via query parameters and headers, all resolving to the
> env-configured user, plus session-beats-key ordering and HMAC verification in the raw
> cookie-header fallback. `lib/auth` and `lib/intelligence/auth.ts` were both at 0% when
> this finding was written.

I specifically checked for cross-user escalation and **found none.** In
`lib/intelligence/auth.ts:14-24`, the API-key path resolves the user as
`userId = process.env.STRIDEIQ_API_KEY_USER_ID` — read from the **server
environment**, never from request-controlled input. A valid key can therefore only
ever act as the single pre-configured user; there is no header, query parameter,
or body field that can redirect it. Ordering is also correct: the session cookie
is checked **first**, so an attacker-supplied API-key header cannot override a
logged-in browser session.

`parseSessionToken` (`lib/auth/session.ts:26-43`) is sound: HMAC-SHA256,
`timingSafeEqual` with a length pre-check, expiry enforced, and a `SESSION_SECRET`
minimum of 16 chars. Cookies are `httpOnly`, `sameSite: "lax"`, `secure` in
production.

### F-3 — API key compared with `===`, not `timingSafeEqual` (Low)

`lib/intelligence/auth.ts:20`: `apiKey === process.env.STRIDEIQ_API_KEY`. The
session path in the same codebase correctly uses `timingSafeEqual`; this path does
not, giving a theoretical timing side-channel. Practically hard to exploit over a
network, but it is an inconsistency with the project's own standard.
**Recommendation:** use `timingSafeEqual` with a length guard here too.

### F-4 — Inconsistent auth across `/api/me/*` (Medium)

11 routes accept session+API-key; 12 are session-only. The split appears
unintentional and creates functional gaps — most clearly, `/api/me/weekly-plan`
and `/api/me/coach/plan` are API-key-reachable while `/api/me/training-calendar`
is not, so an automation client can generate a plan but not persist it.
`/api/me/leg-feel` is likewise session-only although leg-feel is loaded into every
intelligence context. **Recommendation:** decide the policy per resource
deliberately and document it in `FEATURES.md` §10.

### F-5 — Input validation gaps on mutating routes (Medium)

> **Post-audit — partly addressed.** #112 added contract tests for the routes that _do_
> validate (`me/leg-feel`, `me/preferences`, `me/training-calendar`): 400 on unparseable
> bodies, 422 on schema violations, and no write reaching persistence on rejection. The
> six routes with **no** schema are still unvalidated — tests document the gap rather than
> close it. One of the six, `webhooks/strava/subscribe`, turned out to have a worse problem
> than missing validation (D-7, unauthenticated GET) and that is fixed.

Only 7 of 26 routes use Zod. Six mutating routes have no schema validation:
`auth/logout`, `me/strava`, `sync/strava`, `sync/strava/streams`,
`webhooks/strava`, `webhooks/strava/subscribe`. Several take no body, so the real
exposure is narrower than the count suggests, but `me/strava` and the sync routes
should validate. Where Zod _is_ used the quality is high — `me/leg-feel` returns
`422` with `error.flatten()` and `400` on unparseable JSON.
**Recommendation:** add schemas to the POST bodies of `me/strava` and both sync
routes.

### F-6 — Data-integrity risk in the merge layer (Medium)

> **Post-audit — this was not a risk, it was an active defect, and the severity was
> understated.** Whole-record replacement was deleting `trainingLoad`,
> `gradeAdjustedPaceSecPerKm`, `totalSteps`, `weatherTempC` and `fitFilename` on every
> sync-after-import, moving CTL/ATL/TSB and breaking FIT matching. Fixed in #113 — see the
> addendum. The recommendation below ("add precedence tests with deliberately conflicting
> triples") is exactly what exposed it; had those tests existed, this would have been found
> as a defect rather than filed as a risk.

`lib/data/mergeImport.ts` reconciles three sources (CSV export, Strava API, FIT
detail) and has **3 tests**; `lib/import/` and `lib/sync/` are at **0%**. Real
fixture parsing is verified (`export_105352925/`, 57 runs), but three-way
precedence — which source wins when the same activity arrives from CSV _and_ API
_and_ FIT with conflicting distance or moving time — is not covered. This is
exactly the class of silent corruption that undermines every downstream metric.
**Recommendation:** add precedence tests with deliberately conflicting triples,
asserting an explicit documented winner per field.

### F-7 — Performance risks unverified (Medium)

- **Stream downsampling:** `lib/strava/downsample.ts` at **40%** statement
  coverage, `lib/route-intelligence/` at 34.63%. FEATURES.md §9.1 claims
  downsampling exists "for performance on long activities"; no test asserts an
  output-size bound or a latency budget.
- **IndexedDB volume:** `lib/storage/fit-db.ts` at **0%**. Per-activity
  stream-rich detail for a multi-year athlete could be hundreds of MB with no
  eviction, quota handling, or `QuotaExceededError` path evident.

**Recommendation:** assert a downsample output-size ceiling for a synthetic
50k-point stream, and add explicit quota-failure handling in `fit-db.ts`.

### F-8 — `npm test` can delete rows from the production database (High, process)

> **Resolved post-audit** — exactly as recommended below: gated on `TEST_DATABASE_URL`
> with a non-local host refused. See the addendum for the verification matrix.

`.env.local` holds a live Neon `DATABASE_URL`; the four `lib/db` test files
`DELETE` rows for fixed test UUIDs and are gated only on `!!process.env.DATABASE_URL`.
They skip today purely because Vitest does not load `.env.local`. Any contributor
who exports that variable, or any future change adding dotenv loading to
`vitest.config.ts`, turns `npm test` into a destructive operation against
production. **Recommendation:** gate these tests on an explicit opt-in such as
`TEST_DATABASE_URL`, and refuse to run if the host resolves to a non-local
address.

### F-9 — Error handling (Low, generally good)

Consistent and deliberate. Calibration logging is explicitly non-fatal
(`calibrationService.ts:32`, `:61` — "logging must never break the forecast
itself"); the plan path has a bare `catch` that always yields a valid fallback;
API routes return typed JSON errors with reasonable status codes. Two minor notes:
`app/api/me/intelligence/route.ts:113` infers a 404 by string-matching
`message.includes("No Strava connection")`, which is brittle; and
`evaluateRecommendation` throws on malformed context rather than degrading.

### F-10 — Webhook signature scheme may be incompatible with Strava (High if confirmed — **NOT VERIFIED**)

> **Resolved post-audit — severity confirmed High, hypothesis wrong.** Strava _does_
> sign webhook POSTs, via `X-Strava-Signature` rather than `x-hub-signature-256`, so
> the conclusion below ("Strava does not sign webhook payloads") is incorrect. The
> incompatibility it predicted was nonetheless real and total: every genuine delivery
> was rejected. Fixed and merged — see the addendum. The paragraph is left unedited as
> the record of what I actually concluded at audit time.

`lib/strava/webhooks/verify.ts` is well written: it fails closed (rejects a
missing or non-`sha256=` header), uses `timingSafeEqual`, and HMACs the raw body
with `clientSecret`. `app/api/webhooks/strava/route.ts:30` rejects any POST that
does not verify, and resolves the user via `findUserIdByStravaAthleteId(owner_id)`
rather than trusting request data — so there is no cross-user write.

**However:** `x-hub-signature-256` is a GitHub convention. To my knowledge Strava
does **not** sign webhook payloads — its subscription flow validates via
`hub.challenge` on GET only, and event POSTs carry no signature header. If that is
correct, **every genuine Strava webhook delivery would be rejected with 403 and no
activity would ever sync via push.**

I am flagging this as an **unverified risk, not a confirmed defect.** Webhooks were
declared out of scope for execution, I could not test it, no test covers
`verifyWebhookSignature` (0% coverage on `lib/strava/webhooks/`), and no repo
documentation describes the expected signature scheme. My Strava API knowledge may
be out of date. **Recommendation:** verify against current Strava webhook
documentation as a priority; if unsigned is confirmed, replace signature
verification with subscription-ID validation plus `owner_id` reconciliation (which
the handler already does).

---

## G. Prioritized remediation table

Foundational correctness and process safety first; polish last.

> **Post-audit status.** Items **1 (R-1/F-10)**, **2 (F-8)**, **3 (D-1)**, **4 (D-2)**,
> **5 (effort-set semantics)** and **6 (D-3)** are fixed and merged to `main` — see the
> addendum. **The entire High-severity foundational block of this table is now closed.**
>
> The table is left as originally written. Two of its stated Actions were not followed as
> phrased: item 1's ("if unsigned, switch to subscription-ID validation") rested on a
> hypothesis that proved wrong — Strava does sign, so the fix matched its real scheme
> instead; and item 4 was implemented with a plausibility filter rather than "select
> fastest", because an existing test documents earliest-match as intentional. Item 5's
> Action ("define one effort-quality predicate") was followed, and turned out to need no
> product decision — the classifier already existed.
>
> Items **11 (D-6, Cameron)**, **12 (D-5)** and **13 (D-7)** were added post-audit and are
> all fixed — D-6 in #111, after I first deferred it on the mistaken grounds that it was a
> modelling decision rather than a bug; D-7 was found by the item-7 work itself.
>
> **Item 7 is done for the API surface** (#112: all 26 routes off 0%, `lib/auth` 0% → 91%,
> 107 tests) **but not for pages and components**, which remain at 0% and need a different
> approach — a browser or component-render harness, neither of which exists in the repo.
>
> **Items 8 (merge-layer precedence), 9 (G-2), 10 (D-4) and 11 (G-3) are done** (#113, #114,
> #115). Item 8 was not the untested risk it was filed as but an active defect deleting
> training load on the documented import flow. Items 8 and 10 turned out to be **the same
> failure in two modules** — one side's data winning on something other than which data is
> better — needing different resolutions: field-wise coalescing where the sources carry
> complementary fields, recency where they carry the same fields at different vintages.
>
> **Item 16 (doc drift) is done** (#116), and **D-8** — two time-dependent suites that turned
> `main` red overnight — was found and fixed in #117.
>
> **Item 13 (the learning loop) is done** (#118) — and it was not the unproven capability it
> was filed as, but an actively wrong one, grading every recommendation in the instant it was
> issued.
>
> **Every item originally in this table is now closed.** Fixing item 13 opened a new one:
> **21**, persisting the outcome store, without which the loop was correct but inert. **That
> is now closed as well** (#119), and its operational follow-on is done too — **migration 009
> is applied to production**. Nothing in this table is outstanding.
> The highest-value remaining item is therefore **14** (Zod on the three remaining mutating
> routes), then **15** (downsampling and IndexedDB volume), and the Low-severity items 17–20.
> Plus pages and
> components, still at 0% and needing a harness the repo does not have, and two things this
> environment cannot prove at all: live Strava webhook delivery, and MCP against a real Claude
> Desktop client.
>
> Items **11**, **12** and **13** were added post-audit; everything above them is as first
> written.

|   # | Issue                                                                                          | Affected subsystems | Sev.   | Action                                                                                                | Effort | Dependencies                 |
| --: | ---------------------------------------------------------------------------------------------- | ------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ------ | ---------------------------- |
|   1 | **R-1/F-10** Webhook signature may reject all real deliveries                                  | S12, ingestion      | High*  | Verify against Strava docs; if unsigned, switch to subscription-ID + `owner_id` validation; add tests | S      | Strava API docs              |
|   2 | **F-8** `npm test` can delete production rows                                                  | Eng/ops, S10        | High   | Gate `lib/db` tests on `TEST_DATABASE_URL`; refuse non-local hosts                                    | XS     | none                         |
|   3 | **D-1** R² mathematically wrong; dead confidence branch; printed to users                      | S1, S7              | High   | Fix `xs[i]` at `predictions.ts:163`; add R² bounds property test                                      | XS     | none                         |
|   4 | **D-2** `scoreForecast` matches earliest run, not the race                                     | S2                  | High   | Require race-like efforts; select fastest; add pace-plausibility guard                                | S      | #5 (shared effort semantics) |
|   5 | **Effort-set semantics** easy runs labelled "race-quality"; two engines differ by 26 min       | S1, S2              | High   | Define one effort-quality predicate; apply to regression + calibration; fix the §334 prose            | M      | none                         |
|   6 | **D-3** Medical vocabulary too narrow in both layers                                           | S4, S5              | High   | Shared vocabulary module; recursive whole-object scrub; regression corpus                             | S      | none                         |
|   7 | **G-1** 0% coverage on 26 routes                                                               | S12, all            | High   | Route-level integration tests, auth paths included                                                    | L      | #2                           |
|   8 | **F-6** Three-way merge precedence untested (fixed in #113 — was an active defect)             | S6                  | Medium | Done: field-wise merge; 8 conflicting-record tests with a winner per field                            | M      | none                         |
|   9 | **G-2** 28 of 44 tools unreachable via MCP (fixed in #114)                                     | S7, S17             | Medium | Done: `?tool=` addresses any registry name; `?section=tools` for discovery                            | M      | none                         |
|  10 | **D-4** Leg-feel merge ignores `reportedAt`; no retry queue (fixed in #115)                    | S14                 | Medium | Done: recency merge; `pendingDates` flush; 23 tests on a store that had none                          | S      | none                         |
|  11 | **G-3** MCP package has zero tests (fixed in #114)                                             | S17                 | Medium | Done: 29 package tests + 9 enforced registry↔MCP parity tests                                         | M      | #9                           |
|  12 | **F-4** Inconsistent `/api/me/*` auth                                                          | S12, S5             | Medium | Decide per-resource policy; align; document                                                           | S      | none                         |
|  13 | **Learning loop** graded every recommendation in 0 ms (fixed in #118)                          | S4                  | Medium | Done: 24 h observation window; §DD-1 acceptance test satisfied both directions                        | M      | none                         |
|  14 | **F-5** 6 mutating routes without Zod                                                          | S12                 | Medium | Schemas for `me/strava`, both sync routes                                                             | S      | none                         |
|  15 | **F-7** Downsampling + IndexedDB volume unverified                                             | S16, S10            | Medium | Output-size bound test; quota handling in `fit-db.ts`                                                 | M      | none                         |
|  16 | **G-4** `FEATURES.md` omits ~16 subsystems; test counts 3× off (fixed in #116)                 | Docs                | Medium | Done: all twelve §C.4 items applied; anchors and cited paths verified                                 | M      | none                         |
|  17 | **F-1** Coverage thresholds unenforced                                                         | Eng/ops             | Low    | Non-blocking thresholds in `vitest.config.ts`                                                         | XS     | #7                           |
|  18 | **F-3** API key compared with `===`                                                            | S12                 | Low    | `timingSafeEqual` + length guard                                                                      | XS     | none                         |
|  19 | Node skew: `.nvmrc`/CI on 22, local 24                                                         | Eng/ops             | Low    | Align, or document supported range in `engines`                                                       | XS     | none                         |
|  20 | 23 ESLint warnings (`set-state-in-effect`, unused var)                                         | S9                  | Low    | Clear or explicitly baseline                                                                          | S      | none                         |
|  11 | **D-6** Cameron model predicts 2:30:23 where 3 models agree at 1:33–1:43 (NEW — fixed in #111) | S1, S7              | High   | Done: implemented the published formula; pinned to equivalence tables                                 | S      | none                         |
|  12 | **D-5** multi-anchor comparator never sorted (NEW — fixed in #110)                             | S1                  | Medium | Done: sort by pace; test asserts fastest-first                                                        | XS     | none                         |
|  13 | **D-7** unauthenticated `GET /api/webhooks/strava/subscribe` (NEW — fixed in #112)             | S12                 | Medium | Done: requires a session, matching the sibling POST                                                   | XS     | none                         |
|  14 | **D-8** two time-dependent suites turned `main` red overnight (NEW — fixed in #117)            | Eng/ops             | Medium | Done: system clock pinned in both files; assertions unchanged                                         | XS     | none                         |
|  21 | **Outcome store is in-memory** — the learning loop cannot close across requests (NEW)          | S4                  | Medium | Persist onto the existing `recommendation_log` table / `lib/db/recommendation-log.ts`                 | M      | none                         |

\* Severity conditional on verification.

---

## H. Unresolved questions

1. ~~**Webhook signatures (blocking, highest priority).** Does Strava sign webhook
   POSTs with `x-hub-signature-256`? If not, push sync has never worked. I could
   not test this and my API knowledge may be stale. **Needs a maintainer answer.**~~
   → **ANSWERED, and my hypothesis here was wrong.** Strava _does_ sign, via
   `X-Strava-Signature: t=…,v1=…` over `` `${t}.${rawBody}` `` with a dedicated
   signing secret — not `x-hub-signature-256`. Push sync had indeed never worked,
   for that reason. Fixed and merged; see the addendum. **One residual ask:** the
   docs never state where the signing secret is surfaced in the Strava API app
   settings, and live delivery is still unproven here.
2. **Is V1 race prediction still a supported surface, or legacy?** `FEATURES.md`
   §3.5/§5.3 present it as active and it is exposed via `get_predictions` and MCP,
   yet commit `4c76e3d` suggests V2 is displacing it. If V1 is deprecated, D-1 and
   the 26-minute disagreement are lower priority; if supported, they are High.
   **Product decision.**
3. ~~**What should count as a "race-quality effort"?** The pivotal shared question
   behind D-1, D-2, and the exponent implausibility. Options: an explicit
   `isRaceLike` flag, `source === "PR"`, a pace threshold relative to recent
   bests, or manual tagging. **Product decision, blocks #4 and #5.**~~
   → **ANSWERED, and it was not a product decision after all.** The repo already had
   the authority: `workoutType.ts` classifies every run, `computeInsights` already
   computed the labels, and `physiology.ts` already showed how to thread them in.
   Whole activities now count only when raced or run as tempo/interval work. None of
   the four options listed was needed. Fixed in #110.
4. **Intended leg-feel conflict policy?** Is "local always wins" deliberate even
   when the server holds a strictly newer report, or is recency-based merge the
   intent? The unused `reportedAt`/`source` fields suggest the latter.
5. **Should MCP reach all 44 tools?** Or is the 15-tool surface a deliberate
   curation? This determines whether #9 is a bug fix or a doc correction.
6. **Is `taperResponses: 0` correct for the demo athlete,** or does that inference
   never fire? I could not distinguish the two.
7. **Does the fallback plan's 24.3 km vs `maxWeeklyRunKm` 23.9 indicate a leak,**
   or does the cap correctly exclude non-run modalities? My measurement could not
   separate these.
8. **Blocked by environment (all capped "Implemented but unverified"):** Strava
   OAuth, live API sync, webhook delivery, MCP against a live Claude Desktop
   client, and all browser-rendered UI behaviour.

---

### Verification honesty statement

Every pass/fail in this report was executed and observed in this environment; no
outcome is inferred. Confirmed defects (D-1, D-2, D-3, D-4) each have a
reproducible harness result quoted above. R-1/F-10 is explicitly flagged as
**not verified**. Where my own intermediate conclusions were wrong, they are
corrected in §B rather than quietly dropped. All nine harnesses were removed;
only this report remains under `.eval/`.
