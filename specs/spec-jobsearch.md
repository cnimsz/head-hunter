# Skill spec: `jobsearch`

> **Concept:** A continuous role discovery surface. Always shows exactly 3 candidate roles tailored to the user. Dismissing or applying both produce feedback. Feedback refines future suggestions, scoped to that user only.

## User flow

1. User opens the jobsearch view in the webapp
2. Sees exactly 3 role cards
3. Each card shows: company name, role title, location, one-line "Why this role for you," link to the JD
4. Card has two affordances:
   - **✕** (Pass) → opens feedback popup
   - **Apply** (clicks through to JD, marks as applied) → opens feedback popup
5. Popup submits feedback → card animates out → new role animates in → total stays at 3

## Why this design works

- "Always 3" caps decision fatigue
- Forced feedback creates a real learning signal (the user can't passively dismiss)
- Per-user scoping respects that two senior execs in fintech might want very different things
- Apply is also feedback — positive signal, not just "view JD"

## Data model (Supabase)

### `jobsearch_candidates`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK to user |
| company | text | |
| title | text | |
| location | text | |
| jd_url | text | |
| why_chosen | text | One-line rationale, model-generated |
| source_score | float | Internal scoring (relevance to CV + signals) |
| status | enum | `active` / `dismissed` / `applied` |
| jd_status | enum | `open` / `filled` / `404` (from freshness check) |
| jd_freshness_checked_at | timestamptz | |
| created_at | timestamptz | |

### `jobsearch_feedback`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| candidate_id | uuid | FK |
| action | enum | `pass` / `apply` |
| reason_code | text | From taxonomy below |
| free_text | text | Optional |
| created_at | timestamptz | |

### `jobsearch_user_signals`
| Field | Type | Notes |
|---|---|---|
| user_id | uuid | PK |
| preferences_json | jsonb | Derived: avoided_industries, ideal_seniority, geo, salary_floor, named_excluded_companies, named_preferred_companies |
| updated_at | timestamptz | |

## Reason taxonomy (Pass)

- Not aligned with my career direction
- Wrong seniority level
- Wrong geography
- Comp likely too low
- Industry / vertical not interesting
- Company stage not a fit
- Already applied or in process elsewhere
- Other (free text required)

## Reason taxonomy (Apply)

- Strong fit on responsibilities
- Strong fit on industry / vertical
- Compensation looks right
- Strong company / team
- Right level / scope
- Other (free text required)

## Skill behavior (what the SKILL.md instructs Claude to do)

**Inputs:** `user_id`, optional `force_refresh` flag

**Steps:**
1. Read `jobsearch_user_signals` for the user
2. Read user's Master CV summary (title, industries, geo, seniority)
3. Source new candidate roles (see "Source" below)
4. Run `jd-freshness-check` on each candidate URL — drop `filled` / `404`
5. Score remaining candidates against signals + CV similarity
6. Filter out company+role combos the user has already dismissed
7. Return top N where N = 3 minus current `active` candidates
8. Write rows to `jobsearch_candidates` with `status='active'`

**On feedback submission:**
1. Update candidate `status` to `dismissed` or `applied`
2. Insert `jobsearch_feedback` row
3. Recompute `jobsearch_user_signals.preferences_json` from feedback history
4. Trigger candidate generation to bring active count back to 3

## Source

**v1 (revised 2026-06-01): JSearch via RapidAPI.** The Greenhouse-scraping plan was dropped in favour of an aggregator from day one — per the kickoff prompt v3 decision. Endpoint `https://jsearch.p.rapidapi.com/search`, auth via `RAPIDAPI_KEY` env var. Free tier (200 req/month) is enough for dev. If `RAPIDAPI_KEY` is not yet provisioned, the JSearch client is stubbed so the rest of the flow can be built and tested.

**v2: additional aggregators.** Add Adzuna, Otta/Welcome to the Jungle, or direct Greenhouse if a curated company list becomes useful.

Cache results in `jobsearch_candidates` to minimize API calls. Run JD freshness check on each result before surfacing.

## UI requirements

- Three role cards in a horizontal row on desktop, stacked on mobile
- Card: ~340×180px, clean visual hierarchy: company name (large) → role title → location → why-chosen (italic / lighter) → JD link
- Animations: card fades out + slides; new card slides in from the right
- Popup is a modal with: radio button list (reason codes) + textarea (free text) + Submit
- Submit is disabled until reason_code is selected
- Pass popup title: "Why pass on this role?"
- Apply popup title: "What made this role appealing?"
- Loading state when fewer than 3 candidates available: "Finding more roles…"
- Empty state if source exhausted: "No new roles right now — check back later"

## Acceptance criteria

- [ ] Three cards always visible (or loading placeholder if pool is regenerating)
- [ ] All feedback persists, queryable per user
- [ ] Dismissed company+role combos never re-appear for the same user
- [ ] Filled / 404 JD URLs never appear
- [ ] User signals visibly shape next batch (e.g., dismissing 2 "wrong seniority" → next batch skews more senior)
- [ ] Feedback is scoped to user only; never used to influence other users

## Edge cases

- User dismisses all 3 simultaneously: regenerate all 3 in one batch
- Source returns zero new matches: show empty state, don't surface stale ones
- Freshness check fails temporarily (network error): keep candidate, mark `jd_freshness_checked_at` stale, recheck next render
- User changes their Master CV: invalidate scoring, regenerate next batch

## Open questions for the implementation session

1. ~~**Source decision:** confirm v1 = curated company list scraped from Greenhouse.~~ — **Resolved (2026-06-01):** v1 source is JSearch via RapidAPI. Stub the client until `RAPIDAPI_KEY` is provisioned.
2. **Refresh cadence:** on view? on feedback only? both?
3. **`why_chosen` line generation:** model-generated per candidate, or templated from `source_score` components? Model-generated reads more human but costs tokens.

## Implementation notes (added 2026-06-01)

- **Backend** is a Supabase Edge Function (`supabase/functions/jobsearch/index.ts`), not a Next.js API route. The webapp is Vite + React.
- **Auth** is Supabase Auth (magic link), gated at feature entry by `AuthGate` — same model as `cv-gap-analysis`. Tables are scoped via RLS on `auth.uid()`.
