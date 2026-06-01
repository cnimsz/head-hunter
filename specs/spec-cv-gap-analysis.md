# Skill spec: `cv-gap-analysis`

> **Concept:** After the webapp generates a tailored CV from a JD, the user clicks "Run Gap Analysis." An interactive agent identifies what the JD asks for that the CV doesn't address, ranks gaps by interview-blocking impact, and asks one targeted question per gap. User answers update both the tailored CV AND the Master CV — permanently improving the source of truth for every future application.

## Reference implementation

The exact behavior to replicate: the chat-side gap analysis from May 29, 2026 that produced the "Honest gap analysis against the JD" message for the Fireblocks Sales Director Dynamic role. See `/docs/gap-analysis-reference.md` (paste the chat message there as the canonical example).

That run produced 10 gaps, grouped into highest-impact (3), medium (3), hiding-in-background (3), and one reframe. Each gap had: title, rationale (why it matters for *this* role), and a single specific question. The user answered 4 of the highest-impact ones; the CV was rebuilt incorporating those answers.

The skill should reproduce that quality of analysis on demand.

## User flow

1. User has just generated a tailored CV in the webapp
2. New button on the tailored-CV view: **"Run Gap Analysis"**
3. Click → an interactive panel opens (slide-in from right, or modal overlay)
4. Loading state while skill runs (~10–20s)
5. Panel shows: "I found N gaps between your CV and the JD. Ranked by impact:"
6. Each gap rendered as a card:
   - **Title** (e.g., "Deal sizes not specified")
   - **Rationale** (1–2 sentences on why this gap matters specifically for this role)
   - **Question** (single targeted question)
   - Textarea for answer
   - Three buttons: **Add to CV** / **Skip** / **Doesn't apply**
7. Visible progress: "3 of 10 addressed"
8. User can stop at any time with **Done**
9. On Done: tailored CV re-renders with new content visibly highlighted (new lines glow briefly)

## Data model (Supabase)

### `gap_analysis_runs`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| tailored_cv_id | uuid | FK |
| jd_url | text | |
| status | enum | `in_progress` / `complete` |
| total_gaps | int | |
| addressed_count | int | |
| created_at | timestamptz | |

### `gap_analysis_findings`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| run_id | uuid | FK |
| gap_title | text | |
| gap_rationale | text | |
| gap_question | text | |
| impact_rank | int | 1 (highest) to 10 |
| impact_tier | enum | `highest` / `medium` / `hiding` |
| status | enum | `open` / `answered` / `skipped` / `doesnt_apply` |
| user_answer | text | |
| applied_to_master | bool | Default false |
| master_cv_section | text | Which section was updated |
| created_at | timestamptz | |
| answered_at | timestamptz | |

Master CV updates use the existing compiler's schema — no new table needed for the CV itself.

## Skill behavior (what the SKILL.md instructs Claude to do)

**Inputs:** `tailored_cv_id`, `jd_url`, `user_id`

**Analysis steps:**
1. Read structured tailored CV (from compiler output)
2. Read JD (fetch + parse into structured requirements)
3. Diff: list every requirement that doesn't have direct evidence in the CV
4. For each gap, classify by interview-blocking impact:
   - **Highest:** quantitative claims a recruiter will literally scan for (deal sizes, quota %, AUM, headcount managed)
   - **Medium:** structural credibility signals (sales methodology, language fluency, time-zone overlap, certifications)
   - **Hiding-in-background:** likely the user has the data but it isn't surfaced (pipeline metrics, win rates, specific named accounts, niche speaking venues)
5. For each gap, generate ONE specific question — not multiple-choice, not open-ended; a question the user can answer in one sentence
6. Suppress gaps the user has already "doesn't apply"-ed in past runs (read history from `gap_analysis_findings` joined by user_id)
7. Return ranked findings, written to `gap_analysis_findings` rows with `status='open'`

**On user answer (`Add to CV`):**
1. Decide which Master CV section the answer belongs in (skill, bullet under a specific role, certification, summary line)
2. Update Master CV via the existing compiler API
3. Re-render tailored CV with the new evidence in place
4. Mark finding `status='answered'`, `applied_to_master=true`, record `master_cv_section`

**On `Skip`:**
- Mark `status='skipped'`. Will be re-surfaced in future runs.

**On `Doesn't apply`:**
- Mark `status='doesnt_apply'`. Suppressed in all future runs for this user.

**On `Done`:**
- Mark run `status='complete'`
- Return the re-rendered tailored CV

## UI requirements

- New button in the tailored-CV result view: **Run Gap Analysis** (secondary CTA next to Download)
- Sliding panel from right side (40% width on desktop, full-screen modal on mobile)
- Header: "Gap Analysis · {company} · {role}"
- Sub-header: "{N} gaps found · {M} addressed"
- Gap card design:
  - Top border colored by tier: red (highest), amber (medium), gray (hiding)
  - Title 16px bold
  - Rationale 14px body, lighter weight
  - Question 14px italic
  - Textarea below: 3-line default, expandable
  - Three buttons: primary "Add to CV", secondary "Skip", tertiary "Doesn't apply"
- After "Add to CV": card collapses with a checkmark, next card surfaces
- Side panel footer: **Done** button, always visible
- On Done: panel closes, tailored CV view shows updates with a 2-second highlight animation

## Acceptance criteria

- [ ] Quality of analysis matches the reference example (10 gaps minimum on a typical senior CV against a meaty JD)
- [ ] Each gap has title + rationale + one specific question (not three questions per gap, not a generic prompt)
- [ ] Each "Add to CV" updates the Master CV, not just the tailored output
- [ ] User can re-run gap analysis on a different JD and the Master CV improvements show up immediately
- [ ] "Doesn't apply" gaps don't re-appear for that user in future runs
- [ ] Updates are reversible — user can undo a CV edit from a history view

## Edge cases

- User answer is "I don't have that" → match this verbatim; mark `doesnt_apply`, never fudge
- User answer is partial (e.g., gives a deal size for company X but not Y) → incorporate where applicable, don't extrapolate
- Same JD analyzed twice → second run shows only gaps that became unaddressed (CV updates between runs)
- Master CV update conflicts with existing content → flag to user, ask which version to keep

## Open questions for the implementation session

1. ~~**Master CV write path:** does the compiler expose a write API, or does the skill mutate Supabase directly?~~ — **Resolved (2026-06-01):** the compiler module exposes no write API. The Master CV lives in browser localStorage and is written via `saveMasterCV(text, filename)` from `src/lib/storage.js`. Gap-analysis answers are appended under a `## Gap-Analysis Updates` section so the CV writer prompt picks them up on the next tailoring pass. See `src/lib/gapAnalysis.js::appendAnswerToMasterCV`.
2. **Highlight animation:** show the new content in the tailored CV with a colored glow on first render after gap analysis closes — yes / no? (Deferred — v1 prompts the user to re-generate to see the update in the tailored output.)
3. **Undo history:** how long do we keep the ability to revert a CV edit — 30 days, forever, last 10 edits? (Deferred — v1 has no undo UI; the finding row keeps the user_answer + the master_cv_section so a future revert is possible.)

## Implementation notes (added 2026-06-01)

- **Backend** is a Supabase Edge Function (`supabase/functions/gap-analysis/index.ts`), not a Next.js API route. The webapp is Vite + React.
- **Auth** is Supabase Auth (magic link), gated at feature entry by `AuthGate` — not at app load.
- The edge function calls Anthropic with `web_search_20250305` enabled (max 5 uses) so rationales can name the hiring company's actual customer base and ecosystem instead of falling back to generics.
