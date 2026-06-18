# CV Toolkit App (Head Hunter)

One-screen web app: Paste job description → Get tailored CV, cover letter, and LinkedIn message.
File parsing runs client-side in the browser; Claude calls and the auth-gated features (Gap Analysis, Find Roles) are proxied through Supabase Edge Functions so the Anthropic API key never reaches the client.

## Tech Stack

- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS 3 (dark mode via class toggle)
- **Document generation:** `docx` + `file-saver`
- **File parsing:** `pdfjs-dist` (PDF), `mammoth` (DOCX), `jszip` (ZIP)
- **API:** Anthropic Messages API — Sonnet 4.6 for CV writing + cover letter, Haiku 4.5 for the research call (separate rate-limit pool — web_search inflates input tokens enough to blow Sonnet's Tier 1 ITPM). Proxied via Supabase Edge Function `head-hunter-claude`.
- **Bot challenge:** Cloudflare Turnstile gates the public edge function. Site key is public (in the bundle); secret key + HMAC session secret live as Supabase secrets.
- **Auth:** Supabase Auth (magic link) gates the Gap Analysis and Find Roles features. Public surfaces (generation pipeline) stay unauthenticated and only need Turnstile.
- **Supabase:** Project ref `bcenuebydpkyfmtzfcku` — edge functions use `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET_KEY`, `HEAD_HUNTER_SESSION_SECRET`, and (for jobsearch) `RAPIDAPI_KEY` secrets.
- **Storage:** localStorage (prefix: `cv-toolkit:`) — includes `cv`, `theme`, `profile`, `consent`, `template`, `auth`, and `learnings:*`.
- **Deploy:** Vercel — https://head-hunter-fawn.vercel.app

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        APP SHELL                                │
│  App.jsx — layout, theme, state orchestration                   │
└─────────────────────────────────────────────────────────────────┘
   │           │           │           │             │           │
   ▼           ▼           ▼           ▼             ▼           ▼
┌──────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
│INPUT │ │  CLAUDE  │ │ OUTPUT  │ │   GAP    │ │   JOB    │ │ STORAGE │
│PANEL │ │  ENGINE  │ │  PANEL  │ │ ANALYSIS │ │  SEARCH  │ │  LAYER  │
│      │ │claude.js │ │+Editable│ │  PANEL   │ │  PANEL   │ │storage  │
│      │ │+prompts/ │ │+Feedback│ │(AuthGate)│ │(AuthGate)│ │+profile │
│      │ │          │ │+Templates│ │          │ │          │ │+learn.  │
└──────┘ └──────────┘ └─────────┘ └──────────┘ └──────────┘ └─────────┘
    │         │           │            │             │
┌───┴───┐ ┌───┴────┐ ┌───┴────┐  ┌────┴─────┐  ┌────┴──────┐
│Parser │ │Turnst. │ │DOCX Gen│  │ gap-     │  │ jobsearch │
│cvPars.│ │+Master │ │+ tpl/* │  │ analysis │  │ edge fn   │
│       │ │CV Comp.│ │        │  │ edge fn  │  │ (JSearch) │
└───────┘ └────────┘ └────────┘  └──────────┘  └───────────┘
```

## File Structure

```
head-hunter/
├── README.md
├── CLAUDE.md
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx                        ← Entry point
│   ├── App.jsx                         ← Shell, theme, state orchestration
│   ├── index.css                       ← Tailwind directives
│   ├── components/
│   │   ├── InputPanel.jsx              ← JD + CV upload form, consent gate, Turnstile
│   │   ├── OutputPanel.jsx             ← Tabbed results (CV/CL/Research) + display
│   │   ├── EditableCV.jsx              ← Structured CV editing form
│   │   ├── EditableCoverLetter.jsx     ← Structured cover letter editing form
│   │   ├── FeedbackModal.jsx           ← Upload revised docs → extract style rules
│   │   ├── MasterCVCompiler.jsx        ← Upload .zip of CVs → synthesize master CV
│   │   ├── SettingsModal.jsx           ← Identity, saved CV, and learnings management
│   │   ├── Turnstile.jsx               ← Cloudflare Turnstile widget wrapper
│   │   ├── AuthGate.jsx                ← Magic-link sign-in wrapper (gates GapAnalysis/JobSearch)
│   │   ├── GapAnalysisPanel.jsx        ← Auth-gated CV vs JD gap analysis + apply-to-master
│   │   └── JobSearchPanel.jsx          ← Auth-gated "Find Roles" pool (3 active candidates)
│   ├── lib/
│   │   ├── claude.js                   ← API calls, generation pipeline, JSON extraction
│   │   ├── cvParser.js                 ← PDF/DOCX/TXT text extraction (client-side)
│   │   ├── docx.js                     ← Dispatcher: pick template + render + saveAs
│   │   ├── storage.js                  ← localStorage wrapper (CV, theme, consent)
│   │   ├── profile.js                  ← Identity extraction + merge from uploaded CVs
│   │   ├── learnings.js                ← Learned style rules persistence
│   │   ├── feedback.js                 ← Diff analysis via Claude
│   │   ├── compileMasterCV.js          ← ZIP extraction + master CV synthesis
│   │   ├── supabase.js                 ← Supabase client singleton + function URL helpers
│   │   ├── gapAnalysis.js              ← Gap-analysis edge fn client + master-CV splicer
│   │   ├── jobsearch.js                ← Jobsearch edge fn client (list/refresh/feedback)
│   │   └── templates/                  ← .docx visual templates
│   │       ├── tokens.js               ← Per-template style tokens (fonts, sizes, colors)
│   │       ├── classic.js              ← Classic CV/CL renderer (Arial, single column)
│   │       ├── modern.js               ← Modern CV/CL renderer (Calibri, two-column)
│   │       └── executive.js            ← Executive CV/CL renderer (Georgia, accent rule)
│   └── prompts/
│       ├── cv-writer.js                ← CV tailoring prompt (→ structured JSON)
│       ├── job-research.js             ← Company research + hiring manager + LinkedIn msg
│       ├── cover-letter.js             ← Cover letter prompt (→ structured JSON)
│       ├── master-cv.js                ← Multi-CV synthesis prompt
│       ├── feedback.js                 ← Diff analysis → style rules prompt
│       └── gap-analysis.js             ← Gap-analysis prompt (→ structured findings)
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── head-hunter-claude/         ← Public generation proxy (Turnstile + session)
│   │   ├── gap-analysis/               ← Auth-gated; persists runs + findings (RLS)
│   │   └── jobsearch/                  ← Auth-gated; JSearch + candidate pool + signals
│   └── migrations/                     ← SQL for gap_analysis_* and jobsearch_* tables
├── skills/                             ← Reference skill docs (not used at runtime)
│   ├── CV_FORMAT_SPEC.md
│   ├── COVER_LETTER_FORMAT_SPEC.md
│   ├── cv-writer/SKILL.md
│   ├── cover-letter-writer/SKILL.md
│   ├── job-description-research/SKILL.md
│   ├── cv-gap-analysis/
│   └── jobsearch/
├── specs/                              ← Design specs for gap-analysis + jobsearch
└── public/
    └── favicon.svg
```

## Generation Pipeline

Three sequential Claude API calls per generation, two models:

1. **CV Writer** (`MODEL` = Sonnet 4.6) — `jobDescription` + `masterCV` → structured `cvData` JSON
2. **Job Research** (`RESEARCH_MODEL` = Haiku 4.5) — `jobDescription` + `companyName` + CV highlights → `hiringManager`, `companyBrief`, `linkedInMessage`. Runs Anthropic's hosted `web_search_20250305` tool with `max_uses: 5`. Haiku is used here because web_search inflates input tokens enough to blow Sonnet's Tier 1 ITPM if all three calls run on the same model.
3. **Cover Letter** (`MODEL` = Sonnet 4.6) — `jobDescription` + `tailoredCV` + `hiringManager` + `companyBrief` → structured `clData` JSON

Progress tracked via `onStep` callback: `'cv'` → `'research'` → `'coverLetter'` → `'done'`.

## Structured Data Formats

### CV Data (cvData)
```js
{
  name: string,
  contact: string,
  summary: string,
  experience: [{ company: string, titleLine: string, bullets: string[] }],
  education: string[],
  skills: string[]          // format: "Category: keyword, keyword, …"
}
```

### Cover Letter Data (clData)
```js
{
  senderName: string,       // sourced from profile.name (localStorage) or the CV header
  senderContact: string,    // sourced from profile contact line or the CV header
  date: string,
  recipient: { name, title, company, location },
  salutation: string,
  openingParagraph: string,
  bullets: string[],        // exactly 3
  closingParagraph: string,
  signatureName: string
}
```

### Job Research Output
```js
{
  companyBrief: string,     // 12 lines max
  hiringManager: {
    name,                   // string | null — null when no person verified
    title,                  // string — supervisor title (verified or inferred)
    linkedInUrl,            // string | null — must match https://www.linkedin.com/(in|pub)/<slug>
    confidence: 'high'|'medium'|'low',
    rationale
  },
  linkedInMessage: string,  // <300 characters
  linkedInCharCount: number
}
```

**Web search:** the research call (and only that call) passes a `tools` array containing Anthropic's hosted `web_search_20250305` server tool with `max_uses: 5`. The edge function allow-lists which tool types it forwards (see `ALLOWED_TOOL_TYPES` in `supabase/functions/head-hunter-claude/index.ts`). The OutputPanel validates `linkedInUrl` against the canonical `linkedin.com/(in|pub)/<slug>` pattern before rendering the link.

Cost: ~$0.05–$0.10 per research call at Haiku 4.5 pricing (was $0.30+ on Sonnet). Each search costs $0.01, but the larger driver is input-token inflation — every search result is appended to the message context, pushing a single research call from ~3K input tokens to ~80K+. Latency ~25–40s when the model uses several searches. Tune via the `max_uses` literal in `src/lib/claude.js` or the `RESEARCH_MODEL` constant.

## Key Patterns

**Browser-only execution:** All file parsing (PDF via pdfjs, DOCX via mammoth, ZIP via jszip) runs client-side. Claude API calls are proxied through a Supabase Edge Function (`head-hunter-claude`) that holds the Anthropic API key as a secret — no key is stored or exposed client-side.

**Structured output → editable forms → DOCX:** Claude returns JSON matching the schemas above. OutputPanel renders it as formatted display. Users can switch to edit mode (EditableCV / EditableCoverLetter) to modify structured fields. DOCX generation takes the structured data directly — no markdown→docx conversion needed.

**Learned preferences:** Users upload revised versions of generated docs via FeedbackModal. Claude diffs original vs revised and extracts durable style rules. Rules are stored in localStorage (`cv-toolkit:learnings:{skill}`, max 40 per skill) and appended to future prompts via `formatLearningsBlock()`.

**Master CV compiler:** Upload a .zip of multiple CV files → extract text from each → send to Claude to synthesize one comprehensive master CV → save for future tailoring.

**Auth-gated features (Gap Analysis + Find Roles):** Opened from the main app via `AuthGate`, a magic-link sign-in wrapper backed by Supabase Auth. Public surfaces stay unauthenticated — only these two features require a user session, because both persist per-user state (gap findings; jobsearch candidates + feedback signals) under RLS in Postgres. Each panel has its own dedicated edge function (`gap-analysis`, `jobsearch`) with its own rate limit and its own model budget.

**Visual templates:** DOCX generation goes through `src/lib/docx.js`, which dispatches to one of three template modules under `src/lib/templates/` (Classic/Modern/Executive). Each module exports `renderCV(data)` and `renderCL(data)` returning `{ styles, numbering, sections }`. Tokens (fonts, sizes, colors, margins) live in `tokens.js`. User's template choice persists in localStorage at `cv-toolkit:template`.

## DOCX Formatting

- Font: Arial throughout
- CV: Name 14pt bold, section headers 11pt bold uppercase with bottom border, body 10.5pt
- Cover letter: Sender 12pt bold, body 11pt, signature 11pt bold
- Line spacing: 1.15 (276 twips)
- Margins: 1 inch all sides
- Page size: US Letter
- Bullets: Proper numbering references (not Unicode)
- Filenames: sanitized, include company + role when available

## API Configuration

All Claude API calls are proxied through a Supabase Edge Function. Auth flow:

1. User solves a Cloudflare Turnstile challenge in the browser → Turnstile token captured in client state.
2. **Call 1 (CV writer)** sends header `cf-turnstile-token: <token>`. Edge function verifies with Cloudflare's siteverify endpoint. On success, processes the request and returns header `x-session-token: v1.<ts>.<hmac>` (HMAC-SHA256 of `${ts}.${ip}`, signed with `HEAD_HUNTER_SESSION_SECRET`, 10-min TTL).
3. **Calls 2 & 3 (research, cover letter)** send the session token as `x-session-token`. Edge function verifies HMAC + TTL + IP match. No Cloudflare round-trip.

```js
edge_function: `${VITE_SUPABASE_URL}/functions/v1/head-hunter-claude` // VITE_SUPABASE_URL points at project bcenuebydpkyfmtzfcku
model: 'claude-sonnet-4-6'
max_tokens: 8000
// Anthropic key stored as Supabase secret ANTHROPIC_API_KEY — never exposed to the client.
// First call: cf-turnstile-token header. Subsequent calls in the same generation:
// x-session-token header. Anything else → 401.
```

Edge function also enforces: model allow-list (sonnet-4-6, haiku-4-5, opus-4-7), `max_tokens` ≤ 8000, body ≤ 200KB, 20 req/min per IP (in-memory, per-isolate).

Error handling: 401 → bot challenge failed or session expired/invalid, 413 → body too large, 429 → rate limit, plus network and JSON parse errors.

## Environment variables

| Name | Where | Purpose |
|------|-------|---------|
| `ANTHROPIC_API_KEY` | Supabase secret | Anthropic API key (renamed from `HEAD_HUNTER` on 2026-06-01 after a rotation) |
| `TURNSTILE_SECRET_KEY` | Supabase secret | Cloudflare Turnstile secret. Test value: `1x0000000000000000000000000000000AA` (always passes) |
| `HEAD_HUNTER_SESSION_SECRET` | Supabase secret | HMAC key for session tokens. Generate: `openssl rand -hex 32` |
| `VITE_TURNSTILE_SITE_KEY` | `.env.local` (dev) + Vercel env (prod) | Cloudflare Turnstile site key. Public by design — embedded in client bundle. Test value: `1x00000000000000000000AA` (always passes) |

Rotate the session secret: set a new `HEAD_HUNTER_SESSION_SECRET` in Supabase. Sessions in flight invalidate immediately; no client redeploy needed. The site key only needs rotation if the Cloudflare Turnstile site is replaced.

## Model Configuration

The Claude model is configured via the `MODEL` constant in `src/lib/claude.js`. Current supported models:

| Model | ID | Input / Output per Mtok | Use case |
|-------|----|------------------------|----------|
| Opus 4.7 | `claude-opus-4-7` | $5 / $25 | Highest quality, worth the cost for critical outputs |
| Sonnet 4.6 | `claude-sonnet-4-6` | $3 / $15 | **DEFAULT** — excellent quality at lower cost |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | $1 / $5 | Fast iteration, bulk runs, testing |

**Deprecated — do not use:** `claude-sonnet-4-20250514`, `claude-3-*`, or any ID with a pre-2025-11 date suffix.

## Code Style

- **ES modules only** — `import`/`export`, never `require`
- **React functional components with hooks** — no class components
- **Tailwind utility classes** for all styling — no CSS modules, no inline styles beyond dynamic values
- **TypeScript is not used** — keep it that way unless we migrate the whole repo
- Prefer destructured imports: `import { Button } from '...'`

## Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Production build
npm run preview   # Preview production build
```

## Testing

- **Full pipeline**: `/test-pipeline` (skill runs end-to-end with `tests/sample-jd.txt`)
- **Edge function only**: curl the function URL directly (see deploy-edge-function skill)
- **UI sanity**: load `/` in browser, paste JD, generate, download all three outputs, confirm they open in Word

Always run `/test-pipeline` after:
- Model changes
- Prompt changes
- Edge function changes
- Anything touching `extractJson()` or `generateCVDocx()`

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API key storage | Supabase Edge Function secret | Key never exposed to client |
| CV parsing | pdfjs-dist + mammoth | Client-side only, no server upload |
| Response streaming | Not yet | Simpler error handling |
| State management | useState + props | App is small enough |
| Styling | Tailwind only | No custom CSS to debug |
| Output format | Structured JSON → forms | Enables editing + clean DOCX |
| Learnings | localStorage rules | Persists across sessions, no backend |
| Edge function auth | Turnstile + 10-min HMAC session token | Replaced static `VITE_HH_APP_TOKEN` (which was bundled into client JS and effectively public). Site key is *meant* to be public; the secret never leaves Supabase. One challenge per generation; calls 2/3 use a server-issued session token to avoid mid-pipeline challenges. |

## Known Gotchas

- **Pipe characters in Claude responses** corrupt JSON parsing. `extractJson()` handles it. If you migrate to structured outputs, this problem disappears.
- **Raw JSON flashing** in the UI before rendering. Always wait for full response before rendering — `cvDataToText()` and `clDataToText()` expect complete data.
- **CV too long (3+ pages)** happens when prompts don't enforce 2-page max + 4 bullets per role. The prompt templates have this — don't weaken it.
- **CORS errors** on first deploy usually mean the edge function isn't setting `Access-Control-Allow-Origin` correctly. Match the response headers to the Vercel production domain.
- **Windows paths break** if Claude Code operates on OneDrive-synced files mid-sync. If you hit weird "file not found" errors, check OneDrive status.

## When Claude Should Ask vs. Act

- **Ask first**: any change to the edge function, any secret management, any deploy, any refactor touching more than 3 files.
- **Act immediately**: typos, lint fixes, small bug fixes, documentation updates.
- **Always use Plan Mode** for: architecture changes, adding new features, model migrations, structured-output migrations.

## Backlog

- [ ] Response streaming for better UX
- [ ] Application history (save past generations)
- [ ] Multiple CV profiles
- [ ] Direct LinkedIn integration
- [ ] PDF export option
- [ ] Add structured outputs to replace `extractJson()` (currently duplicated across `src/lib/claude.js`, `src/lib/feedback.js`, and `supabase/functions/gap-analysis/index.ts`)
- [ ] Extract a `supabase/functions/_shared/` module — CORS, rate limit, and JSON extraction are copy-pasted across the three edge functions
- [ ] Add ESLint + Prettier to catch dep-array drift and missing `type="button"` automatically
