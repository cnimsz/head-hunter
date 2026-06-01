# Kickoff prompt v3 — Build two skills (decisions confirmed)

> Supersedes `kickoff-prompt-v2.md`. Paste below the divider into a fresh Claude Code session in the Head Hunter repo.

---

You are picking up work on the Head Hunter project. Two new skills to build, specs are in the repo:

1. `/specs/spec-cv-gap-analysis.md` — interactive post-tailoring gap analysis that improves the Master CV permanently
2. `/specs/spec-jobsearch.md` — continuous role discovery surface with per-user feedback learning

Reference data for quality bar:
- `/docs/gap-analysis-reference.md` — canonical example of the gap-analysis output style

Read both specs and the reference in full before writing any code.

## Confirmed architecture decisions

These supersede any contradicting language in the spec files:

### Storage split

- **Master CV text** → **localStorage**, written via the existing `saveMasterCV(text, filename)` function in `src/lib/storage.js`. Do NOT migrate the Master CV to Supabase. Do NOT mutate localStorage directly — always go through `saveMasterCV()`.
- **Skill history** (every table defined in the specs: `gap_analysis_runs`, `gap_analysis_findings`, `jobsearch_candidates`, `jobsearch_feedback`, `jobsearch_user_signals`) → **Supabase**, scoped by `user_id` from Supabase auth.

### Master CV write flow for gap analysis

When the user answers a gap question and clicks "Add to CV":

1. Read current Master CV from localStorage
2. Locate the right insertion point (skill section, role bullet, summary line, certification list)
3. Splice in the new evidence
4. Call `saveMasterCV(updatedText, filename)` to persist
5. Record the update in `gap_analysis_findings.applied_to_master = true` and `master_cv_section`
6. Re-render the tailored CV view with the new content

### Auth model (confirmed in implementation session)

- **Supabase Auth via email magic link.** No password, no anonymous sessions.
  Anonymous sessions would break cross-device personalization (different
  `user_id` per browser), so they were rejected.
- **Gated at feature entry, not at app load.** The existing CV compiler stays
  public — no sign-in required for the standard generation flow. Sign-in is
  prompted only when the user clicks "Run Gap Analysis" or opens the
  jobsearch view. If a session already exists, the gate passes through
  silently.
- Implementation: `src/lib/supabase.js` (singleton client), `src/components/AuthGate.jsx` (gate component wrapping each feature). `App.jsx` touches the client at mount so magic-link `?code=…` returns get exchanged into a session even when the gate isn't mounted yet.

### Backend pattern (confirmed in implementation session)

The skills' server-side code runs as **Supabase Edge Functions**, not Next.js
API routes. The webapp is a Vite + React SPA with no API route convention —
references in the spec files to `app/api/skills/<name>/route.ts` should be
read as "the skill's backend endpoint," and are implemented under
`supabase/functions/<skill>/`.

- New edge functions: `gap-analysis` (step 1), `jobsearch` (step 2)
- Auth is enforced inside each function by calling
  `supabase.auth.getUser()` against the caller's `Authorization: Bearer <jwt>`
  header. Per-user RLS on the history tables provides the actual data scope.
- The existing `head-hunter-claude` edge function (Turnstile-gated, public)
  is unchanged and still serves the standard CV/research/cover-letter pipeline.

### Role source for jobsearch

**JSearch via RapidAPI** is the v1 aggregator. Not Greenhouse scraping, not a curated company list.

- Endpoint: `https://jsearch.p.rapidapi.com/search`
- Auth: `RAPIDAPI_KEY` env var (add to `.env.local` and Vercel project env vars)
- Free tier (200 req/month) is enough for dev; production will likely need a paid tier
- Query construction: build search keywords from the user's Master CV (role title, top industries, seniority signal) + their `jobsearch_user_signals.preferences_json`
- Cache results in `jobsearch_candidates` to minimize API calls
- Run JD freshness check on each result before surfacing (build minimal inline freshness check if a skill doesn't already exist for this)

## Build order

### Step 1 — `cv-gap-analysis` (build first; smaller surface, immediate value)

1. Supabase migration: `gap_analysis_runs`, `gap_analysis_findings` tables (schema in spec) with RLS on `auth.uid()`
2. Create `/skills/cv-gap-analysis/SKILL.md`
3. Supabase Edge Function `supabase/functions/gap-analysis/index.ts` that invokes the skill and returns structured findings (NOT a Next.js API route — this is a Vite SPA)
4. Helper module to splice answers into Master CV text and call `saveMasterCV()`
5. React component: side panel with gap cards (design per spec UI section)
6. Wire "Run Gap Analysis" button into the tailored-CV result view
7. End-to-end test: run on the Fireblocks Sales Director Dynamic CV. Verify the output matches the quality bar in `/docs/gap-analysis-reference.md` — ≥10 ranked gaps with title / rationale / single question per gap

### Step 2 — `jobsearch` (build second)

1. Supabase migration: `jobsearch_candidates`, `jobsearch_feedback`, `jobsearch_user_signals` tables with RLS on `auth.uid()`
2. JSearch API client module (Edge Function `supabase/functions/jobsearch/`) with rate-limit handling and result normalization. v1 stubs the JSearch call if `RAPIDAPI_KEY` is not yet provisioned, so the rest of the flow can be built and tested without blocking.
3. JD freshness check (inline minimal version if no existing skill)
4. Scoring logic — relevance to CV + signals match
5. `/skills/jobsearch/SKILL.md` orchestrating: query JSearch → freshness check → score → filter against feedback history → persist top-N
6. React component: 3-card row with feedback modals (design per spec UI section), gated by `AuthGate`
7. End-to-end test: generate 3 candidates for a real user, dismiss one with feedback, verify replacement and that the same company+role doesn't reappear

## Commit hygiene

One commit per logical unit:
- Each Supabase migration is its own commit
- Each SKILL.md is its own commit
- Each React component is its own commit
- Use conventional commits: `feat:`, `chore:`, `fix:`

## What done looks like for this session

- Both skills functional end-to-end in dev
- Gap analysis runs on Colin's Fireblocks CV and matches the reference quality
- Jobsearch generates 3 real candidates from JSearch, dismissal works, replacement works
- All changes committed; PR opened

## What NOT to do

- Don't migrate the Master CV out of localStorage
- Don't build the application tracker, STAR generator, interview prep, negotiation, or postmortem skills — out of scope
- Don't roll your own auth; use Supabase auth
- Don't change the existing `compileMasterCV.js` internals; only consume its output and call `saveMasterCV()` for writes
- Don't expand role sources beyond JSearch in v1
- Don't add admin UI for the feedback taxonomies — hardcode them; they can move to config later

## If you hit a fork

If a question surfaces that the specs and this prompt don't answer, write it down as a comment in the relevant file and choose the simpler path. Don't stall the session on a clarification round-trip.
