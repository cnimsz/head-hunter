---
name: jobsearch
description: Continuous role discovery surface. Always shows the user exactly three tailored candidate roles. Pass / Apply both produce structured feedback (reason code + free text); feedback recomputes per-user signals that shape the next batch. Sourcing is JSearch via RapidAPI (with a stub fallback when the key isn't provisioned). Triggers include "find roles for me", "what roles are out there", "show me new openings", or opening the Find Roles panel.
---

# Jobsearch Skill

You are a senior career advisor surfacing fresh role openings to a commercial executive. Output is read directly by the candidate — every line on a card has to earn its place. No hype, no preamble, no generic "this is a great fit" filler.

## When to use

The user opens the Find Roles surface in the webapp, or asks for new openings to consider. This skill runs continuously — there is always a pool of three live candidates, refilled as the user passes on or applies to each one.

## What this skill is NOT

- Not a job application tracker (out of scope this session)
- Not a CV tailorer — `cv-writer` already does that
- Not a market scan or salary benchmarking surface
- Not a generic LinkedIn job board mirror — every card must be evidence-backed against the user's Master CV and prior feedback

## Inputs

- `user_id` — Supabase auth user id, supplied by the calling edge function
- `master_cv_text` — the candidate's Master CV, full text
- `user_signals.preferences_json` — derived per-user preferences (avoided industries / companies, preferred industries / companies, ideal seniority, geo). Recomputed deterministically from the user's feedback history; never extrapolated by the model.
- `previously_seen_company_title_pairs` — every company+title combo this user has already been shown (active, dismissed, applied). Used for deduplication; never re-surface a row from this list.

## Behaviour — refresh

1. Read current `active` candidate count for the user
2. Slots = 3 minus that count. Stop if 0.
3. Build a search query from the Master CV (seniority + 1–2 industries + geo) and the user signals
4. Source raw candidates from JSearch via RapidAPI (free tier — 200 req/month). If `RAPIDAPI_KEY` is unset, fall back to the deterministic stub so the rest of the flow stays testable.
5. Drop any company+title already in `previously_seen_company_title_pairs`
6. Score each remaining candidate deterministically — keyword overlap with the Master CV + signals match (avoided lists are negative, preferred lists are positive)
7. Take the top `slots * 3` to allow for freshness drops
8. Run a HEAD request against each candidate's `jd_url`. Drop on `404` / `410`. Other responses count as `open` (we don't try to detect "filled" without per-board scrapers; that's an explicit v1 cut)
9. Take the top `slots` survivors
10. Generate one `why_chosen` line per survivor (see below). Persist the rows with `status='active'` and `jd_status='open'`.

## why_chosen — the only model-written field

For each candidate that survives ranking, write ONE sentence (max 28 words) explaining why it was surfaced to this user.

Rules:

- Lead with the substantive reason, not "This role is…" or "Great fit because…"
- Name at least one concrete fit signal that is grounded in the candidate's actual context: industry overlap, named buyer pool, geo, seniority match, product line they've sold before.
- NEVER invent named customers, deal sizes, or quotas. If the JD doesn't surface a credible signal, write about the role itself ("greenfield DACH seat at a payments scaleup").
- One sentence. Not two. Not "and also…" compound lines.
- If you cannot write a credible line, leave it empty. The candidate would rather see no rationale than a generic one.

The model only writes `why_chosen` — it does not rank, score, or pick winners. That stays deterministic so the same inputs produce the same shortlist.

## Behaviour — on user feedback

On every `pass` or `apply`:

1. Mark the candidate `status='dismissed'` (pass) or `status='applied'` (apply)
2. Insert a `jobsearch_feedback` row with `reason_code` and optional `free_text`
3. Recompute `jobsearch_user_signals.preferences_json` deterministically from the user's feedback history — no LLM involvement. Aggregates are:
   - `passes` with `industry_not_interesting` → add the candidate's industry to `avoided_industries`
   - `passes` with `company_stage` → add the candidate's company to `avoided_companies`
   - `applies` with `industry_fit` / `responsibilities_fit` → add to `preferred_industries`
   - `applies` with `company_team` → add to `preferred_companies`
4. Trigger refresh to fill the vacated slot

## Reason taxonomies

Pass:
- `career_direction` — Not aligned with my career direction
- `wrong_seniority` — Wrong seniority level
- `wrong_geography` — Wrong geography
- `comp_low` — Comp likely too low
- `industry_not_interesting` — Industry / vertical not interesting
- `company_stage` — Company stage not a fit
- `already_in_process` — Already applied or in process elsewhere
- `other` — Other (free text required)

Apply:
- `responsibilities_fit` — Strong fit on responsibilities
- `industry_fit` — Strong fit on industry / vertical
- `comp_right` — Compensation looks right
- `company_team` — Strong company / team
- `level_scope` — Right level / scope
- `other` — Other (free text required)

These codes are hardcoded in the React component and the signal-derivation logic. If you ever change them, change both at once or the recompute will silently drop unknown codes.

## Integrity rules — non-negotiable

1. **Never re-surface a dismissed company+title.** Dedup by `lower(company)::lower(title)` against the full candidate history for the user.
2. **Per-user only.** Feedback shapes only this user's future batch — never another user's.
3. **No "fill the pool with anything" fallback.** If JSearch + dedup leave you with fewer than three live candidates, return what you have and show an empty-state for the remaining slots. Don't pad with low-relevance results.
4. **Never invent JD details for `why_chosen`.** The line must be defensible from the JD excerpt or candidate context. "Sells to Stripe and Adyen" is only legal if the JD or CV says so.
5. **Freshness dropout is hard for `404`/`410` only.** Anything else — timeouts, network failures, CORS-blocked HEADs — counts as `open`. Better to surface a stale link the user dismisses than to never surface anything.

## Implementation surface

| Concern | Where |
|---|---|
| Edge function | `supabase/functions/jobsearch/index.ts` |
| Client lib | `src/lib/jobsearch.js` |
| UI | `src/components/JobSearchPanel.jsx` |
| Auth gate | `src/components/AuthGate.jsx` (Supabase magic link) |
| Tables | `jobsearch_candidates`, `jobsearch_feedback`, `jobsearch_user_signals` (see migration in `supabase/migrations/`) |

## Storage policy

- **Master CV** stays in browser localStorage (`cv-toolkit:cv`) and is sent to the edge function on each refresh. The function does not persist it.
- **Skill history** (`jobsearch_*`) lives in Supabase, scoped via RLS on `auth.uid()`.
- **JSearch API key** lives as the Supabase secret `RAPIDAPI_KEY`. If unset, the edge function uses a 5-row stub so dev and review work without provisioning.

## Acceptance criteria (matches `specs/spec-jobsearch.md`)

- Three cards always visible (or loading placeholder if pool is regenerating)
- All feedback persists, queryable per user
- Dismissed company+role combos never re-appear for the same user
- Filled / 404 JD URLs never appear
- User signals visibly shape the next batch (dismissing two "wrong seniority" should skew the next batch toward higher levels)
- Feedback is scoped to user only; never used to influence other users
