# CV Toolkit App (Head Hunter)

One-screen web app: Paste job description → Get tailored CV, cover letter, and LinkedIn message.
All processing runs client-side in the browser — no backend.

## Tech Stack

- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS 3 (dark mode via class toggle)
- **Document generation:** `docx` + `file-saver`
- **File parsing:** `pdfjs-dist` (PDF), `mammoth` (DOCX), `jszip` (ZIP)
- **API:** Anthropic Messages API — claude-sonnet-4-6, proxied via Supabase Edge Function (`head-hunter-claude`)
- **Bot challenge:** Cloudflare Turnstile gates the edge function. Site key is public (in the bundle); secret key + HMAC session secret live as Supabase secrets.
- **Supabase:** Project ref `kntzxuzplmuccqvpntql` — edge function uses `HEAD_HUNTER` (Anthropic API key), `TURNSTILE_SECRET_KEY`, and `HEAD_HUNTER_SESSION_SECRET` secrets
- **Storage:** localStorage (prefix: `cv-toolkit:`) — includes `cv`, `theme`, `profile`, and `learnings:*`
- **Deploy:** Vercel — https://head-hunter-fawn.vercel.app

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        APP SHELL                                │
│  App.jsx — layout, theme, state orchestration                   │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   INPUT     │ │   CLAUDE    │ │   OUTPUT    │ │   STORAGE   │
│   PANEL     │ │   ENGINE    │ │   PANEL     │ │   LAYER     │
│             │ │ claude.js   │ │ + Editable  │ │ storage.js  │
│             │ │ + prompts/  │ │ + Feedback  │ │ learnings.js│
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
       │                                │              │
┌──────┴──────┐                  ┌──────┴──────┐ ┌────┴────────┐
│  CV Parser  │                  │  DOCX Gen   │ │ Master CV   │
│ cvParser.js │                  │  docx.js    │ │ Compiler    │
└─────────────┘                  └─────────────┘ └─────────────┘
```

## File Structure

```
head-hunter/
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
│   │   ├── InputPanel.jsx              ← Job description + CV upload form
│   │   ├── OutputPanel.jsx             ← Tabbed results (CV/CL/LinkedIn) + display components
│   │   ├── EditableCV.jsx              ← Structured CV editing form
│   │   ├── EditableCoverLetter.jsx     ← Structured cover letter editing form
│   │   ├── FeedbackModal.jsx           ← Upload revised docs → extract style rules
│   │   ├── MasterCVCompiler.jsx        ← Upload .zip of CVs → synthesize master CV
│   │   ├── SettingsModal.jsx           ← Saved CV management
│   │   └── Turnstile.jsx               ← Cloudflare Turnstile widget wrapper
│   ├── lib/
│   │   ├── claude.js                   ← API calls, generation pipeline, JSON extraction
│   │   ├── cvParser.js                 ← PDF/DOCX/TXT text extraction (client-side)
│   │   ├── docx.js                     ← Structured data → formatted .docx download
│   │   ├── storage.js                  ← localStorage wrapper (CV, theme)
│   │   ├── learnings.js                ← Learned style rules persistence
│   │   ├── feedback.js                 ← Diff analysis via Claude
│   │   └── compileMasterCV.js          ← ZIP extraction + master CV synthesis
│   └── prompts/
│       ├── cv-writer.js                ← CV tailoring prompt (→ structured JSON)
│       ├── job-research.js             ← Company research + hiring manager + LinkedIn msg
│       ├── cover-letter.js             ← Cover letter prompt (→ structured JSON)
│       ├── master-cv.js                ← Multi-CV synthesis prompt
│       └── feedback.js                 ← Diff analysis → style rules prompt
├── skills/                             ← Reference skill docs (not used at runtime)
│   ├── CV_FORMAT_SPEC.md
│   ├── COVER_LETTER_FORMAT_SPEC.md
│   ├── cv-writer/SKILL.md
│   ├── cover-letter-writer/SKILL.md
│   └── job-description-research/SKILL.md
└── public/
    └── favicon.svg
```

## Generation Pipeline

Three sequential Claude API calls per generation:

1. **CV Writer** — `jobDescription` + `masterCV` → structured `cvData` JSON
2. **Job Research** — `jobDescription` + `companyName` + CV highlights → `hiringManager`, `companyBrief`, `linkedInMessage`
3. **Cover Letter** — `jobDescription` + `tailoredCV` + `hiringManager` + `companyBrief` → structured `clData` JSON

Progress tracked via `onStep` callback: `'cv'` → `'research'` → `'coverLetter'` → `'done'`

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

**Web search:** the research call (and only that call) passes a `tools` array containing Anthropic's hosted `web_search_20250305` server tool with `max_uses: 8`. The edge function allow-lists which tool types it forwards (see `ALLOWED_TOOL_TYPES` in `supabase/functions/head-hunter-claude/index.ts`). The OutputPanel validates `linkedInUrl` against the canonical `linkedin.com/(in|pub)/<slug>` pattern before rendering the link.

Cost: ~$0.30–$0.40 per research call at Sonnet 4.6 pricing. Each search costs $0.01, but the larger driver is input-token inflation — every search result is appended to the message context, pushing a single research call from ~3K input tokens to ~80K+. Latency ~30–45s when the model uses several searches. If cost or latency becomes an issue, lower `max_uses` in `src/lib/claude.js` (currently 8) or switch the research call only to Haiku 4.5 (would require a second `MODEL` constant and extending the edge function model allow-list usage).

## Key Patterns

**Browser-only execution:** All file parsing (PDF via pdfjs, DOCX via mammoth, ZIP via jszip) runs client-side. Claude API calls are proxied through a Supabase Edge Function (`head-hunter-claude`) that holds the Anthropic API key as a secret — no key is stored or exposed client-side.

**Structured output → editable forms → DOCX:** Claude returns JSON matching the schemas above. OutputPanel renders it as formatted display. Users can switch to edit mode (EditableCV / EditableCoverLetter) to modify structured fields. DOCX generation takes the structured data directly — no markdown→docx conversion needed.

**Learned preferences:** Users upload revised versions of generated docs via FeedbackModal. Claude diffs original vs revised and extracts durable style rules. Rules are stored in localStorage (`cv-toolkit:learnings:{skill}`, max 40 per skill) and appended to future prompts via `formatLearningsBlock()`.

**Master CV compiler:** Upload a .zip of multiple CV files → extract text from each → send to Claude to synthesize one comprehensive master CV → save for future tailoring.

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
edge_function: 'https://kntzxuzplmuccqvpntql.supabase.co/functions/v1/head-hunter-claude'
model: 'claude-sonnet-4-6'
max_tokens: 8000
// Anthropic key stored as Supabase secret HEAD_HUNTER — never exposed to the client.
// First call: cf-turnstile-token header. Subsequent calls in the same generation:
// x-session-token header. Anything else → 401.
```

Edge function also enforces: model allow-list (sonnet-4-6, haiku-4-5, opus-4-7), `max_tokens` ≤ 8000, body ≤ 200KB, 20 req/min per IP (in-memory, per-isolate).

Error handling: 401 → bot challenge failed or session expired/invalid, 413 → body too large, 429 → rate limit, plus network and JSON parse errors.

## Environment variables

| Name | Where | Purpose |
|------|-------|---------|
| `HEAD_HUNTER` | Supabase secret | Anthropic API key |
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
- [ ] Add structured outputs to replace `extractJson()`
- [ ] Add prompt caching for multi-call sessions
